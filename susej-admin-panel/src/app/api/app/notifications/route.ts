import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const rows = await prisma.userNotification.findMany({
    where: { username: auth.user.username! },
    orderBy: { timestamp: "desc" },
    take: 100,
  });
  return NextResponse.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      userName: n.userName,
      userHandle: n.userHandle ?? undefined,
      action: n.action,
      target: n.target ?? undefined,
      targetId: n.targetId ?? undefined,
      timestamp: n.timestamp.getTime(),
      read: n.read,
    })),
    unreadCount: rows.filter((r) => !r.read).length,
  });
}

// Mark notifications read (all or one)
export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (body.id) {
    await prisma.userNotification.updateMany({
      where: { id: body.id, username: auth.user.username! },
      data: { read: true },
    });
  } else {
    await prisma.userNotification.updateMany({
      where: { username: auth.user.username!, read: false },
      data: { read: true },
    });
  }
  return NextResponse.json({ ok: true });
}