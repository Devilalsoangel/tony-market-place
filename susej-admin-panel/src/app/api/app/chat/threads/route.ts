import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = auth.user.username!;
  const threads = await prisma.chatThread.findMany({
    where: { OR: [{ participantA: username }, { participantB: username }] },
    orderBy: { lastAt: "desc" },
    take: 100,
  });

  const unreadRows = await prisma.chatMessage.findMany({
    where: {
      threadId: { in: threads.map((t) => t.id) },
      receiver: username,
      status: { not: "seen" },
    },
    select: { threadId: true },
  });
  const unreadMap = new Map<string, number>();
  unreadRows.forEach((r) => unreadMap.set(r.threadId, (unreadMap.get(r.threadId) ?? 0) + 1));

  // Inbound pending offers per thread (single query): powers the Offers
  // filter + badges honestly on every device — no client-side inference.
  const pendingRows = await prisma.chatMessage.findMany({
    where: {
      threadId: { in: threads.map((t) => t.id) },
      offerStatus: "pending",
      sender: { not: username },
    },
    select: { threadId: true },
  });
  const pendingSet = new Set(pendingRows.map((r) => r.threadId));

  const out = await Promise.all(
    threads.map(async (t) => {
      const other = t.participantA === username ? t.participantB : t.participantA;
      const otherUser = await prisma.user.findUnique({ where: { username: other } });
      // Display identity consistent with feed/storefront: sellers show their
      // business name, everyone else falls back to their profile name.
      const displayName = otherUser?.businessName?.trim() || otherUser?.name || other;
      return {
        id: t.id,
        otherUsername: other,
        otherName: displayName,
        otherAvatar: otherUser?.avatar ?? undefined,
        lastMessage: t.lastMessage ?? "",
        lastAt: t.lastAt.getTime(),
        unread: unreadMap.get(t.id) ?? 0,
        hasPendingOffer: pendingSet.has(t.id),
        // Pinned-chat VAS: ms epoch while an active paid pin exists, else null.
        pinnedUntil: t.pinnedUntil ? t.pinnedUntil.getTime() : null,
      };
    })
  );
  return NextResponse.json({ threads: out });
}

export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { participant?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const username = auth.user.username!;
  const other = (body.participant ?? "").trim();
  if (!other || other === username) return NextResponse.json({ error: "Invalid participant" }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { username: other } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let thread = await prisma.chatThread.findFirst({
    where: {
      OR: [
        { participantA: username, participantB: other },
        { participantA: other, participantB: username },
      ],
    },
  });
  if (!thread) {
    // Industry: canonical ordering eliminates duplicate thread (A,B vs B,A)
    // which the @@unique([participantA, participantB]) alone cannot prevent.
    const [pA, pB] = [username, other].sort((a, b) => a.localeCompare(b));
    try {
      thread = await prisma.chatThread.create({
        data: { participantA: pA, participantB: pB },
      });
    } catch (e: unknown) {
      // Concurrent creation race: another request inserted the thread first.
      // Re-fetch the existing row instead of 500.
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Unique constraint") || (e as { code?: string })?.code === "P2002") {
        thread = await prisma.chatThread.findFirst({
          where: {
            OR: [
              { participantA: username, participantB: other },
              { participantA: other, participantB: username },
            ],
          },
        });
      }
      if (!thread) throw e;
    }
  }
  return NextResponse.json({ thread: { id: thread.id, otherUsername: other } }, { status: 201 });
}