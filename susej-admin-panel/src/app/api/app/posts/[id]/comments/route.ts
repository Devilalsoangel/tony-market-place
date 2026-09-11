import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  // Guard: only return comments for published posts — prevents leaking draft content.
  const post = await prisma.post.findUnique({ where: { id }, select: { status: true } });
  if (!post || post.status !== "published") {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  const rows = await prisma.postComment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  // Viewer may be absent (public read) — likedByMe is then simply false.
  const viewer = await getAppUser(req).catch(() => null);
  const me = viewer?.user?.username ?? null;
  return NextResponse.json({
    comments: rows.map((c) => ({
      id: c.id,
      author: c.author,
      username: c.username ?? null,
      parentId: c.parentId ?? null,
      text: c.text,
      likes: c.likes,
      likedByMe: me ? c.likedBy.includes(me) : false,
      time: c.createdAt.getTime(),
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { text?: string; parentId?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Comment text required" }, { status: 400 });
  if (text.length > 800) return NextResponse.json({ error: "Comment too long (max 800)" }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "published") return NextResponse.json({ error: "Post not available" }, { status: 404 });

  // Idempotency: reject identical text from same user within 30s (double-tap / retry)
  const recentDup = await prisma.postComment.findFirst({
    where: { postId: id, username: auth.user.username, text, createdAt: { gte: new Date(Date.now() - 30_000) } },
  });
  if (recentDup) return NextResponse.json({ error: "Duplicate comment — please wait before posting again" }, { status: 409 });

  // Replies must reference a comment on the SAME post (no cross-post threads).
  const parentId = body.parentId ? String(body.parentId) : null;
  if (parentId) {
    const parent = await prisma.postComment.findFirst({ where: { id: parentId, postId: id } });
    if (!parent) return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
  }

  // Seller dual-persona commenting: a verified seller may speak as their
  // STORE (businessName) instead of their personal profile. Guarded - the
  // requested persona must EXACTLY match this account's own business name,
  // so nobody can comment as someone else.
  const wantStore =
    typeof body.displayName === "string" &&
    auth.user.isSeller === true &&
    !!auth.user.businessName &&
    body.displayName === auth.user.businessName;
  const displayAuthor = wantStore ? auth.user.businessName! : auth.user.name;

  const comment = await prisma.$transaction(async (tx) => {
    const c = await tx.postComment.create({
      data: { postId: id, author: displayAuthor, username: auth.user.username, parentId, text },
    });
    await tx.post.update({ where: { id }, data: { comments: { increment: 1 } } });
    return c;
  });
  if (post.authorUsername && post.authorUsername !== auth.user.username) {
    await prisma.userNotification.create({
      data: {
        username: post.authorUsername,
        type: "comment",
        userName: displayAuthor,
        userHandle: auth.user.username,
        action: "commented on your listing",
        target: post.title,
        targetId: id,
      },
    });
  }
  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        author: comment.author,
        username: comment.username ?? null,
        parentId: comment.parentId ?? null,
        text: comment.text,
        likes: comment.likes,
        likedByMe: false,
        time: comment.createdAt.getTime(),
      },
    },
    { status: 201 }
  );
}
