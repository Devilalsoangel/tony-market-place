import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [posts, followerCount, followingCount, reviewAgg, sellerOrders, storefrontReviews] = await Promise.all([
    prisma.post.findMany({
      where: { authorUsername: username, status: "published" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.follow.count({ where: { followed: username } }),
    prisma.follow.count({ where: { follower: username } }),
    prisma.review.aggregate({
      where: { sellerUsername: username },
      _avg: { rating: true },
      _count: { id: true },
    }),
    prisma.order.findMany({
      where: { sellerUsername: username, status: "delivered" },
      select: { itemsList: true },
    }),
    // Real post-delivery buyer reviews shown on the public storefront.
    prisma.review.findMany({
      where: { sellerUsername: username, status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, reviewerName: true, rating: true, text: true, productName: true, createdAt: true },
    }),
  ]);

  const avgRating = reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 0;
  const reviewCount = reviewAgg._count.id;
  let soldUnits = 0;
  for (const o of sellerOrders) {
    const items = Array.isArray(o.itemsList) ? (o.itemsList as { qty?: number; quantity?: number }[]) : [];
    for (const it of items) soldUnits += Number(it?.qty ?? it?.quantity ?? 1);
  }

  return NextResponse.json({
    user: {
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio ?? "",
      location: user.location ?? "",
      isSeller: user.isSeller,
      businessName: user.businessName ?? "",
      category: user.category ?? "",
      verification: user.verification,
      joinedAt: user.joinedAt.toISOString(),
      followers: followerCount,
      following: followingCount,
      posts: posts.length,
      avgRating,
      reviewCount,
      soldUnits,
    },
    posts: posts.map((p) => ({
      id: p.id,
      sellerName: p.authorName,
      sellerUsername: p.authorUsername ?? "",
      sellerLocation: p.sellerLocation ?? "",
      verified: p.verified,
      price: p.price ?? 0,
      description: p.description ?? "",
      category: p.category ?? "",
      type: p.type,
      hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
      images: Array.isArray(p.images) ? p.images : [],
      likes: p.likes,
      comments: p.comments,
      createdAt: p.createdAt.getTime(),
      isSold: p.isSold,
      featured: p.featured,
    })),
    reviews: storefrontReviews.map((r) => ({
      id: r.id,
      reviewer: r.reviewerName,
      rating: r.rating,
      text: r.text,
      product: r.productName,
      createdAt: r.createdAt.getTime(),
    })),
  });
}