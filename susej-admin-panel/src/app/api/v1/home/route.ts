import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { getPrisma } from "@/lib/db";
import { lazySweep } from "@/lib/promotions/activate";
import { mockTopSellers, mockHotDeals, mockFeaturedPosts } from "@/home-management/lib/mockData";

const ACTIVE = "active";

export async function GET(request: NextRequest) {
  if (!checkAppKey(request)) return unauthorized();

  await lazySweep();
  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json({
      topSellers: mockTopSellers.filter((t) => t.status === ACTIVE).map((t) => ({
        sellerId: t.sellerId,
        sellerName: t.sellerName,
        sellerLogo: t.sellerLogo,
        totalSales: t.totalSales,
        rating: t.rating,
        reviewCount: t.reviewCount,
        position: t.position,
        isPinned: t.isPinned,
      })),
      hotDeals: mockHotDeals.filter((d) => d.status === ACTIVE).map((d) => ({
        productId: d.productId,
        productName: d.productName,
        productImage: d.productImage,
        originalPrice: d.originalPrice,
        discountedPrice: d.discountedPrice,
        discountPercentage: d.discountPercentage,
        priority: d.priority,
      })),
      featuredPosts: mockFeaturedPosts.filter((p) => p.status === ACTIVE).map((p) => ({
        postId: p.postId,
        title: p.title,
        excerpt: p.excerpt,
        imageUrl: p.imageUrl,
        position: p.position,
        isPinned: p.isPinned,
      })),
    });
  }

  const [topSellers, hotDeals, featuredPosts] = await Promise.all([
    prisma.topSeller.findMany({ where: { status: ACTIVE }, orderBy: { position: "asc" } }),
    prisma.hotDeal.findMany({ where: { status: ACTIVE }, orderBy: { priority: "asc" } }),
    prisma.featuredPost.findMany({ where: { status: ACTIVE }, orderBy: { position: "asc" } }),
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
    featuredPosts: featuredPosts.map((p) => ({
      postId: p.postId,
      title: p.title,
      excerpt: p.excerpt,
      imageUrl: p.imageUrl,
      position: p.position,
      isPinned: p.isPinned,
    })),
  });
}