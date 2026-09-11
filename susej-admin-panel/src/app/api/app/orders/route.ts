import { NextRequest, NextResponse } from "next/server";
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
    take: 200,
  });
  // Attach the latest refund request per order (separate table): without
  // this, a refund requested on one device is invisible on every other
  // (refunds tab empty after relogin, refund re-offered on refunded orders).
  const trackings = Array.from(new Set(rows.map((o) => o.trackingNumber).filter(Boolean)));
  const refundByRef = new Map<string, { id: string; status: string; reason: string; requestedAt: number }>();
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
      placedAt: o.createdAt.getTime(),
      reviewed: o.reviewed,
      rating: o.rating ?? undefined,
      reviewComment: o.reviewComment ?? undefined,
      address: o.shippingAddress,
      paymentMethod: o.paymentMethod,
      trackingNumber: o.trackingNumber,
      refund: refundByRef.get(o.trackingNumber) ?? undefined,
    })),
  });
}

// Place an order: debit wallet if wallet payment, create Order row + admin
// ledger entry, credit the seller net (non-COD) — all in ONE transaction so
// the balance read can never race a concurrent spend.
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
      const normalized = items.map((raw) => {
        const qty = Math.max(1, Math.round(Number(raw.qty ?? raw.quantity ?? 1)));
        const unitPrice = Number(raw.price ?? 0);
        const listingId = String(raw.listingId ?? raw.postId ?? "").trim();
        return { raw, qty, unitPrice, listingId, ownerUsername: null as string | null, category: "" };
      });

      for (const line of normalized) {
        let post: any = null;
        if (line.listingId) {
          // ATOMIC reservation: check + set isSold in one operation.
          // Two concurrent orders cannot both pass — only one updateMany returns count: 1.
          // The row lock held until transaction commit prevents the read-then-write race.
          const reserve = await (tx as any).post.updateMany({
            where: { id: line.listingId, status: "published", isSold: false },
            data: { isSold: true },
          });
          if (reserve.count === 0) {
            throw new OrderError(400, "Listing unavailable");
          }
          post = await (tx as any).post.findUnique({ where: { id: line.listingId } });
          if (!post) {
            throw new OrderError(400, "Listing unavailable");
          }
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
          // Owner binding: the credit resolves from the listing's true owner.
          // Unowned legacy listings account ₹0 — the net stays un-credited
          // (recoverable via settlement) instead of being silently lost.
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
      // Flush staged variant decrements (one successful line per listing —
      // the isSold reservation above rejects a second line on the same
      // listing, so each entry holds that listing's final variant state).
      for (const [pid, p] of variantMutations) {
        await (tx as any).post
          .update({ where: { id: pid }, data: { variants: (p as any).variants } })
          .catch(() => {
            throw new OrderError(400, "Could not reserve variant stock — refresh and try again");
          });
      }
      // Delivery fee is client-supplied but VALIDATED against the app's fixed
      // fee table (product 12 / food 30 / none 0) so it can never inflate the
      // charge — and the authoritative total then matches what checkout showed.
      const RAW_FEE = Number(body.deliveryFee ?? 0);
      if (!Number.isFinite(RAW_FEE)) {
        throw new OrderError(400, "Invalid delivery fee — must be 0, 12 or 30");
      }
      if (![0, 12, 30].includes(RAW_FEE)) {
        throw new OrderError(400, "Invalid delivery fee — must be 0, 12 or 30");
      }
      const deliveryFee = RAW_FEE;
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
      if (!(chargedTotal > 0)) {
        throw new OrderError(400, "Order total must be greater than zero");
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
        if (coupon.type === "percent") discount = Math.round((chargedTotal * coupon.value) / 100);
        else if (coupon.type === "flat" || coupon.type === "fixed") discount = Math.round(coupon.value);
        else if (coupon.type === "free_delivery") discount = deliveryFee;
        discount = Math.min(discount, chargedTotal - 1);
        if (discount > 0) {
          // The merchandise share of the discount shrinks what the seller is
          // commissioned on; the shipping share only reduces the charge.
          const merchShare = Math.min(merchTotal, discount);
          merchTotal -= merchShare;
          merchDiscount += merchShare;
          chargedTotal -= discount;
          const bumped = await tx.coupon.updateMany({ where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } }, data: { usedCount: { increment: 1 } } });
          if (bumped.count === 0) throw new OrderError(400, "Coupon usage limit reached");
        }
      }

      // Wallet debit + order row share this transaction. ATOMIC compare-and-set
      // so two concurrent orders cannot both pass the balance check.
      const trackingNumber = body.orderNumber?.trim() ? body.orderNumber.trim() : `SJ-${String(Date.now()).slice(-6)}-${Math.random().toString(36).slice(2, 4)}`;
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

      // Credit the LISTING OWNER's wallet with the NET merchandise earnings
      // (marketplace commission deducted; commission applies to goods, never
      // to the delivery float). COD settles on delivery instead. Multi-owner
      // carts and un-accounted merchandise are NOT credited here: a blended
      // split would pay one seller for another's items, and a silent ₹0 credit
      // loses money — both need explicit per-owner settlement rows instead.
      // Credit basis = resolved goods MINUS the coupon's merchandise share
      // (what the buyer actually paid for goods). Never the delivery float,
      // never the pre-discount figure.
      const creditBasis = Math.max(0, sellerAccountedTotal - merchDiscount);
      // Sum of settled per-line legs (category-aware). Falls back to the
      // global rate only if a leg is somehow missing its facts.
      let goodsFee = 0;
      for (const line of settledLines) {
        const lineNet = Math.max(0, Number(line.netPrice ?? 0) * Math.max(1, Number(line.qty ?? line.quantity ?? 1)));
        goodsFee += typeof line.commission === "number" && Number.isFinite(line.commission)
          ? Math.max(0, Math.round(line.commission))
          : Math.max(0, Math.round(lineNet * commissionRate));
      }
      const goodsNet = Math.max(0, Math.round(creditBasis) - goodsFee);
      const blendedPct = creditBasis > 0 ? Math.round((goodsFee / creditBasis) * 1000) / 10 : 0;
      if (primarySeller && !isMultiOwner && !isCodPayment && goodsNet > 0) {
        const seller = await tx.user.findUnique({ where: { username: primarySeller } });
        if (seller) {
          await tx.user.update({ where: { id: seller.id }, data: { walletBalance: { increment: goodsNet } } });
          await tx.walletTransaction.create({
            data: {
              username: seller.username!,
              title: `Order earnings · ${order.trackingNumber}`,
              detail: `${auth.user.name} · ${normalized.length} item(s) · net after ${blendedPct}% commission`,
              amount: goodsNet,
            },
          });
        }
      }

      // Double-entry mirror: every money move leaves immutable ledger rows so
      // the Settlements page and reconciliation tie out (previously LedgerEntry
      // had zero writers — the page was permanently empty). Ledger writes are
      // best-effort: money movement above must never fail because of them.
      const now = new Date();
      const ledgerRows: { partyName: string; partyRole: string; direction: string; type: string; amount: number; method: string; status: string; orderId: string; createdAt: Date }[] = [];
      if (paymentMethod === "wallet") {
        ledgerRows.push({ partyName: auth.user.name, partyRole: "buyer", direction: "out", type: "charge", amount: chargedTotal, method: "wallet", status: "success", orderId: order.id, createdAt: now });
      } else if (isCodPayment) {
        ledgerRows.push({ partyName: auth.user.name, partyRole: "buyer", direction: "out", type: "charge", amount: chargedTotal, method: "cod", status: "pending", orderId: order.id, createdAt: now });
      }
      if (primarySeller && !isMultiOwner && !isCodPayment && goodsNet > 0) {
        ledgerRows.push({ partyName: primarySeller, partyRole: "seller", direction: "in", type: "settlement", amount: goodsNet, method: paymentMethod, status: "success", orderId: order.id, createdAt: now });
        if (goodsFee > 0) {
          ledgerRows.push({ partyName: "susej", partyRole: "platform", direction: "in", type: "fee", amount: goodsFee, method: paymentMethod, status: "success", orderId: order.id, createdAt: now });
        }
      }
      if (ledgerRows.length) {
        await tx.ledgerEntry.createMany({ data: ledgerRows }).catch(() => {});
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
    throw err;
  }
}