import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

/** GET /api/app/storefront-banners?seller=<username> — PUBLIC read-only.
 *  A seller's hero banners must render on EVERY buyer's device, not just the
 *  seller's own phone (the editor syncs them here; per-device AsyncStorage
 *  can never be the cross-device truth). Active rows only, bounded. */
export async function GET(req: NextRequest) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const seller = (req.nextUrl.searchParams.get("seller") ?? "").trim().slice(0, 60);
  if (!seller) return NextResponse.json({ error: "seller is required" }, { status: 400 });

  const rows = await prisma.storefrontBanner.findMany({
    where: { sellerUsername: seller, status: "active" },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take: 10,
  });

  return NextResponse.json({
    banners: rows.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      ctaLabel: b.ctaLabel,
      imageUrl: b.imageUrl,
      imageIndex: b.imageIndex,
      size: b.size,
      position: b.position,
    })),
  });
}
