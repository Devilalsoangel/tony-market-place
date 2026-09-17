import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

/** GET /api/app/disputes — my disputes (raised by or against me). */
export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = auth.user.username!;
  const rows = await prisma.dispute.findMany({
    where: {
      OR: [{ buyerName: username }, { sellerName: username }],
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
  if (order.buyerUsername !== username && order.sellerUsername !== username) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }
  const open = await prisma.dispute.findFirst({
    where: { orderId: order.trackingNumber, status: { in: ["open", "under_review"] } },
  });
  if (open) {
    return NextResponse.json(
      { dispute: { id: open.id, orderRef: open.orderId, reason: open.reason, status: open.status } },
      { status: 200 }
    );
  }
  const created = await prisma.dispute.create({
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
  return NextResponse.json(
    {
      dispute: {
        id: created.id,
        orderRef: created.orderId,
        reason: created.reason,
        status: created.status,
      },
    },
    { status: 201 }
  );
}
