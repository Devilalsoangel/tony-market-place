import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { resolveCommissionRate, settlementGoodsBasis, settledFeeFromLegs } from "@/lib/commission";
import { notifyUser } from "@/lib/notifications";

class OrderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Ownership-scoped single-order read (BUYER-M7 hardening): deep links and
// second devices resolve one row WITHOUT pulling 200. Never leaks across
// users — non-party gets 404 (same shape as missing, no existence oracle).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const key = String(id ?? "").trim().replace(/^#/, "");
  if (!key) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const username = auth.user.username!;
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: key }, { trackingNumber: key }, { orderNumber: key }],
      AND: [{ OR: [{ buyerUsername: username }, { sellerUsername: username }] }],
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber ?? order.trackingNumber ?? order.id,
      kind: "order",
      sellerName: order.sellerName,
      sellerUsername: order.sellerUsername ?? "",
      buyerName: order.buyerName,
      buyerUsername: order.buyerUsername ?? "",
      items: order.itemsList,
      total: order.amount,
      chargedTotal: order.amount,
      status: order.status,
      paymentStatus: (order as { paymentStatus?: unknown }).paymentStatus ? String((order as { paymentStatus?: unknown }).paymentStatus) : "",
      actualDelivery: (order as { actualDelivery?: unknown }).actualDelivery ? String((order as { actualDelivery?: unknown }).actualDelivery) : "",
      placedAt: order.createdAt.getTime(),
      reviewed: order.reviewed,
      rating: order.rating ?? undefined,
      reviewComment: order.reviewComment ?? undefined,
      address: order.shippingAddress,
      paymentMethod: order.paymentMethod,
      trackingNumber: order.trackingNumber,
    },
  });
}

const ORDER_FLOW = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;

/** Ledger titles double as idempotency guards so a movement can never run twice. */
const refundTxTitle = (tracking: string) => `Order cancelled - refund · ${tracking}`;
const clawbackTxTitle = (tracking: string) => `Order cancelled clawback · ${tracking}`;
const earningsTxTitle = (tracking: string) => `Order earnings · ${tracking}`;
// Cross-path refund titles (API-H1): cancel, seller-approve, desk, and dispute
// rulings each mint under their own taxonomy. Every guard below checks ALL of
// them, so a refund settled on one path can never pay again on another.
const buyerRefundTitles = (tracking: string) => [
  `Order cancelled - refund · ${tracking}`,
  `Order refund · ${tracking}`,
  `Dispute refund · ${tracking}`,
  `Dispute split refund · ${tracking}`,
];
const sellerClawTitles = (tracking: string) => [
  `Order cancelled clawback · ${tracking}`,
  `Order refund clawback · ${tracking}`,
  `Dispute refund clawback · ${tracking}`,
  `Dispute split clawback · ${tracking}`,
];

// Order status transitions by buyer (cancel) or seller (confirm/ship/complete).
// Money follows status: cancelling reverses real payments (buyer refund +
// seller clawback), delivering a COD order settles the seller - all inside
// one transaction with the status flip.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { status?: string; rating?: number; reviewComment?: string; reviewAnonymous?: boolean; refundReason?: string; refundDecision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const username = auth.user.username!;
  const isBuyer = order.buyerUsername === username;
  const isSeller = order.sellerUsername === username;
  if (!isBuyer && !isSeller) return NextResponse.json({ error: "Not your order" }, { status: 403 });

  const next = body.status ? String(body.status) : null;
  // Idempotent retry: a timeout-retry that already landed returns success
  // (never 400 "Cannot move") so callers can safely retry money moves.
  if (next && next === order.status) {
    return NextResponse.json({ ok: true, status: order.status, reviewed: order.reviewed, deduped: true });
  }
  if (next) {
    const curIdx = ORDER_FLOW.indexOf(order.status as never);
    const nextIdx = ORDER_FLOW.indexOf(next as never);
    const allowed =
      next === "cancelled"
        // Buyer cancel AND seller decline (can't fulfil): both settle the
        // same legs (buyer refund + seller clawback) in the tx below.
        ? (isBuyer || isSeller) && ["placed", "confirmed"].includes(order.status)
        : isSeller && nextIdx !== -1 && curIdx !== -1 && nextIdx === curIdx + 1;
    if (!allowed) return NextResponse.json({ error: `Cannot move order to ${next}` }, { status: 400 });
  }
  if (!isBuyer && typeof body.rating === "number") {
    return NextResponse.json({ error: "Only the buyer can review" }, { status: 400 });
  }
  // Reviews are only allowed AFTER delivery - the buyer must have received
  // the product before their feedback exists anywhere.
  if (isBuyer && typeof body.rating === "number" && order.status !== "delivered") {
    return NextResponse.json({ error: "Only delivered orders can be reviewed" }, { status: 400 });
  }

  const paysFromWallet = String(order.paymentMethod ?? "").trim().toLowerCase() === "wallet";
  const isCodPayment = (() => {
    const v = String(order.paymentMethod ?? "").trim().toLowerCase();
    return v === "cash on delivery" || v === "cod" || v === "cash";
  })();
  const tracking = order.trackingNumber;
  // Duplicate review guard outside tx for fast 400 — re-checked atomically inside tx.
  if (isBuyer && typeof body.rating === "number" && order.reviewed) {
    return NextResponse.json({ error: "Already reviewed" }, { status: 400 });
  }
  if (isBuyer && typeof body.rating === "number" && (body.rating < 1 || body.rating > 5)) {
    return NextResponse.json({ error: "Invalid rating: must be 1-5" }, { status: 400 });
  }

  // Net after commission - resolved with the same setting placement used.
  // Claw basis MUST equal the credit basis: goods merchandise only (the
  // placement credit is round(goods*(1-rate))). Clawing round(amount*...)
  // would steal the delivery float (₹11 on a 1000+12 order) from the seller.
  // Category-aware: orders placed after per-line settlement sum the persisted
  // per-line commission legs (admin category overrides honored exactly as at
  // placement). Legacy rows without legs fall back to the global rate.
  const commissionRate = await resolveCommissionRate(prisma);
  const goodsBasis = (() => {
    // Coupon-aware: prefers per-line netPrice persisted at placement.
    const b = settlementGoodsBasis(order.itemsList);
    return Number.isFinite(b) && b >= 0 ? b : Number(order.amount);
  })();
  const settledFee = settledFeeFromLegs(order.itemsList);
  const sellerNet = settledFee !== null
    ? Math.max(0, Math.round(goodsBasis) - settledFee)
    : Math.max(0, Math.round(goodsBasis * (1 - commissionRate)));

  let reviewErr: string | null = null;
  const updated = await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};

    if (next === "cancelled") {
      data.status = "cancelled";
      data.deliveryStatus = "cancelled";
      let reversed = false;
      // Per-leg flags so the ledger mirrors exactly what moved THIS call
      // (repeat cancels must not mint duplicate reversal rows).
      let buyerReversed = false;
      let sellerClawed = false;

      // Wallet-paid -> credit back exactly what the buyer was charged (once).
      // Cross-path guard: a seller-approve/desk/dispute refund for the same
      // order already made the buyer whole — never pay twice (API-H1).
      if (paysFromWallet && order.buyerUsername && order.amount > 0) {
        const alreadyRefunded = await tx.walletTransaction.count({
          where: { username: order.buyerUsername, title: { in: buyerRefundTitles(tracking) } },
        });
        const buyer = alreadyRefunded ? null : await tx.user.findUnique({ where: { username: order.buyerUsername } });
        if (buyer) {
          await tx.user.update({
            where: { id: buyer.id },
            data: { walletBalance: { increment: order.amount } },
          });
          await tx.walletTransaction.create({
            data: {
              username: order.buyerUsername,
              title: refundTxTitle(tracking),
              detail: `Refund for cancelled order ${order.orderNumber ?? tracking}`,
              amount: order.amount,
            },
          });
          reversed = true;
          buyerReversed = true;
        }
      }

      // Non-COD seller was credited at placement -> claw the net back (once).
      // The balance may dip below zero if earnings were already withdrawn -
      // that is a real receivable, not fabricated money.
      if (!isCodPayment && order.sellerUsername) {
        const wasCredited = await tx.walletTransaction.count({
          where: { username: order.sellerUsername, title: earningsTxTitle(tracking) },
        });
        const alreadyClawed = await tx.walletTransaction.count({
          where: { username: order.sellerUsername, title: { in: sellerClawTitles(tracking) } },
        });
        const seller = !wasCredited || alreadyClawed || sellerNet <= 0 ? null : await tx.user.findUnique({ where: { username: order.sellerUsername } });
        if (seller) {
          await tx.user.update({
            where: { id: seller.id },
            data: { walletBalance: { decrement: sellerNet } },
          });
          await tx.walletTransaction.create({
            data: {
              username: order.sellerUsername,
              title: clawbackTxTitle(tracking),
              detail: `Earnings reversal for cancelled order ${order.orderNumber ?? tracking}`,
              amount: -sellerNet,
            },
          });
          reversed = true;
          sellerClawed = true;
        }
      }

      // Only mark refunded when money actually moved back somewhere.
      if (reversed) data.paymentStatus = "refunded";
      // COD cancel moves no wallet money (nothing was prepaid) — but the
      // placement booked pending ledger legs (buyer charge + platform
      // shipping). Mark cancelled so the row never reads as payable, and void
      // the pending legs below so they don't dangle forever.
      if (isCodPayment && !paysFromWallet) data.paymentStatus = "cancelled";
      // Ledger mirror: immutable reversal rows for whatever moved back.
      // (Originals are never mutated — corrections are new rows.)
      if (reversed) {
        const lnow = new Date();
        const lrows: { partyName: string; partyRole: string; direction: string; type: string; amount: number; method: string; status: string; orderId: string; createdAt: Date }[] = [];
        if (buyerReversed && order.buyerUsername && order.amount > 0) {
          lrows.push({ partyName: order.buyerName, partyRole: "buyer", direction: "in", type: "reversal", amount: order.amount, method: order.paymentMethod, status: "success", orderId: id, createdAt: lnow });
        }
        if (sellerClawed && order.sellerUsername && sellerNet > 0) {
          lrows.push({ partyName: order.sellerUsername, partyRole: "seller", direction: "out", type: "reversal", amount: sellerNet, method: order.paymentMethod, status: "success", orderId: id, createdAt: lnow });
        }
        // Platform legs (P1 cancel-no-fee-reversal): placement booked a
        // fee-in + shipping-in; cancelling without reversing them strands
        // platform revenue on a dead order. Mirror both, once each
        // (ledger-count guard — repeat cancels never double-reverse).
        if (sellerClawed) {
          const feeOut = settledFee !== null && settledFee > 0 ? Math.round(settledFee) : Math.max(0, Math.round(goodsBasis * commissionRate));
          if (feeOut > 0) {
            const feeReversed = await tx.ledgerEntry.count({ where: { orderId: id, type: "fee", direction: "out" } });
            if (!feeReversed) lrows.push({ partyName: "susej", partyRole: "platform", direction: "out", type: "fee", amount: feeOut, method: order.paymentMethod, status: "success", orderId: id, createdAt: lnow });
          }
        }
        if (buyerReversed) {
          const shipOut = Math.max(0, Math.round(Number(order.amount ?? 0)) - Math.round(goodsBasis));
          if (shipOut > 0) {
            const shipReversed = await tx.ledgerEntry.count({ where: { orderId: id, type: "shipping", direction: "out" } });
            if (!shipReversed) lrows.push({ partyName: "susej", partyRole: "platform", direction: "out", type: "shipping", amount: shipOut, method: order.paymentMethod, status: "success", orderId: id, createdAt: lnow });
          }
        }
        if (lrows.length) await tx.ledgerEntry.createMany({ data: lrows });
      }
      // COD void legs: offset the pending charge + shipping the placement
      // booked, so cancelled COD orders leave no dangling pending rows.
      if (isCodPayment && !paysFromWallet) {
        const vnow = new Date();
        const vrows: { partyName: string; partyRole: string; direction: string; type: string; amount: number; method: string; status: string; orderId: string; createdAt: Date }[] = [];
        // Void the pending OUT charge the placement booked (same direction —
        // an opposite-direction IN row would double-count in SUM(direction=out)).
        const chargeVoided = await tx.ledgerEntry.count({ where: { orderId: id, type: "charge", direction: "out", status: "cancelled" } });
        if (!chargeVoided && order.buyerUsername && Number(order.amount ?? 0) > 0) {
          const chargePending = await tx.ledgerEntry.findFirst({ where: { orderId: id, type: "charge", direction: "out", status: "pending" } });
          vrows.push({ partyName: order.buyerName, partyRole: "buyer", direction: "out", type: "charge", amount: Number((chargePending as { amount?: unknown } | null)?.amount ?? order.amount ?? 0), method: order.paymentMethod, status: "cancelled", orderId: id, createdAt: vnow });
        }
        const shipVoided = await tx.ledgerEntry.count({ where: { orderId: id, type: "shipping", direction: "out" } });
        if (!shipVoided) {
          const shipPending = await tx.ledgerEntry.findFirst({ where: { orderId: id, type: "shipping", direction: "in", status: "pending" } });
          if (shipPending) vrows.push({ partyName: "susej", partyRole: "platform", direction: "out", type: "shipping", amount: Number((shipPending as { amount?: unknown }).amount ?? 0), method: order.paymentMethod, status: "cancelled", orderId: id, createdAt: vnow });
        }
        if (vrows.length) await tx.ledgerEntry.createMany({ data: vrows });
      }
    } else if (next === "delivered") {
      data.status = "delivered";
      data.deliveryStatus = "delivered";
      // Settlement timestamp (drives the 7-day payout hold + seller "available
      // on" dates). Legacy rows keep "" and count as matured (pre-hold era).
      data.actualDelivery = new Date().toISOString();

      // Escrow release: the seller is credited ONCE, at delivery, for wallet
      // AND COD orders alike (evidence-guarded by the earnings title, so
      // legacy placement-credited rows and timeout-retries never double-pay).
      // Wallet orders were debited at placement with no seller credit until
      // now; COD cash changes hands now. Ledger mirrors only what THIS call
      // settles (guarded by existing success rows): wallet already booked its
      // charge + shipping at placement, so delivery adds settlement + fee;
      // COD books the full set here.
      if (order.sellerUsername) {
        const alreadyCredited = await tx.walletTransaction.count({
          where: { username: order.sellerUsername, title: earningsTxTitle(tracking) },
        });
        const seller = alreadyCredited || sellerNet <= 0 ? null : await tx.user.findUnique({ where: { username: order.sellerUsername } });
        if (seller) {
          await tx.user.update({
            where: { id: seller.id },
            data: { walletBalance: { increment: sellerNet } },
          });
          await tx.walletTransaction.create({
            data: {
              username: order.sellerUsername,
              title: earningsTxTitle(tracking),
              detail: isCodPayment
                ? `${order.buyerName} · COD collected on delivery · net after ${settledFee !== null && goodsBasis > 0 ? Math.round((settledFee / goodsBasis) * 1000) / 10 : Math.round(commissionRate * 100)}% commission`
                : `${order.buyerName} · escrow released on delivery · net after ${settledFee !== null && goodsBasis > 0 ? Math.round((settledFee / goodsBasis) * 1000) / 10 : Math.round(commissionRate * 100)}% commission`,
              amount: sellerNet,
            },
          });
          if (isCodPayment) data.paymentStatus = "paid";
          // Ledger mirror: settlement + platform fee land now (once each —
          // repeat deliveries must not mint duplicate settlement rows).
          const dnow = new Date();
          const platformFee = settledFee !== null
            ? Math.max(0, settledFee)
            : Math.max(0, Math.round(goodsBasis * commissionRate));
          const settledExists = await tx.ledgerEntry.count({
            where: { orderId: id, type: "settlement", direction: "in", status: "success" },
          });
          const ledgerRows: { partyName: string; partyRole: string; direction: string; type: string; amount: number; method: string; status: string; orderId: string; createdAt: Date }[] = [];
          if (!settledExists) {
            ledgerRows.push(
              { partyName: order.sellerUsername, partyRole: "seller", direction: "in", type: "settlement", amount: sellerNet, method: order.paymentMethod, status: "success", orderId: id, createdAt: dnow },
              ...(platformFee > 0
                ? [{ partyName: "susej", partyRole: "platform", direction: "in", type: "fee", amount: platformFee, method: order.paymentMethod, status: "success", orderId: id, createdAt: dnow }]
                : [])
            );
          }
          if (isCodPayment) {
            // COD cash settles on delivery: ADOPT the pending placement legs
            // (flip to success) instead of minting second rows — otherwise the
            // pending charge + shipping dangle and success double-counts.
            // The platform remainder splits honestly: commission fee vs
            // shipping float.
            const shippingShare = Math.max(0, Math.round(order.amount - sellerNet - platformFee));
            const pendingCharge = await tx.ledgerEntry.findFirst({ where: { orderId: id, type: "charge", direction: "out", status: "pending" } });
            if (pendingCharge) {
              await tx.ledgerEntry.update({ where: { id: pendingCharge.id }, data: { status: "success", amount: order.amount } });
            } else {
              const chargeDone = await tx.ledgerEntry.count({ where: { orderId: id, type: "charge", direction: "out", status: "success" } });
              if (!chargeDone) ledgerRows.push(
                { partyName: order.buyerName, partyRole: "buyer", direction: "out", type: "charge", amount: order.amount, method: order.paymentMethod, status: "success", orderId: id, createdAt: dnow },
              );
            }
            const pendingShip = await tx.ledgerEntry.findFirst({ where: { orderId: id, type: "shipping", direction: "in", status: "pending" } });
            if (pendingShip) {
              if (shippingShare > 0) await tx.ledgerEntry.update({ where: { id: pendingShip.id }, data: { status: "success", amount: shippingShare } });
              else await tx.ledgerEntry.update({ where: { id: pendingShip.id }, data: { status: "cancelled" } });
            } else if (shippingShare > 0) {
              const shipDone = await tx.ledgerEntry.count({ where: { orderId: id, type: "shipping", direction: "in", status: "success" } });
              if (!shipDone) ledgerRows.push(
                { partyName: "susej", partyRole: "platform", direction: "in", type: "shipping", amount: shippingShare, method: order.paymentMethod, status: "success", orderId: id, createdAt: dnow },
              );
            }
          }
          if (ledgerRows.length) await tx.ledgerEntry.createMany({ data: ledgerRows });
        }
      }
    } else if (next) {
      data.status = next;
      data.deliveryStatus =
        next === "placed" || next === "confirmed" ? "awaiting_shipment"
          : next === "preparing" ? "packed"
          : "out_for_delivery";
    }

    if (isBuyer && typeof body.rating === "number") {
    if (body.rating >= 1 && body.rating <= 5) {
      // Re-read inside the tx UNDER ROW LOCK: two concurrent rating PATCHes
      // both passed the outer-snapshot guard and minted twin pending rows.
      // The loser blocks on the lock, observes reviewed=true, and 409s.
      await tx.$queryRawUnsafe(`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`, id);
      const freshReviewed = await tx.order.findUnique({ where: { id }, select: { reviewed: true } });
      if ((freshReviewed as { reviewed?: unknown } | null)?.reviewed || order.reviewed) throw new Error("Already reviewed");
      data.reviewed = true;
      data.rating = body.rating;
      data.reviewComment = String(body.reviewComment ?? "");
      // review row for the admin reviews queue + storefront reflection.
      // Anonymous reviews never expose the buyer's real name.
      // CRITICAL: status is "pending" not "approved" — reviews must be moderated
      // by admin before appearing on the storefront. This prevents fake reviews,
      // abuse, and sellers self-reviewing via fake buyer accounts.
      await tx.review.create({
        data: {
          productName: String(
            order.itemsList && Array.isArray(order.itemsList)
              ? (order.itemsList as { name?: string }[])[0]?.name ?? order.trackingNumber
              : order.trackingNumber
          ),
          reviewerName: body.reviewAnonymous ? "Anonymous" : order.buyerName,
          rating: body.rating,
          text: String(body.reviewComment ?? ""),
          status: "pending",
          sellerUsername: order.sellerUsername,
        },
      });
    }
    }
    // Buyer refund request: creates a real Refund row (idempotent per order)
    // so the seller/admin queues see it. Previously the app only wrote local
    // state + an admin mirror — the server row stayed unaware (sync lie).
    if (isBuyer && typeof body.refundReason === "string" && body.refundReason.trim()) {
      const existing = await tx.refund.findFirst({
        where: { orderRef: tracking, status: { in: ["requested", "approved"] } },
      });
      if (!existing) {
        // Anti-spam cap: reject-then-rerequest loops used to page the seller
        // forever (rejected rows never blocked). 3 requests per order, then
        // the buyer must go through Support (human review, not a loop).
        const priorCount = await tx.refund.count({ where: { orderRef: tracking } });
        if (priorCount >= 3) {
          throw new OrderError(400, "Refund request limit reached for this order — contact Support");
        }
        await tx.refund.create({
          data: {
            orderRef: tracking,
            buyerName: order.buyerName,
            sellerName: order.sellerName,
            reason: body.refundReason.trim().slice(0, 500),
            amount: order.amount,
            status: "requested",
            requestedAt: new Date(),
          },
        });
      }
    }

    // Seller refund decision (maker): only the seller on the order may approve
    // or reject the buyer's pending request. Approval settles the SAME
    // idempotent legs as the finance desk (buyer re-credit + seller clawback
    // keyed by tracking titles, so desk re-execution can never double-pay);
    // rejection moves no money. Final 'refunded' execution stays a
    // finance-desk step (dual control).
    if (typeof body.refundDecision === "string") {
      if (!isSeller) throw new OrderError(403, "Only the seller can decide a refund");
      const decision = body.refundDecision.trim().toLowerCase();
      if (decision !== "approved" && decision !== "rejected") {
        throw new OrderError(400, "Invalid refund decision");
      }
      const pending = await tx.refund.findFirst({
        where: { orderRef: tracking, status: "requested" },
      });
      if (!pending) throw new OrderError(400, "No pending refund request on this order");
      if (decision === "approved") {
        const refundTitle = `Order refund · ${tracking}`;
        const clawTitle = `Order refund clawback · ${tracking}`;
        // Cross-path guard (API-H1): a cancel/desk/dispute refund for the same
        // order already made the buyer whole — never pay twice.
        if (paysFromWallet && order.buyerUsername && order.amount > 0) {
          const alreadyRefunded = await tx.walletTransaction.count({
            where: { username: order.buyerUsername, title: { in: buyerRefundTitles(tracking) } },
          });
          if (!alreadyRefunded) {
            const buyer = await tx.user.findUnique({ where: { username: order.buyerUsername } });
            if (buyer) {
              await tx.user.update({
                where: { id: buyer.id },
                data: { walletBalance: { increment: order.amount } },
              });
              await tx.walletTransaction.create({
                data: {
                  username: order.buyerUsername,
                  title: refundTitle,
                  detail: `Refund approved for order ${order.orderNumber ?? tracking}`,
                  amount: order.amount,
                },
              });
              await tx.ledgerEntry.createMany({
                data: [{ partyName: order.buyerName, partyRole: "buyer", direction: "in", type: "reversal", amount: order.amount, method: order.paymentMethod, status: "success", orderId: id, createdAt: new Date() }],
              });
            }
          }
        }
        // Seller claw runs for wallet AND COD (post-delivery both were
        // credited at delivery — evidence-guarded by wasCredited, so
        // pre-delivery COD (never credited) safely no-ops).
        if (order.sellerUsername) {
          const wasCredited = await tx.walletTransaction.count({
            where: { username: order.sellerUsername, title: `Order earnings · ${tracking}` },
          });
          const alreadyClawed = await tx.walletTransaction.count({
            where: { username: order.sellerUsername, title: { in: sellerClawTitles(tracking) } },
          });
          if (wasCredited && !alreadyClawed && sellerNet > 0) {
            const seller = await tx.user.findUnique({ where: { username: order.sellerUsername } });
            if (seller) {
              await tx.user.update({
                where: { id: seller.id },
                data: { walletBalance: { decrement: sellerNet } },
              });
              await tx.walletTransaction.create({
                data: {
                  username: order.sellerUsername,
                  title: clawTitle,
                  detail: `Earnings reversal for refunded order ${order.orderNumber ?? tracking}`,
                  amount: -sellerNet,
                },
              });
              await tx.ledgerEntry.createMany({
                data: [{ partyName: order.sellerUsername, partyRole: "seller", direction: "out", type: "reversal", amount: sellerNet, method: order.paymentMethod, status: "success", orderId: id, createdAt: new Date() }],
              });
            }
          }
        }
        // Platform legs (approve-path completeness): placement booked fee-in +
        // shipping-in; approving without reversing them strands platform
        // revenue on a dead order (cancel path already mirrors both — this
        // copies that block with the same count guards so books balance on
        // every path, not just cancel).
        {
          const feeOut = settledFee !== null && settledFee > 0 ? Math.round(settledFee) : Math.max(0, Math.round(goodsBasis * commissionRate));
          if (feeOut > 0) {
            const feeReversed = await tx.ledgerEntry.count({ where: { orderId: id, type: "fee", direction: "out" } });
            if (!feeReversed) {
              await tx.ledgerEntry.createMany({
                data: [{ partyName: "susej", partyRole: "platform", direction: "out", type: "fee", amount: feeOut, method: order.paymentMethod, status: "success", orderId: id, createdAt: new Date() }],
              });
            }
          }
          const shipOut = Math.max(0, Math.round(Number(order.amount ?? 0)) - Math.round(goodsBasis));
          if (shipOut > 0) {
            const shipReversed = await tx.ledgerEntry.count({ where: { orderId: id, type: "shipping", direction: "out" } });
            if (!shipReversed) {
              await tx.ledgerEntry.createMany({
                data: [{ partyName: "susej", partyRole: "platform", direction: "out", type: "shipping", amount: shipOut, method: order.paymentMethod, status: "success", orderId: id, createdAt: new Date() }],
              });
            }
          }
        }
        // Withdrawable-truth (money P0): ANY executed refund marks the order
        // refunded — wallet or COD. COD approvals claw the seller's credited
        // net but used to leave paymentStatus payable, so lifetimeNet kept
        // counting the order and the seller could withdraw it a second time.
        data.paymentStatus = "refunded";
        // Sticky refund: a pre-delivery approval must ALSO kill the order —
        // otherwise the seller advances placed→…→delivered afterwards, the
        // delivery branch credits the seller and flips paymentStatus back to
        // paid, resurrecting a refunded order into a payout. Undelivered +
        // approved = cancelled, with the pending COD legs voided like a
        // normal cancel.
        if (order.status !== "delivered") {
          data.status = "cancelled";
          data.deliveryStatus = "cancelled";
          if (isCodPayment && !paysFromWallet) {
            const vnow = new Date();
            const pendCharge = await tx.ledgerEntry.findFirst({ where: { orderId: id, type: "charge", direction: "out", status: "pending" } });
            if (pendCharge) {
              const voided = await tx.ledgerEntry.count({ where: { orderId: id, type: "charge", direction: "out", status: "cancelled" } });
              if (!voided) {
                await tx.ledgerEntry.createMany({
                  data: [{ partyName: order.buyerName, partyRole: "buyer", direction: "out", type: "charge", amount: Number((pendCharge as { amount?: unknown }).amount ?? order.amount ?? 0), method: order.paymentMethod, status: "cancelled", orderId: id, createdAt: vnow }],
                });
              }
            }
            const pendShip = await tx.ledgerEntry.findFirst({ where: { orderId: id, type: "shipping", direction: "in", status: "pending" } });
            if (pendShip) {
              const shipVoided = await tx.ledgerEntry.count({ where: { orderId: id, type: "shipping", direction: "out" } });
              if (!shipVoided) {
                await tx.ledgerEntry.createMany({
                  data: [{ partyName: "susej", partyRole: "platform", direction: "out", type: "shipping", amount: Number((pendShip as { amount?: unknown }).amount ?? 0), method: order.paymentMethod, status: "cancelled", orderId: id, createdAt: vnow }],
                });
              }
            }
          }
        }
        await tx.refund.update({ where: { id: pending.id }, data: { status: "approved", respondedAt: new Date() } });
      } else {
        await tx.refund.update({ where: { id: pending.id }, data: { status: "rejected", respondedAt: new Date() } });
      }
    }

    if (!Object.keys(data).length) return order;
    return tx.order.update({ where: { id }, data });
  }).catch((e: unknown) => {
    // Idempotency race: a concurrent retry already committed this movement
    // (UNIQUE username+title) — the whole loser tx rolled back, so re-read
    // the winner and report success instead of 500ing a settled order.
    if ((e as { code?: string })?.code === "P2002") {
      return { __dedupedRace: true } as never;
    }
    throw e;
  }).catch((e: unknown) => {
    // Business refusals must keep their status (403/400/409), never 500:
    // without this mapper every OrderError escaped as Internal Server Error
    // and the app showed a connectivity lie for a permission/validation no.
    if (e instanceof OrderError) {
      return { __refused: true, status: e.status, message: e.message } as never;
    }
    if (e instanceof Error && e.message === "Already reviewed") {
      return { __refused: true, status: 409, message: "Already reviewed" } as never;
    }
    throw e;
  });

  const refused = updated as unknown as { __refused?: boolean; status?: number; message?: string };
  if (refused?.__refused) {
    return NextResponse.json({ error: refused.message ?? "Request refused" }, { status: refused.status ?? 400 });
  }
  if ((updated as { __dedupedRace?: boolean }).__dedupedRace) {
    const winner = await prisma.order.findUnique({ where: { id } });
    return NextResponse.json({ ok: true, status: winner?.status ?? order.status, reviewed: winner?.reviewed ?? order.reviewed, deduped: true });
  }

  // Money-event tells (fire-and-forget, post-commit only — never inside the
  // money tx). Identity fields come from the pre-tx snapshot (immutable).
  {
    const t = order.trackingNumber;
    if (typeof body.refundReason === "string" && body.refundReason.trim() && order.sellerUsername) {
      notifyUser(prisma, {
        username: order.sellerUsername, type: "order", userName: order.buyerName, userHandle: order.buyerUsername ?? undefined,
        action: `requested a refund on ${t}`, targetId: t,
      });
    }
    if (typeof body.refundDecision === "string" && order.buyerUsername) {
      const approved = body.refundDecision.trim().toLowerCase() === "approved";
      notifyUser(prisma, {
        username: order.buyerUsername, type: "order", userName: order.sellerName, userHandle: order.sellerUsername ?? undefined,
        action: approved ? `approved your refund on ${t}` : `declined your refund on ${t}`, targetId: t,
      });
    }
    if (next && next !== "cancelled" && order.buyerUsername) {
      // Seller advances (adjacent-only, enforced above) → buyer hears it.
      const legible: Record<string, string> = {
        confirmed: `confirmed your order ${t}`,
        preparing: `started packing your order ${t}`,
        out_for_delivery: `shipped your order ${t}`,
        delivered: `delivered your order ${t}`,
      };
      if (legible[next]) {
        notifyUser(prisma, {
          username: order.buyerUsername, type: "order",
          userName: order.sellerName, userHandle: order.sellerUsername ?? undefined,
          action: legible[next], targetId: t,
        });
      }
    }
    if (next === "cancelled") {
      // Cancel by either side → the OTHER side hears it (buyer cancel also
      // tells the seller to stop packing; seller decline tells the buyer).
      const other = isBuyer ? order.sellerUsername : order.buyerUsername;
      if (other) {
        notifyUser(prisma, {
          username: other, type: "order",
          userName: isBuyer ? order.buyerName : order.sellerName,
          userHandle: isBuyer ? (order.buyerUsername ?? undefined) : (order.sellerUsername ?? undefined),
          action: isBuyer ? `cancelled order ${t} (refund issued)` : `declined order ${t} (refund issued)`,
          targetId: t,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, status: updated.status, reviewed: updated.reviewed });
}
