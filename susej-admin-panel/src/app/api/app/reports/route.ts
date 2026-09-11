import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

/**
 * POST /api/app/reports { postId, reason }
 * Buyer/seller report-a-listing that actually lands in the admin moderation
 * queue (ReportedProduct) — the app previously showed "Report submitted"
 * while writing only to device storage. Repeat reports by the same user on
 * the same listing bump reportCount instead of duplicating rows.
 */
export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { postId?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const postId = String(body.postId ?? "").trim().slice(0, 60);
  const reason = String(body.reason ?? "Reported from app").trim().slice(0, 240) || "Reported from app";
  if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, title: true, authorName: true },
  });
  if (!post) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const reporter = auth.user.username!;
  const existing = await prisma.reportedProduct.findFirst({
    where: { productId: postId, reporter },
  });
  if (existing) {
    const row = await prisma.reportedProduct.update({
      where: { id: existing.id },
      data: { reportCount: existing.reportCount + 1, reason },
    });
    return NextResponse.json({ ok: true, id: row.id, reports: row.reportCount });
  }
  const row = await prisma.reportedProduct.create({
    data: {
      productId: postId,
      title: post.title,
      sellerName: post.authorName,
      reason,
      reporter,
      reportCount: 1,
      createdAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true, id: row.id, reports: 1 }, { status: 201 });
}
