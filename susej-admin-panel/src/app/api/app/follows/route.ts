import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const [rows, counts, followerRows] = await Promise.all([
    prisma.follow.findMany({
      where: { follower: auth.user.username! },
      orderBy: { createdAt: "desc" },
    }),
    prisma.follow.groupBy({ by: ["followed"], _count: { followed: true } }),
    prisma.follow.findMany({
      where: { followed: auth.user.username! },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const followerCounts: Record<string, number> = {};
  for (const c of counts) followerCounts[c.followed] = c._count.followed;
  return NextResponse.json({
    followed: rows.map((r) => r.followed),
    followerCounts,
    followers: followerRows.map((r) => r.follower),
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { followed?: string; unfollow?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const followed = (body.followed ?? "").trim();
  if (!followed || followed === auth.user.username) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { username: followed } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (body.unfollow) {
    await prisma.follow.deleteMany({ where: { follower: auth.user.username!, followed } });
    return NextResponse.json({ following: false });
  }
  const existing = await prisma.follow.findUnique({
    where: { follower_followed: { follower: auth.user.username!, followed } },
  });
  await prisma.follow.upsert({
    where: { follower_followed: { follower: auth.user.username!, followed } },
    update: {},
    create: { follower: auth.user.username!, followed },
  });
  // notify only on new follow (idempotent retry must not spam)
  if (!existing) {
    await prisma.userNotification.create({
      data: {
        username: followed,
        type: "follower",
        userName: auth.user.name,
        userHandle: auth.user.username,
        action: "started following you",
        target: "store",
      },
    });
  }
  return NextResponse.json({ following: true });
}