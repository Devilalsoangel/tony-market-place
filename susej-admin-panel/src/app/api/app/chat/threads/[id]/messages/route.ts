import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const thread = await prisma.chatThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  const username = auth.user.username!;
  if (thread.participantA !== username && thread.participantB !== username) {
    return NextResponse.json({ error: "Not your thread" }, { status: 403 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { threadId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  // mark received messages as seen
  await prisma.chatMessage.updateMany({
    where: { threadId: id, receiver: username, status: { not: "seen" } },
    data: { status: "seen" },
  });
  return NextResponse.json({
    threadId: id,
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      receiver: m.receiver,
      body: m.body,
      status: m.status,
      createdAt: m.createdAt.getTime(),
      offer:
        typeof (m as unknown as { offerAmount?: number }).offerAmount === "number"
          ? {
              amount: (m as unknown as { offerAmount: number }).offerAmount,
              productId: String((m as unknown as { offerProductId?: string }).offerProductId ?? ""),
              productName: String((m as unknown as { offerProductName?: string }).offerProductName ?? "Item"),
              status: String((m as unknown as { offerStatus?: string }).offerStatus ?? "pending"),
            }
          : null,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const thread = await prisma.chatThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  const username = auth.user.username!;
  // Only thread participants may post into it.
  if (thread.participantA !== username && thread.participantB !== username) {
    return NextResponse.json({ error: "Not your thread" }, { status: 403 });
  }
  const receiver = thread.participantA === username ? thread.participantB : thread.participantA;

  let body: { body?: string; offer?: { amount?: unknown; productId?: unknown; productName?: unknown } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // Optional structured price offer (validated; stored in columns + mirrored
  // as human-readable body text so every surface renders something sane).
  let offerData: { offerAmount: number; offerProductId: string; offerProductName: string; offerStatus: string } | null = null;
  if (body.offer !== undefined) {
    const o = body.offer as { amount?: unknown; productId?: unknown; productName?: unknown };
    const amount = Number(o.amount);
    const productId = String(o.productId ?? "").trim();
    const productName = String(o.productName ?? "").trim().slice(0, 200) || "Item";
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      return NextResponse.json({ error: "Invalid offer amount" }, { status: 400 });
    }
    if (!productId) return NextResponse.json({ error: "Offer needs a listing" }, { status: 400 });
    offerData = { offerAmount: Math.round(amount), offerProductId: productId, offerProductName: productName, offerStatus: "pending" };
  }
  const text = String(body.body ?? "").trim() || (offerData ? `Offer ${offerData.offerAmount} for ${offerData.offerProductName}` : "");
  if (!text) return NextResponse.json({ error: "Message required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Message too long (max 2000)" }, { status: 400 });

  const message = await prisma.chatMessage.create({
    data: { threadId: id, sender: username, receiver, body: text, ...(offerData ?? {}) },
  });
  await prisma.chatThread.update({
    where: { id },
    data: { lastMessage: text, lastAt: new Date() },
  });
  return NextResponse.json(
    {
      message: {
        id: message.id,
        sender: message.sender,
        receiver: message.receiver,
        body: message.body,
        status: message.status,
        createdAt: message.createdAt.getTime(),
        offer: offerData
          ? { amount: offerData.offerAmount, productId: offerData.offerProductId, productName: offerData.offerProductName, status: "pending" }
          : null,
      },
    },
    { status: 201 }
  );
}

/** PATCH — accept / decline / counter a pending offer (either participant). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const thread = await prisma.chatThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  const username = auth.user.username!;
  if (thread.participantA !== username && thread.participantB !== username) {
    return NextResponse.json({ error: "Not your thread" }, { status: 403 });
  }

  let body: { messageId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const messageId = String(body.messageId ?? "");
  const next = String(body.status ?? "");
  if (!["accepted", "declined", "countered"].includes(next)) {
    return NextResponse.json({ error: "Invalid offer status" }, { status: 400 });
  }
  const msg = await prisma.chatMessage.findFirst({ where: { id: messageId, threadId: id } });
  if (!msg || typeof (msg as unknown as { offerAmount?: unknown }).offerAmount !== "number") {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }
  if ((msg as unknown as { offerStatus?: string }).offerStatus !== "pending") {
    return NextResponse.json({ error: "Offer already decided" }, { status: 409 });
  }
  await prisma.chatMessage.update({ where: { id: messageId }, data: { offerStatus: next } });
  return NextResponse.json({ ok: true, status: next });
}