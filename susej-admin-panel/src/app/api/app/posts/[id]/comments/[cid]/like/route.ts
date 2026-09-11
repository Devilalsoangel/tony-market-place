import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

// Toggle a like on a single comment. Idempotent: liking twice un-likes.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const me = String(auth.user.username ?? "");
  const postCheck = await prisma.post.findUnique({ where: { id }, select: { status: true } });
  if (!postCheck || postCheck.status !== "published") return NextResponse.json({ error: "Post not available" }, { status: 404 });
  // Wrap read-modify-write in a transaction so concurrent likes serialize.
  const txResult = await prisma
    .$transaction(async (tx) => {
      const c = await tx.postComment.findFirst({ where: { id: cid, postId: id } });
      if (!c) throw new Error("NOT_FOUND");
      const isAlready = c.likedBy.includes(me);
      const nextLikedBy = isAlready ? c.likedBy.filter((u: string) => u !== me) : [...c.likedBy, me];
      const up = await tx.postComment.update({
        where: { id: cid },
        data: { likedBy: nextLikedBy, likes: nextLikedBy.length },
      });
      return { comment: c, already: isAlready, updated: up };
    })
    .catch((e: unknown) => {
      if (e instanceof Error && e.message === "NOT_FOUND") return null;
      throw e;
    });
  if (!txResult) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  const { comment, already, updated } = txResult;

  // Notify the comment author when someone else likes their comment (once per like).
  if (!already && comment.username && comment.username !== me) {
    const post = await prisma.post.findUnique({ where: { id }, select: { title: true } });
    await prisma.userNotification
      .create({
        data: {
          username: comment.username,
          type: "like",
          userName: auth.user.name,
          userHandle: me,
          action: "liked your comment",
          target: post?.title ?? "",
          targetId: id,
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({ likes: updated.likes, likedByMe: !already });
}
