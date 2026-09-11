import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const comment = await prisma.postComment.findFirst({ where: { id: cid, postId: id } });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  const post = await prisma.post.findUnique({ where: { id }, select: { authorUsername: true } });
  const isOwner = comment.username === auth.user.username;
  const isPostOwner = post?.authorUsername === auth.user.username;
  if (!isOwner && !isPostOwner) return NextResponse.json({ error: "Not authorized to delete this comment" }, { status: 403 });

  await prisma.$transaction(async (tx) => {
    await tx.postComment.delete({ where: { id: cid } });
    await tx.post.update({ where: { id }, data: { comments: { decrement: 1 } } });
  });

  return NextResponse.json({ ok: true });
}
