import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { resolveCommissionRate, settlementGoodsBasis, settledFeeFromLegs } from "@/lib/commission";

class OrderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ORDER_FLOW = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;

/** Ledger titles double as idempotency guards so a movement can never run twice. */
const refundTxTitle = (tracking: string) => `Order cancelled - refund · ${tracking}`;
const clawbackTxTitle = (tracking: string) => `Order cancelled clawback · ${tracking}`;
const earningsTxTitle = (tracking: string) => `Order earnings · ${tracking}`;

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
  if (next) {
    const curIdx = ORDER_FLOW.indexOf(order.status as never);
    const nextIdx = ORDER_FLOW.indexOf(next as never);
    const allowed =
      next === "cancelled"
        ? isBuyer && ["placed", "confirmed"].includes(order.status)
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
      if (paysFromWallet && order.buyerUsername && order.amount > 0) {
        const alreadyRefunded = await tx.walletTransaction.count({
          where: { username: order.buyerUsername, title: refundTxTitle(tracking) },
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
          where: { username: order.sellerUsername, title: clawbackTxTitle(tracking) },
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
        if (lrows.length) await tx.ledgerEntry.createMany({ data: lrows }).catch(() => {});
      }
    } else if (next === "delivered") {
      data.status = "delivered";
      data.deliveryStatus = "delivered";

      // COD settlement: cash changes hands on delivery - credit the seller
      // net exactly once and record the payment as collected.
      if (isCodPayment && order.sellerUsername) {
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
              detail: `${order.buyerName} · COD collected on delivery · net after ${settledFee !== null && goodsBasis > 0 ? Math.round((settledFee / goodsBasis) * 1000) / 10 : Math.round(commissionRate * 100)}% commission`,
              amount: sellerNet,
            },
          });
          data.paymentStatus = "paid";
          // Ledger mirror: COD cash settles on delivery (charge flips to
          // success, seller settlement + platform fee land now).
          const dnow = new Date();
          await tx.ledgerEntry.createMany({
            data: [
              { partyName: order.buyerName, partyRole: "buyer", direction: "out", type: "charge", amount: order.amount, method: order.paymentMethod, status: "success", orderId: id, createdAt: dnow },
              { partyName: order.sellerUsername, partyRole: "seller", direction: "in", type: "settlement", amount: sellerNet, method: order.paymentMethod, status: "success", orderId: id, createdAt: dnow },
              ...(order.amount - sellerNet > 0
                ? [{ partyName: "susej", partyRole: "platform", direction: "in", type: "fee", amount: order.amount - sellerNet, method: order.paymentMethod, status: "success", orderId: id, createdAt: dnow }]
                : []),
            ],
          }).catch(() => {});
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
      if (order.reviewed) throw new Error("Already reviewed");
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
        if (paysFromWallet && order.buyerUsername && order.amount > 0) {
          const alreadyRefunded = await tx.walletTransaction.count({
            where: { username: order.buyerUsername, title: refundTitle },
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
              }).catch(() => {});
            }
          }
        }
        if (!isCodPayment && order.sellerUsername) {
          const wasCredited = await tx.walletTransaction.count({
            where: { username: order.sellerUsername, title: `Order earnings · ${tracking}` },
          });
          const alreadyClawed = await tx.walletTransaction.count({
            where: { username: order.sellerUsername, title: clawTitle },
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
              }).catch(() => {});
            }
          }
        }
        if (paysFromWallet) data.paymentStatus = "refunded";
        await tx.refund.update({ where: { id: pending.id }, data: { status: "approved", respondedAt: new Date() } });
      } else {
        await tx.refund.update({ where: { id: pending.id }, data: { status: "rejected", respondedAt: new Date() } });
      }
    }

    if (!Object.keys(data).length) return order;
    return tx.order.update({ where: { id }, data });
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === "Already reviewed") throw e;
    throw e;
  });

  return NextResponse.json({ ok: true, status: updated.status, reviewed: updated.reviewed });
}
