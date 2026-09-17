import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { resolveCommissionRate } from "@/lib/commission";

/** Raised inside the placement transaction; mapped to an HTTP error response. */
class OrderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Collapse whitespace runs and cap length so a corrupted client field can
 *  never persist interleaved multi-line garbage into the admin panel. */
function cleanAddressPart(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/**
 * Canonical shipping-address serialization: prefer the structured fields and
 * emit `[label] Name\nPhone\nStreet\nCity`, each component exactly once.
 * Falls back to the sanitized free-form string for legacy clients that only
 * send `address`.
 */
function serializeShippingAddress(body: {
  address?: string;
  label?: string;
  type?: string;
  name?: string;
  phone?: string;
  street?: string;
  city?: string;
}, authUser?: { name?: string | null; phone?: string | null; username?: string | null }): string {
  // Bind identity fields to the authenticated user — never trust client name/phone.
  // The user's registered phone is authoritative for delivery; a spoofed phone
  // could redirect a physical package to an attacker's address.
  const name = cleanAddressPart(authUser?.name ?? body.name);
  const rawPhone = authUser?.phone ?? body.phone;
  const phone = cleanAddressPart(rawPhone);
  const street = cleanAddressPart(body.street);
  const city = cleanAddressPart(body.city);
  if (name || phone || street || city) {
    const label = cleanAddressPart(body.label || body.type);
    const lines = [name, phone, street, city].filter(Boolean);
    return label ? `${label} • ${lines.join("\n")}` : lines.join("\n");
  }
  return cleanAddressPart(body.address);
}

export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const mine = req.nextUrl.searchParams.get("mine");
  const username = auth.user.username!;
  const rows = await prisma.order.findMany({
    where:
      mine === "seller"
        ? { sellerUsername: username }
        : mine === "all"
          ? { OR: [{ buyerUsername: username }, { sellerUsername: username }] }
          : { buyerUsername: username },
    orderBy: { createdAt: "desc" },
    // Industry cap: latest 100 (cursor pagination arrives with feed-scale;
    // 200-row pulls jank low-end devices and leak history).
    take: 100,
  });
  // Attach the latest refund request per order (separate table): without
  // this, a refund requested on one device is invisible on every other
  // (refunds tab empty after relogin, refund re-offered on refunded orders).
  // Plus the open-dispute freeze flag: sellers must see frozen earnings as
  // frozen (the payout guard excludes them) instead of withdrawable.
  const trackings = Array.from(new Set(rows.map((o) => o.trackingNumber).filter(Boolean)));
  const refundByRef = new Map<string, { id: string; status: string; reason: string; requestedAt: number }>();
  const frozenByTracking = new Set<string>();
  if (trackings.length) {
    try {
      const refundRows = await prisma.refund.findMany({
        where: { orderRef: { in: trackings } },
        orderBy: { requestedAt: "desc" },
      });
      for (const r of refundRows) {
        if (!refundByRef.has(r.orderRef)) {
          refundByRef.set(r.orderRef, {
            id: r.id,
            status: r.status,
            reason: r.reason,
            requestedAt: r.requestedAt.getTime(),
          });
        }
      }
    } catch {}
    try {
      const frozenRows = await prisma.dispute.findMany({
        where: { orderId: { in: trackings }, status: { in: ["open", "under_review"] } },
        select: { orderId: true },
      });
      for (const d of frozenRows) frozenByTracking.add(String(d.orderId));
    } catch {}
  }

  return NextResponse.json({
    orders: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber ?? o.trackingNumber ?? o.id,
      kind: "order",
      sellerName: o.sellerName,
      sellerUsername: o.sellerUsername ?? "",
      buyerName: o.buyerName,
      buyerUsername: o.buyerUsername ?? "",
      items: Array.isArray(o.itemsList)
        ? (o.itemsList as {
            name: string;
            qty: number;
            listingId?: string;
            imageUrl?: string;
            price?: number;
            variantLabel?: string;
            netPrice?: number;
            commission?: number;
            commissionRate?: number;
            category?: string;
          }[])
        : [],
      total: o.amount,
      chargedTotal: o.amount,
      status: o.status,
      // Withdrawable-truth for seller surfaces: refunded rows are clawed back
      // (never earnings), frozen rows unlock on ruling — never withdrawable.
      paymentStatus: (o as { paymentStatus?: unknown }).paymentStatus ? String((o as { paymentStatus?: unknown }).paymentStatus) : "",
      disputeFrozen: frozenByTracking.has(o.trackingNumber),
      placedAt: o.createdAt.getTime(),
      reviewed: o.reviewed,
      rating: o.rating ?? undefined,
      reviewComment: o.reviewComment ?? undefined,
      address: o.shippingAddress,
      paymentMethod: o.paymentMethod,
      trackingNumber: o.trackingNumber,
      refund: refundByRef.get(o.trackingNumber) ?? undefined,
      // Settlement stamp ("" = pre-hold era = matured). Drives the 7-day
      // payout hold + seller "available on" dates on every device.
      actualDelivery: (o as { actualDelivery?: unknown }).actualDelivery
        ? String((o as { actualDelivery?: unknown }).actualDelivery)
        : "",
    })),
  });
}

// Place an order: debit wallet if wallet payment, create Order row + admin
// ledger entry — all in ONE transaction so the balance read can never race a
// concurrent spend. Escrow: the seller is credited at DELIVERY, never here.
export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: {
    sellerName?: string;
    sellerUsername?: string;
    items?: { name?: string; qty?: number; quantity?: number; price?: number; listingId?: string; postId?: string; variantLabel?: string }[];
    total?: number;
    chargedTotal?: number;
    address?: string;
    /** Structured shipping fields — preferred over the free-form `address`. */
    label?: string;
    type?: string;
    name?: string;
    phone?: string;
    street?: string;
    city?: string;
    paymentMethod?: string;
    orderNumber?: string;
    /** Validated against the app's fixed fee table before use. */
    deliveryFee?: number;
    promoCode?: string;
    /** Accepted-offer lock (chat negotiation → checkout): the struck deal
     *  prices this order instead of the live listing price. Verified inside
     *  the tx against the offer row (accepted only, matching listing +
     *  counterparties). Single-item orders only, never combinable with coupons. */
    offer?: { threadId?: unknown; messageId?: unknown };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const username = auth.user.username!;
  // Idempotency: retry with same orderNumber returns existing — prevents double-debit.
  if (body.orderNumber?.trim()) {
    const existing = await prisma.order.findFirst({ where: { trackingNumber: body.orderNumber.trim(), buyerUsername: username } });
    if (existing) {
      return NextResponse.json({ order: { id: existing.id, orderNumber: existing.trackingNumber, status: existing.status, placedAt: existing.createdAt.getTime(), chargedTotal: existing.amount } }, { status: 200 });
    }
  }
  const items = Array.isArray(body.items) ? body.items : [];
  const clientTotal = Number(body.chargedTotal ?? body.total ?? 0);
  // clientTotal is ignored for pricing (server recomputes authoritatively).
  // Don't gate on clientTotal>0 — a valid items[] with 0 client total is still
  // computable from Product mirrors; only reject truly empty orders.
  if (!items.length) {
    return NextResponse.json({ error: "Order items required" }, { status: 400 });
  }
  if (Number.isFinite(clientTotal) && clientTotal < 0) {
    return NextResponse.json({ error: "Order total cannot be negative" }, { status: 400 });
  }
  // Normalize: trim + lower. The COD detector is case-insensitive but wallet check is exact —
  // without trim " wallet" skips debit while still paid (free-order bypass).
  const paymentMethod = String(body.paymentMethod ?? "wallet").trim().toLowerCase();
  // Accepted-offer shape (verified inside the tx; structural checks here).
  const offerThreadId = String((body.offer as { threadId?: unknown } | undefined)?.threadId ?? "");
  const offerMessageId = String((body.offer as { messageId?: unknown } | undefined)?.messageId ?? "");
  const hasOffer = !!offerThreadId && !!offerMessageId;

  // Cash-on-delivery orders settle when the parcel lands - the seller is
  // credited from the lifecycle route on delivery, never at placement.
  const isCodPayment = paymentMethod === "cash on delivery" || paymentMethod === "cod" || paymentMethod === "cash";

  // Fail closed: only 'wallet' (atomic server debit below) and COD (settles
  // on delivery) exist. Any other string — incl. client display copy like
  // "wallet · ₹1,000" — previously skipped the debit yet was marked paid +
  // seller-credited (free-order hole). Reject instead of guessing.
  if (paymentMethod !== "wallet" && !isCodPayment) {
    return NextResponse.json({ error: "Unsupported payment method" }, { status: 400 });
  }

  // Shipping PII validation: phone when supplied must be 7-15 digits (Indian + intl).
  // Prevents garbage persistence and cross-user PII spoof via long strings.
  if (body.phone != null && String(body.phone).trim() !== "") {
    const digits = String(body.phone).replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }
  }
  if (body.name != null && String(body.name).trim() !== "") {
    const n = cleanAddressPart(body.name);
    if (n.length < 2 || n.length > 80) {
      return NextResponse.json({ error: "Invalid recipient name" }, { status: 400 });
    }
  }
  try {
    const created = await prisma.$transaction(async (tx) => {
      const commissionRate = await resolveCommissionRate(tx);

      // Server-authoritative pricing: recompute each line from the listing
      // mirror (Product id `lst_<postId>`) when reachable; fall back to the
      // client price only for items we cannot resolve.
      // `ownerUsername` is captured from the LISTING OWNER and accumulated
      // into sellerAccountedTotal — the body's sellerUsername is never
      // trusted for money movement (spoofing it would redirect earnings).
      let computedTotal = 0;
      let sellerAccountedTotal = 0;
      // Variant stock mutations staged per listing and flushed after the loop:
      // the isSold reservation serializes same-listing orders, so per-line
      // decrement inside this tx is exact (no cross-order race possible).
      const variantMutations = new Map<string, any>();
      // Listings already reserved by THIS order (multi-line same listing, e.g.
      // two variants): reserve once, validate every line against the locked
      // row — the second line used to 400 "Listing unavailable" on our own
      // reservation (hostile-audit 4a).
      const reservedIds = new Set<string>();
      // Listing types for the server-authoritative delivery fee (service → 0).
      const lineTypes: string[] = [];
      const normalized = items.map((raw) => {
        const qty = Math.max(1, Math.round(Number(raw.qty ?? raw.quantity ?? 1)));
        const unitPrice = Number(raw.price ?? 0);
        const listingId = String(raw.listingId ?? raw.postId ?? "").trim();
        return { raw, qty, unitPrice, listingId, ownerUsername: null as string | null, category: "" };
      });

      // Bundle pricing is SERVER-AUTHORITATIVE (pricing-integrity): the cart
      // split is the buyer's preview only. Lines carrying bundleId are
      // re-priced from the Bundle row — membership, quantities, and the live
      // status are verified, then the deterministic split (floor share,
      // remainder on the first listing by id order — the same formula the app
      // previews) replaces the mirror price. Any mismatch fail-closes.
      const bundlePrices = new Map<string, number>();
      {
        const groups = new Map<string, typeof normalized>();
        for (const line of normalized) {
          const bid = typeof (line.raw as { bundleId?: unknown })?.bundleId === "string"
            ? String((line.raw as { bundleId?: unknown }).bundleId).trim()
            : "";
          if (bid) {
            const g = groups.get(bid) ?? [];
            g.push(line);
            groups.set(bid, g);
          }
        }
        for (const [bid, lines] of groups) {
          const bundle = await (tx as any).bundle
            .findUnique({ where: { id: bid } })
            .catch(() => null) as {
              status?: unknown; price?: unknown; items?: unknown;
            } | null;
          if (!bundle || String(bundle.status ?? "") !== "active") {
            throw new OrderError(400, "Bundle no longer available — remove it from cart and re-add");
          }
          const contents = Array.isArray(bundle.items) ? (bundle.items as Array<{ listingId?: unknown }>) : [];
          const wantIds = contents.map((c) => String(c?.listingId ?? "")).filter(Boolean).sort();
          const gotIds = lines.map((l) => l.listingId).sort();
          if (
            wantIds.length === 0 ||
            wantIds.length !== gotIds.length ||
            wantIds.some((id, i) => id !== gotIds[i])
          ) {
            throw new OrderError(400, "Bundle changed — remove it from cart and re-add");
          }
          for (const l of lines) {
            if (l.qty !== 1) throw new OrderError(400, "Bundle quantity changed — remove it from cart and re-add");
          }
          const bundlePrice = Math.floor(Number(bundle.price ?? NaN));
          if (!Number.isFinite(bundlePrice) || bundlePrice <= 0) {
            throw new OrderError(400, "Bundle price unavailable — remove it from cart and re-add");
          }
          const ordered = [...lines].sort((a, b) => (a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0));
          const share = Math.floor(bundlePrice / ordered.length);
          ordered.forEach((l, i) => {
            bundlePrices.set(l.listingId, i === 0 ? bundlePrice - share * (ordered.length - 1) : share);
          });
        }
      }

      for (const line of normalized) {
        let post: any = null;
        if (line.listingId) {
          // ATOMIC reservation: check + set isSold in one operation.
          // Two concurrent orders cannot both pass — only one updateMany returns count: 1.
          // The row lock held until transaction commit prevents the read-then-write race.
          // Same-listing later lines reuse our own reservation (same-tx reads
          // see our writes, so stock checks below observe earlier lines).
          if (!reservedIds.has(line.listingId)) {
            const reserve = await (tx as any).post.updateMany({
              where: { id: line.listingId, status: "published", isSold: false },
              data: { isSold: true },
            });
            if (reserve.count === 0) {
              throw new OrderError(400, "Listing unavailable");
            }
            reservedIds.add(line.listingId);
          }
          post = await (tx as any).post.findUnique({ where: { id: line.listingId } });
          if (!post) {
            throw new OrderError(400, "Listing unavailable");
          }
          if (String(post.status ?? "") !== "published") {
            throw new OrderError(400, "Listing unavailable");
          }
          // Merge staged variant decrements from earlier lines of THIS order
          // so the availability check below validates against current stock.
          const staged = variantMutations.get(line.listingId);
          if (staged && Array.isArray((staged as any).variants)) {
            post = { ...post, variants: (staged as any).variants };
          }
          lineTypes.push(String((post as any).type ?? "product"));
          // Bind seller to listing owner — prevents spoofed sellerUsername funnel
          if (body.sellerUsername && post.authorUsername && String(body.sellerUsername) !== post.authorUsername) {
            // Roll back the reservation since seller binding failed
            await (tx as any).post.update({ where: { id: line.listingId }, data: { isSold: false } }).catch(() => {});
            throw new OrderError(400, "Seller does not own this listing");
          }
          if (post.authorUsername === username) {
            // Roll back the reservation since self-buy is blocked
            await (tx as any).post.update({ where: { id: line.listingId }, data: { isSold: false } }).catch(() => {});
            throw new OrderError(400, "Cannot buy your own listing");
          }
          // Variant availability re-check: the buyer's page may predate a
          // seller stock edit. A selected value at stock 0 rejects the order
          // instead of selling what isn't available.
          const rawVariant = String((line.raw as any)?.variantLabel ?? "").trim();
          if (rawVariant && Array.isArray((post as any).variants)) {
            const picks = rawVariant.split(",").map((s) => {
              const idx = s.indexOf(":");
              return idx === -1 ? { group: "", label: s.trim() } : { group: s.slice(0, idx).trim(), label: s.slice(idx + 1).trim() };
            });
            for (const pick of picks) {
              const group = (post as any).variants.find((v: any) =>
                !pick.group || String(v?.name ?? "").trim().toLowerCase() === pick.group.toLowerCase()
              );
              const val = group && Array.isArray(group.values)
                ? group.values.find((x: any) => String(x?.label ?? "").trim().toLowerCase() === pick.label.toLowerCase())
                : null;
              if (val && typeof val.stock === "number" && val.stock <= 0) {
                await (tx as any).post.update({ where: { id: line.listingId }, data: { isSold: false } }).catch(() => {});
                throw new OrderError(400, `Selected option "${pick.label}" is out of stock`);
              }
              // Quantity-vs-stock: one order line can take N units of a picked
              // value (multi-qty), so stock 1 + qty 5 must reject — and the
              // taken units decrement immediately (same tx, exact).
              if (val && typeof val.stock === "number") {
                if (val.stock < line.qty) {
                  await (tx as any).post.update({ where: { id: line.listingId }, data: { isSold: false } }).catch(() => {});
                  throw new OrderError(400, `Only ${val.stock} left for "${pick.label}"`);
                }
                val.stock -= line.qty;
                variantMutations.set(line.listingId, post);
              }
            }
          }
          // Tracked variants REQUIRE a picked option: an unlabeled line on a
          // stock-tracked variant listing would decrement nothing, check
          // nothing, and (for offer orders especially) leave the reservation
          // stuck — silently overselling or killing the listing. Fail closed
          // with a human message instead of guessing the variant.
          if (!rawVariant && Array.isArray((post as any).variants)) {
            const tracked = (post as any).variants.some((g: any) =>
              Array.isArray(g?.values) && g.values.some((v: any) => typeof v?.stock === "number")
            );
            if (tracked) {
              await (tx as any).post.update({ where: { id: line.listingId }, data: { isSold: false } }).catch(() => {});
              throw new OrderError(
                400,
                hasOffer
                  ? "This listing has options — pick one on the product page and place a new offer"
                  : "This listing has options — pick one to continue"
              );
            }
          }
          // Simple-quantity stock (stockLeft): a listing with N units must stay
          // sellable until the units run out — the blanket isSold reservation
          // above would kill a stock-10 listing after a single unit sells.
          // Decrement here (same tx); isSold flips only at depletion.
          // Variant listings: same rule on the SUM of remaining variant stock
          // (values without numeric stock count as unlimited).
          const touched = variantMutations.get(line.listingId);
          if (touched) {
            const groups = Array.isArray((touched as any).variants) ? (touched as any).variants : [];
            let remaining = 0;
            let unlimited = false;
            for (const g of groups) {
              const vals = Array.isArray((g as any)?.values) ? (g as any).values : [];
              for (const v of vals) {
                if (typeof (v as any)?.stock === "number") remaining += Math.max(0, Math.floor((v as any).stock));
                else unlimited = true;
              }
            }
            if (remaining > 0 || unlimited) {
              await (tx as any).post.update({ where: { id: line.listingId }, data: { isSold: false } }).catch(() => {
                throw new OrderError(400, "Could not release listing reservation — refresh and try again");
              });
            }
          } else {
            const slRaw = (post as any).stockLeft;
            if (typeof slRaw === "number" && Number.isFinite(slRaw)) {
              const sl = Math.floor(slRaw);
              if (sl < line.qty) {
                await (tx as any).post.update({ where: { id: line.listingId }, data: { isSold: false } }).catch(() => {});
                throw new OrderError(400, sl <= 0 ? "This listing is out of stock" : `Only ${sl} left in stock`);
              }
              const left = sl - line.qty;
              await (tx as any).post.update({ where: { id: line.listingId }, data: { stockLeft: left, isSold: left <= 0 } }).catch(() => {
                throw new OrderError(400, "Could not reserve stock — refresh and try again");
              });
            } else {
              // No finite stock engaged anywhere (untracked variant picks or
              // an unlimited listing with no stockLeft): release the
              // serialization hold or one sale bricks the listing (isSold
              // stays true, buyers see "sold out" forever). Nothing finite
              // exists to serialize, so releasing is exact.
              await (tx as any).post.update({ where: { id: line.listingId }, data: { isSold: false } }).catch(() => {
                throw new OrderError(400, "Could not release listing reservation — refresh and try again");
              });
            }
          }
          if (post.authorUsername) {
            line.ownerUsername = String(post.authorUsername);
          }
          // Per-line category drives per-line commission (admin category
          // overrides). Resolved from the listing, never the client body.
          if ((post as { category?: unknown }).category) {
            line.category = String((post as { category?: unknown }).category);
          }
          // Server-authoritative price: when listingId is supplied the Product
          // mirror is the truth. Client price fallback is NOT allowed for
          // resolver listings — reject cheap-buy spoof instead.
          const listing = await tx.product.findUnique({ where: { id: `lst_${line.listingId}` } });
          if (!listing || !Number.isFinite(listing.price)) {
            const postPrice = Number((post as unknown as { price?: unknown }).price ?? NaN);
            if (Number.isFinite(postPrice) && postPrice > 0) line.unitPrice = postPrice;
            else throw new OrderError(400, "Listing price unavailable — refresh and try again");
          } else {
            line.unitPrice = listing.price;
          }
          // Variant delta pricing: the cart carries base+delta (PDP
          // effectivePrice) but the mirror only holds the base — charging the
          // mirror undercharged every premium variant (silent seller loss).
          // Resolve picked values with the same case-insensitive match as the
          // stock check above and add their priceDelta. Unknown picks add 0
          // (same unlimited semantics as stock); offers/bundles override below.
          if (rawVariant && Array.isArray((post as any).variants)) {
            const picks = rawVariant.split(",").map((s) => {
              const idx = s.indexOf(":");
              return idx === -1 ? { group: "", label: s.trim() } : { group: s.slice(0, idx).trim(), label: s.slice(idx + 1).trim() };
            });
            let delta = 0;
            for (const pick of picks) {
              if (!pick.label) continue;
              const group = (post as any).variants.find((v: any) =>
                !pick.group || String(v?.name ?? "").trim().toLowerCase() === pick.group.toLowerCase()
              );
              const val = group && Array.isArray(group.values)
                ? group.values.find((x: any) => String(x?.label ?? "").trim().toLowerCase() === pick.label.toLowerCase())
                : null;
              const d = Number(val?.priceDelta ?? 0);
              if (Number.isFinite(d)) delta += d;
            }
            line.unitPrice = Math.round((Number(line.unitPrice) + delta) * 100) / 100;
          }
          // Accepted-offer override (BUYER-C1): the struck deal — verified
          // against the offer row, accepted-only, matching listing +
          // counterparties — replaces the mirror price. Reservation,
          // ownership, stock, and seller binding above/below still apply, so
          // a chat tap can never mint a no-address/no-payment order again.
          if (hasOffer) {
            const omsg = (await tx.chatMessage.findFirst({
              where: { id: offerMessageId, threadId: offerThreadId },
            })) as unknown as { offerAmount?: unknown; offerStatus?: unknown; offerProductId?: unknown } | null;
            const oAmt = Math.round(Number(omsg?.offerAmount));
            if (!omsg || !Number.isFinite(oAmt) || oAmt <= 0 || oAmt > 10000000) {
              throw new OrderError(400, "Offer invalid — refresh the chat");
            }
            if (String(omsg.offerStatus ?? "") !== "accepted") {
              throw new OrderError(400, "Offer not accepted yet");
            }
            if (String(omsg.offerProductId ?? "") !== line.listingId) {
              throw new OrderError(400, "Offer doesn't match this listing");
            }
            const oth = (await tx.chatThread.findUnique({ where: { id: offerThreadId } })) as unknown as {
              participantA?: unknown; participantB?: unknown;
            } | null;
            const parts = [String(oth?.participantA ?? ""), String(oth?.participantB ?? "")];
            if (!oth || !parts.includes(username) || !parts.includes(line.ownerUsername ?? "")) {
              throw new OrderError(400, "Offer counterparties don't match this order");
            }
            // Single-use consume (compare-and-set inside this tx): one struck
            // deal prices exactly one order. A replayed {threadId, messageId}
            // loses the race (count 0), rolls back its debit, and gets a 400.
            // 'consumed' displays as Accepted everywhere; the PATCH lane only
            // accepts pending→decided so it can never resurrect a used offer.
            const consumed = await (tx as any).chatMessage.updateMany({
              where: { id: offerMessageId, threadId: offerThreadId, offerStatus: "accepted" },
              data: { offerStatus: "consumed" },
            });
            if (!consumed || Number(consumed.count ?? 0) !== 1) {
              throw new OrderError(400, "Offer already used — place a new offer");
            }
            line.unitPrice = oAmt;
            (line as { offerRef?: unknown }).offerRef = { threadId: offerThreadId, messageId: offerMessageId, amount: oAmt };
          }
          // Bundle override (server-side pricer above): the Bundle row price
          // replaces the listing mirror. Bundles never combine with accepted
          // offers — same class as the coupon+offer ban (one price authority
          // per order).
          const bundleUnit = bundlePrices.get(line.listingId);
          if (bundleUnit !== undefined) {
            if (hasOffer) {
              throw new OrderError(400, "Offers can't combine with bundle deals");
            }
            line.unitPrice = bundleUnit;
          }
          // Accounting runs on the RESOLVED server price (mirror truth), never
          // the client-supplied figure — clients may omit price entirely and
          // rely on server pricing, which previously accounted ₹0 and silently
          // skipped the seller credit + settlement legs.
          if (line.ownerUsername) {
            sellerAccountedTotal += line.unitPrice * line.qty;
          }
        } else {
          // No listingId → reject: server has no price oracle, client price untrusted.
          throw new OrderError(400, "Listing id required — refresh and try again");
        }
        if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) line.unitPrice = 0;
        if (line.unitPrice > 10000000) throw new OrderError(400, "Listing price exceeds limit");
        computedTotal += line.unitPrice * line.qty;
      }
      // Flush staged variant decrements (accumulated across all lines of each
      // listing — same-listing multi-line orders share one reservation, so
      // each entry holds that listing's final variant state).
      for (const [pid, p] of variantMutations) {
        await (tx as any).post
          .update({ where: { id: pid }, data: { variants: (p as any).variants } })
          .catch(() => {
            throw new OrderError(400, "Could not reserve variant stock — refresh and try again");
          });
      }
      // Delivery fee is SERVER-AUTHORITATIVE (hostile-audit 2a): resolved from
      // the locked listing types (service → 0, food → 30, else 12 — the same
      // rule every client surface uses), never trusted from the client. A
      // tampered fee used to pass the allowlist and land in shipping revenue.
      const serverFee = lineTypes.length > 0 && lineTypes.every((t) => t === "service")
        ? 0
        : lineTypes.some((t) => t === "food_item" || t === "food")
          ? 30
          : 12;
      const RAW_FEE = Number(body.deliveryFee ?? 0);
      if (!Number.isFinite(RAW_FEE) || ![0, 12, 30].includes(RAW_FEE) || RAW_FEE !== serverFee) {
        throw new OrderError(400, "Invalid delivery fee — refresh and try again");
      }
      const deliveryFee = serverFee;
      // Zero-total never falls back to the client figure: pricing is
      // server-authoritative, and a clientTotal fallback would re-open the
      // free-order hole (client says 0, server charges 0, seller credited 0).
      if (!(computedTotal > 0)) {
        throw new OrderError(400, "Order total must be greater than zero");
      }
      const itemsTotal = computedTotal;
      // Merchandise and shipping are tracked separately: the coupon applies to
      // the combined total (checkout behavior), but commission splits ONLY the
      // merchandise — the delivery float belongs to operations, not the seller.
      let chargedTotal = Math.round(itemsTotal + deliveryFee);
      let merchTotal = itemsTotal;
      // Merchandise share of any coupon discount: the seller is commissioned
      // on what the buyer actually paid for goods, not the pre-discount
      // figure — otherwise the platform silently eats every coupon.
      let merchDiscount = 0;
      // Shipping share of any coupon discount (free_delivery in full): reduces
      // the shipping ledger leg so books balance exactly.
      let shipDiscountShare = 0;
      if (!(chargedTotal > 0)) {
        throw new OrderError(400, "Order total must be greater than zero");
      }
      // Accepted offers never stack with coupons: the struck deal is final
      // (stacking would let negotiated-price + coupon double-dip the seller).
      if (hasOffer && String(body.promoCode ?? "").trim()) {
        throw new OrderError(400, "Coupons can't combine with accepted offers");
      }
      // Bundle deals never stack with coupons either: the combo price is
      // already seller-funded, and a percent coupon would compound on the
      // discounted merchTotal a second time (same double-dip class as
      // offer+coupon and offer+bundle above — one price authority per order).
      if (bundlePrices.size > 0 && String(body.promoCode ?? "").trim()) {
        throw new OrderError(400, "Coupons can't combine with bundle deals");
      }
      if (hasOffer && normalized.length !== 1) {
        throw new OrderError(400, "Offers apply to single-item orders");
      }
      // Server-validated coupon: if promoCode supplied, apply REAL coupon discount from DB
      // (prevents client-side drift where cart shows discount server ignores).
      const rawPromo = String(body.promoCode ?? "").trim().toUpperCase();
      if (rawPromo) {
        const coupon = await tx.coupon.findUnique({ where: { code: rawPromo } });
        if (!coupon) throw new OrderError(400, "Invalid coupon code");
        if (coupon.status !== "active") throw new OrderError(400, "Coupon not active");
        if (coupon.expiresAt.getTime() < Date.now()) throw new OrderError(400, "Coupon expired");
        if (coupon.usedCount >= coupon.usageLimit) throw new OrderError(400, "Coupon usage limit reached");
        let discount = 0;
        if (coupon.type === "percent" || coupon.type === "percentage") {
          // Misconfigured percent (>100) can never settle — a 200% typo used
          // to discount a ₹1012 order to ₹1 with no visible subsidy leg.
          if (!(coupon.value > 0) || coupon.value > 100) throw new OrderError(400, "Coupon misconfigured — contact support");
          discount = Math.round((chargedTotal * coupon.value) / 100);
        }
        else if (coupon.type === "flat" || coupon.type === "fixed") discount = Math.round(coupon.value);
        else if (coupon.type === "free_delivery") discount = deliveryFee;
        discount = Math.min(discount, chargedTotal - 1);
        if (discount > 0) {
          // Discount split merch vs shipping (hostile-audit 9): free_delivery
          // is all-shipping (the seller must never fund free delivery);
          // percent/flat split pro-rata over (merch + fee) so the shipping
          // slice reduces the shipping leg, not the seller's commission base.
          const splitBase = merchTotal + deliveryFee;
          let merchShare: number;
          if (coupon.type === "free_delivery") {
            merchShare = 0;
          } else if (splitBase > 0) {
            merchShare = Math.min(merchTotal, Math.round((discount * merchTotal) / splitBase));
          } else {
            merchShare = Math.min(merchTotal, discount);
          }
          merchTotal -= merchShare;
          merchDiscount += merchShare;
          shipDiscountShare += discount - merchShare;
          chargedTotal -= discount;
          const bumped = await tx.coupon.updateMany({ where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } }, data: { usedCount: { increment: 1 } } });
          if (bumped.count === 0) throw new OrderError(400, "Coupon usage limit reached");
        }
      }

      // Wallet debit + order row share this transaction. ATOMIC compare-and-set
      // so two concurrent orders cannot both pass the balance check.
      // Crypto-random fallback (L6): Date.now()+Math.random could theoretically
      // collide under the @unique constraint and 500 a paid order.
      const trackingNumber = body.orderNumber?.trim() ? body.orderNumber.trim() : `SJ-${randomUUID().slice(0, 8).toUpperCase()}`;
      if (paymentMethod === "wallet") {
        const debited = await tx.user.updateMany({
          where: { id: auth.user.id, walletBalance: { gte: chargedTotal } },
          data: { walletBalance: { decrement: chargedTotal } },
        });
        if (debited.count === 0) {
          const cur = await tx.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } });
          if (!cur) throw new OrderError(404, "User not found");
          throw new OrderError(400, "Insufficient wallet balance");
        }
        await tx.walletTransaction.create({
          data: {
            username,
            title: `Order ${trackingNumber}`,
            detail: `${body.sellerName ?? "susej"} · ${normalized.length} item(s)`,
            amount: -chargedTotal,
          },
        });
      }

      // Seller identity resolved from LISTING OWNERSHIP (captured in the line
      // loop), never from the client body. Single-seller carts only: a
      // multi-owner cart would debit the buyer in full yet credit nobody
      // (stranded funds), and unowned lines would silently under-credit.
      // The app guards single-seller carts client-side; the server rejects
      // anything else so adversarial carts can never strand money.
      const ownerSet = Array.from(
        new Set(normalized.map((l) => l.ownerUsername).filter((u): u is string => !!u))
      );
      if (normalized.some((l) => !l.ownerUsername)) {
        throw new OrderError(400, "Listing owner unavailable — refresh and try again");
      }
      if (ownerSet.length > 1) {
        throw new OrderError(400, "Multi-seller carts are not supported — check out one seller at a time");
      }
      const isMultiOwner = false;
      const primarySeller = ownerSet[0] ?? null;

      // Per-line net basis for downstream settlement (clawbacks, COD credit,
      // dispute rulings): the coupon's merchandise share is spread pro-rata so
      // every later leg settles on what the buyer actually paid — never the
      // pre-discount figure. `price` stays the receipt truth; `netPrice` (when
      // present) is the settlement truth. Old rows without netPrice fall back
      // to price, exactly as before.
      const goodsForShare = sellerAccountedTotal > 0 ? sellerAccountedTotal : 1;
      // Per-line settlement facts (persisted): net unit price after the
      // coupon share, the commission RATE applied (admin category override
      // when one exists for the listing's category, else the global rate),
      // and the resulting commission rupees. Client earnings displays sum
      // these exact legs instead of re-deriving a flat rate — the two can
      // never disagree, whatever the admin configures later.
      const settledLines: Array<Record<string, unknown>> = [];
      for (const i of normalized) {
        const lineTotal = i.unitPrice * i.qty;
        const share = merchDiscount > 0 ? (lineTotal / goodsForShare) * merchDiscount : 0;
        const netTotal = Math.max(0, lineTotal - share);
        const rate = await resolveCommissionRate(tx, i.category || undefined);
        const fee = Math.round(netTotal * rate);
        settledLines.push({
          name: String(i.raw.name ?? "Item"),
          qty: i.qty,
          quantity: i.qty,
          price: i.unitPrice,
          netPrice: netTotal / Math.max(1, i.qty),
          commissionRate: rate,
          commission: fee,
          category: i.category || undefined,
          listingId: i.listingId,
          // Accepted-offer audit ref (struck-deal provenance for disputes).
          ...((i as { offerRef?: unknown }).offerRef ? { offerRef: (i as { offerRef?: unknown }).offerRef } : {}),
          // Persisted so every device/relogin sees WHAT was bought (variant
          // receipt); the variant OOS re-check above reads the same value.
          variantLabel: String((i.raw as any)?.variantLabel ?? ""),
        });
      }
      const order = await tx.order.create({
        data: {
          buyerName: auth.user.name,
          buyerUsername: username,
          sellerName: body.sellerName ?? "Seller",
          sellerUsername: primarySeller,
          amount: chargedTotal,
          status: "placed",
          deliveryStatus: "awaiting_shipment",
          items: normalized.reduce((n, i) => n + i.qty, 0),
          itemsList: settledLines as never,
          shippingCarrier: "",
          trackingNumber,
          estimatedDelivery: "",
          actualDelivery: "",
                    shippingAddress: serializeShippingAddress(body, auth.user),
          paymentMethod,
          paymentStatus: isCodPayment ? "pending" : "paid",
          deliveryLog: [],
        },
      });

      // ESCROW (marketplace rule: Amazon holds seller funds until delivery +
      // the return window): placement credits NOBODY. The buyer debit is the
      // platform's liability by omission (ledger charge leg below); the seller
      // is credited once, at delivery, from the settled per-line legs. The old
      // code credited goodsNet at placement, making undelivered earnings
      // immediately spendable (escrow bypass) and every pre-delivery cancel a
      // platform loss (full buyer refund vs partial clawback). Cancels before
      // delivery now move buyer money only — no clawback, no negative
      // balances, no loss loop. Legacy placement-credited rows keep their
      // evidence-based clawbacks (earnings-title checks downstream).

      // Double-entry mirror: every money move leaves immutable ledger rows so
      // the Settlements page and reconciliation tie out. Ledger writes share
      // this transaction: a ledger failure rolls back the order (loud) instead
      // of silently leaving wallet moves with no mirror (unreconcilable).
      const now = new Date();
      const ledgerRows: { partyName: string; partyRole: string; direction: string; type: string; amount: number; method: string; status: string; orderId: string; createdAt: Date }[] = [];
      if (paymentMethod === "wallet") {
        ledgerRows.push({ partyName: auth.user.name, partyRole: "buyer", direction: "out", type: "charge", amount: chargedTotal, method: "wallet", status: "success", orderId: order.id, createdAt: now });
      } else if (isCodPayment) {
        ledgerRows.push({ partyName: auth.user.name, partyRole: "buyer", direction: "out", type: "charge", amount: chargedTotal, method: "cod", status: "pending", orderId: order.id, createdAt: now });
      }
      // Escrow: seller settlement + platform fee book at DELIVERY (see the
      // delivered branch of /api/app/orders/[id]), never here — placement
      // books the buyer charge + platform shipping only.
      // Shipping float is platform-collected operations money (never seller
      // earnings, never commission): without this leg the buyer is debited
      // items+fee while ledger credits only items — books never balanced.
      // Net of the coupon's shipping share (free_delivery / percent slice).
      const shipLeg = Math.max(0, Math.round(deliveryFee) - Math.round(shipDiscountShare));
      if (shipLeg > 0 && (paymentMethod === "wallet" || isCodPayment)) {
        ledgerRows.push({ partyName: "susej", partyRole: "platform", direction: "in", type: "shipping", amount: shipLeg, method: paymentMethod, status: paymentMethod === "wallet" ? "success" : "pending", orderId: order.id, createdAt: now });
      }
      if (ledgerRows.length) {
        await tx.ledgerEntry.createMany({ data: ledgerRows });
      }

      return order;
    });

    return NextResponse.json(
      {
        order: {
          id: created.id,
          orderNumber: created.trackingNumber,
          status: created.status,
          placedAt: created.createdAt.getTime(),
          chargedTotal: created.amount,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Race-close (API-H4): trackingNumber is @unique, so two concurrent
    // retries with the same orderNumber both pass the pre-tx findFirst, but
    // only one tx commits — the loser lands here. Return the winner in the
    // idempotent shape instead of 500ing a paid order (the buyer's money
    // moved exactly once, inside the winner's tx).
    if ((err as { code?: string })?.code === "P2002" && body.orderNumber?.trim()) {
      const winner = await prisma.order
        .findFirst({ where: { trackingNumber: body.orderNumber.trim(), buyerUsername: username } })
        .catch(() => null);
      if (winner) {
        return NextResponse.json(
          { order: { id: winner.id, orderNumber: winner.trackingNumber, status: winner.status, placedAt: winner.createdAt.getTime(), chargedTotal: winner.amount } },
          { status: 200 }
        );
      }
      // Cross-buyer reference collision (not our retry): someone else's order
      // already owns this trackingNumber. 409 with guidance, never a 500 —
      // the buyer's money moved nowhere (debit rolled back with the tx).
      return NextResponse.json(
        { error: "Order reference already used — retry without a custom reference" },
        { status: 409 }
      );
    }
    throw err;
  }
}