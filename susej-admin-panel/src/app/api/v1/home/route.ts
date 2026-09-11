import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { getPrisma } from "@/lib/db";
import { lazySweep } from "@/lib/promotions/activate";

const ACTIVE = "active";

export async function GET(request: NextRequest) {
  if (!checkAppKey(request)) return unauthorized();

  await lazySweep();
  const prisma = await getPrisma();
  // FAIL HONEST: DB unreachable → empty payload + degraded flag. No mock data.
  if (!prisma) {
    return NextResponse.json(
      {
        topSellers: [],
        hotDeals: [],
        marketingBanners: [],
        degraded: true,
      },
      { status: 200 }
    );
  }

  const [topSellers, hotDeals, marketingBanners] = await Promise.all([
    prisma.topSeller.findMany({ where: { status: ACTIVE }, orderBy: { position: "asc" } }),
    prisma.hotDeal.findMany({ where: { status: ACTIVE }, orderBy: { priority: "asc" } }),
    // Marketing banners: seller-uploaded banner images from the seller dashboard,
    // synced into storefrontBanner. Ordered by explicit position (lower first,
    // nulls last) then newest. This is the ONLY hero source — post marketing
    // (featured posts) was removed.
    prisma.storefrontBanner.findMany({
      where: { status: ACTIVE },
      orderBy: [{ position: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    }),
  ]);

  return NextResponse.json({
    topSellers: topSellers.map((t) => ({
      sellerId: t.sellerId,
      sellerName: t.sellerName,
      sellerLogo: t.sellerLogo,
      totalSales: t.totalSales,
      rating: t.rating,
      reviewCount: t.reviewCount,
      position: t.position,
      isPinned: t.isPinned,
    })),
    hotDeals: hotDeals.map((d) => ({
      productId: d.productId,
      productName: d.productName,
      productImage: d.productImage,
      originalPrice: d.originalPrice,
      discountedPrice: d.discountedPrice,
      discountPercentage: d.discountPercentage,
      priority: d.priority,
    })),
    marketingBanners: marketingBanners.map((b) => ({
      id: b.id,
      sellerUsername: b.sellerUsername,
      sellerName: b.sellerName,
      title: b.title,
      subtitle: b.subtitle,
      ctaLabel: b.ctaLabel,
      imageUrl: b.imageUrl,
      size: b.size,
      position: b.position,
    })),
  });
}
