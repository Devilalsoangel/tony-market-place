import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { notifyUser } from "@/lib/notifications";

/** GET /api/app/disputes — my disputes (raised by or against me). */
export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = auth.user.username!;
  // Case-insensitive party match (write paths already are — an exact-match
  // list hid rows the PATCH lane would happily mutate).
  const rows = await prisma.dispute.findMany({
    where: {
      OR: [{ buyerName: { equals: username, mode: "insensitive" } }, { sellerName: { equals: username, mode: "insensitive" } }],
    },
    orderBy: { raisedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    disputes: rows.map((d) => ({
      id: d.id,
      orderRef: d.orderId,
      reason: d.reason,
      status: d.status,
      outcome: d.outcome,
      note: d.note,
      createdAt: d.raisedAt.getTime(),
    })),
  });
}

/** POST /api/app/disputes — raise a dispute on an order I'm party to.
// Previously app creations lived in device storage only: sellers, the
// platform and the admin desk never saw them. Now a real shared row.
// Identity + amount come from the ORDER (server truth), never the client. */
export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { orderRef?: string; reason?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const ref = String(body.orderRef ?? "").trim().replace(/^#/, "");
  const reason = String(body.reason ?? "").trim().slice(0, 120);
  const description = String(body.description ?? "").trim();
  if (!ref || !reason) {
    return NextResponse.json({ error: "orderRef and reason are required" }, { status: 400 });
  }
  const username = auth.user.username!;
  const hashedRef = `#${ref}`;
  const order = await prisma.order.findFirst({
    where: { OR: [{ id: ref }, { id: hashedRef }, { trackingNumber: ref }, { trackingNumber: hashedRef }, { orderNumber: ref }, { orderNumber: hashedRef }] },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  // Case-insensitive identity (same class as the order route: exact-match
  // 403d mixed-case owners while their UI allowed the action).
  const meLower = String(username ?? "").trim().toLowerCase();
  const partyBuyer = String(order.buyerUsername ?? "").trim().toLowerCase();
  const partySeller = String(order.sellerUsername ?? "").trim().toLowerCase();
  if (!meLower || (partyBuyer !== meLower && partySeller !== meLower)) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }
  // Terminal orders can't host a new dispute: cancelled/refunded rows have no
  // live money to rule on, and ruling stamps paymentStatus on a dead order
  // (phantom-mirror trigger). Resolved-then-reopened flows stay desk-side.
  if (String(order.status ?? "") === "cancelled" || String(order.paymentStatus ?? "") === "refunded") {
    return NextResponse.json({ error: "This order is already closed — contact support instead" }, { status: 400 });
  }
  // Serialized open-or-return: check-then-create double-tapped twin "open"
  // rows for one order (queue dupes + double seller pages). The order-row
  // lock serializes concurrent opens; the re-read inside observes committed
  // rows. Money stays safe either way (shared-title settlement guards), but
  // the desk queue must not fork.
  const outcome = await prisma.$transaction(async (tx: any) => {
    // No fail-open catch on the lock: a lock failure must abort the tx (503,
    // no row), never proceed to an unlocked check-then-create (twin rows).
    await tx.$queryRawUnsafe(`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`, order.id);
    // Terminal re-check INSIDE the lock: the pre-tx read races a concurrent
    // cancel (dispute opened on a dead order, ruling stamping mirrors on a
    // cancelled row). The lock serializes cancel-vs-dispute.
    const fresh = await tx.order.findUnique({ where: { id: order.id } });
    // Vanished mid-tx: no row to rule on — abort, never fall back to the
    // pre-tx snapshot (that fallback would recreate the race this re-read
    // closes) and never proceed on a read blip.
    if (!fresh) throw new Error("ORDER_CLOSED");
    const freshStatus = String(fresh.status ?? "");
    const freshPay = String((fresh as { paymentStatus?: unknown }).paymentStatus ?? "");
    if (freshStatus === "cancelled" || freshPay === "refunded") {
      throw new Error("ORDER_CLOSED");
    }
    const open = await tx.dispute.findFirst({
      where: { orderId: order.trackingNumber, status: { in: ["open", "under_review"] } },
    });
    if (open) {
      return { dispute: { id: open.id, orderRef: open.orderId, reason: open.reason, status: open.status }, status: 200 as const };
    }
    const created = await tx.dispute.create({
      data: {
        orderId: order.trackingNumber,
        buyerName: order.buyerUsername ?? order.buyerName,
        sellerName: order.sellerUsername ?? order.sellerName,
        // The free-text complaint rides with the reason (the model has no
        // separate body field); desk reads the full string.
        reason: description ? `${reason} — ${description.slice(0, 400)}` : reason,
        amount: Number(order.amount ?? 0),
        status: "open",
        raisedAt: new Date(),
      } as never,
    });
    return { dispute: { id: created.id, orderRef: created.orderId, reason: created.reason, status: created.status }, status: 201 as const };
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === "ORDER_CLOSED") {
      return { dispute: null, status: 400 as const, closed: true as const };
    }
    throw e;
  });
  const created = outcome;
  if ((created as { closed?: boolean }).closed || !created.dispute) {
    return NextResponse.json({ error: "This order is already closed — contact support instead" }, { status: 400 });
  }
  const dispute = created.dispute;
  // Counterparty tell (fire-and-forget): disputes otherwise sit silent until
  // someone polls the list.
  if (created.status === 201) {
    // Lowercase compare (party check above is): exact === resolved the
    // counterparty to the CALLER on mixed-case usernames — the seller was
    // never told, on the exact path built to replace polling.
    const buyerLower = String(order.buyerUsername ?? "").trim().toLowerCase();
    const counterparty = buyerLower === meLower ? order.sellerUsername : order.buyerUsername;
    const counterName = buyerLower === meLower ? order.sellerName : order.buyerName;
    if (counterparty) {
      notifyUser(prisma, {
        username: counterparty, type: "order",
        userName: auth.user.name, userHandle: username,
        action: `opened a dispute on ${order.trackingNumber} (${reason})`,
        target: counterName, targetId: order.trackingNumber,
      });
    }
  }
  return NextResponse.json(
    {
      dispute: {
        id: dispute.id,
        orderRef: dispute.orderRef,
        reason: dispute.reason,
        status: dispute.status,
      },
    },
    { status: created.status }
  );
}
