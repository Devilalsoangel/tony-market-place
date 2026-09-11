import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";
import { validateMediaRefs } from "@/lib/media";

/**
 * Seller reels, server-distributed (Instagram pattern). Reels were previously
 * device-local only: a seller "published" and no buyer or admin ever saw it.
 * POST requires a seller account; GET serves published reels, optionally
 * filtered by seller username for storefronts and the reels rail.
 */
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const seller = req.nextUrl.searchParams.get("seller")?.trim() || undefined;
  const take = Math.min(Number(req.nextUrl.searchParams.get("take") ?? 50) || 50, 50);
  const rows = await prisma.reel.findMany({
    where: {
      status: "published",
      ...(seller ? { creatorUsername: seller } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json({
    reels: rows.map((r) => ({
      id: r.id,
      title: r.title,
      caption: r.caption ?? "",
      mediaUrl: r.mediaUrl ?? "",
      creatorName: r.creatorName,
      creatorUsername: r.creatorUsername ?? "",
      views: r.views,
      likes: r.likes,
      createdAt: r.createdAt.getTime(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!auth.user.isSeller) {
    return NextResponse.json({ error: "Only sellers can publish reels" }, { status: 403 });
  }
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const caption = String(body.caption ?? "").trim().slice(0, 300);
  const rawMedia = Array.isArray(body.mediaUrl)
    ? (body.mediaUrl as unknown[])
    : typeof body.mediaUrl === "string"
      ? [body.mediaUrl]
      : typeof body.image === "string"
        ? [body.image]
        : [];
  // Cover must already be hosted (client uploads first) — local file:// URIs
  // are unviewable on any other device and are rejected, same as listings.
  const mediaCheck = validateMediaRefs(rawMedia as string[], { min: 1, max: 1, field: "reel cover" });
  if (!mediaCheck.ok) {
    return NextResponse.json({ error: mediaCheck.error }, { status: 400 });
  }
  const row = await prisma.reel.create({
    data: {
      title: caption.slice(0, 80) || "New reel",
      caption,
      mediaUrl: mediaCheck.urls[0],
      creatorName: auth.user.businessName || auth.user.name,
      creatorUsername: auth.user.username!,
      views: 0,
      likes: 0,
      status: "published",
      createdAt: new Date(),
    },
  });
  return NextResponse.json(
    {
      reel: {
        id: row.id,
        title: row.title,
        caption: row.caption ?? "",
        mediaUrl: row.mediaUrl ?? "",
        creatorName: row.creatorName,
        creatorUsername: row.creatorUsername ?? "",
      },
    },
    { status: 201 }
  );
}
