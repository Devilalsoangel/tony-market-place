import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

// GET: who liked this post (real usernames from PostLike rows) — powers the
// Instagram-style "long-press the heart" likers bottom sheet.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  // Guard: only return likers for published posts — prevents leaking draft content.
  const post = await prisma.post.findUnique({ where: { id }, select: { status: true } });
  if (!post || post.status !== "published") {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  const rows = await prisma.postLike.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
  });
  const usernames = rows.map((r) => r.username).filter(Boolean);
  const users = usernames.length
    ? await prisma.user.findMany({
        where: { username: { in: usernames } },
        select: { username: true, name: true },
      })
    : [];
  const nameMap = new Map(users.map((u) => [u.username, u.name]));
  return NextResponse.json({
    likes: rows.map((r) => ({
      username: r.username,
      name: nameMap.get(r.username ?? "") ?? r.username,
    })),
  });
}

// Toggle like on a post (real multi-user likes + notification to author)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.status !== "published") return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Atomic toggle via transaction so concurrent double-taps don't drift likes count.
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.postLike.findUnique({
      where: { postId_username: { postId: id, username: auth.user.username! } },
    });
    let liked: boolean;
    if (existing) {
      await tx.postLike.delete({ where: { id: existing.id } });
      const updated = await tx.post.update({ where: { id }, data: { likes: { decrement: 1 } } });
      // Guard against negative drift from legacy race
      if (updated.likes < 0) await tx.post.update({ where: { id }, data: { likes: 0 } });
      liked = false;
    } else {
      await tx.postLike.create({ data: { postId: id, username: auth.user.username! } });
      await tx.post.update({ where: { id }, data: { likes: { increment: 1 } } });
      liked = true;
    }
    const fresh = await tx.post.findUnique({ where: { id }, select: { likes: true } });
    return { liked: liked!, likes: fresh?.likes ?? 0 };
  });

  // Case-insensitive self check (mixed-case owners liking their own post
  // used to notify themselves).
  const likeCaller = String(auth.user.username ?? "").trim().toLowerCase();
  const likeOwner = String(post.authorUsername ?? "").trim().toLowerCase();
  if (result.liked && post.authorUsername && likeOwner !== likeCaller) {
    // Dedupe: an UNREAD twin from the same actor on the same post already
    // tells the story — unlike→like loops used to ping the author per toggle.
    // (A read twin means genuine renewed attention: notify again.)
    const twin = await prisma.userNotification.findFirst({
      where: {
        username: post.authorUsername,
        type: "like",
        targetId: id,
        userHandle: auth.user.username!,
        read: false,
      },
      select: { id: true },
    }).catch(() => null);
    if (!twin) {
      // fire-and-forget notification outside transaction
      prisma.userNotification
        .create({
          data: {
            username: post.authorUsername,
            type: "like",
            userName: auth.user.name,
            userHandle: auth.user.username,
            action: "liked your listing",
            target: post.title,
            targetId: id,
          },
        })
        .catch(() => {});
    }
  }

  return NextResponse.json(result);
}