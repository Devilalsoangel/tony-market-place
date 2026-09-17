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
        featuredPosts: [],
        spotlight: null,
        degraded: true,
      },
      { status: 200 }
    );
  }

  const [topSellers, hotDeals, marketingBanners, featuredPosts, spotlight, sections] = await Promise.all([
    // Rails serve at most 3 rows (the app + desk contract): extra active rows
    // wait their turn and expire naturally — the rail never overflows no
    // matter how many campaigns the engine sells.
    prisma.topSeller.findMany({ where: { status: ACTIVE }, orderBy: { position: "asc" }, take: 3 }),
    prisma.hotDeal.findMany({ where: { status: ACTIVE }, orderBy: { priority: "asc" }, take: 3 }),
    // Marketing banners: seller-uploaded banner images from the seller dashboard,
    // synced into storefrontBanner. Ordered by explicit position (lower first,
    // nulls last) then newest.
    prisma.storefrontBanner.findMany({
      where: { status: ACTIVE },
      orderBy: [{ position: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    }),
    // Featured posts: paid promo placements (promo engine writes them on
    // purchase). Previously write-only — orphans rendered nowhere while money
    // was taken. Now a real home rail, ordered pinned-first then position.
    prisma.featuredPost.findMany({
      where: { status: ACTIVE },
      orderBy: [{ isPinned: "desc" }, { position: "asc" }, { createdAt: "desc" }],
    }),
    // Spotlight: paid position-1 feed pin (promo engine writes it on
    // purchase). Was write-only — money taken, rendered nowhere. Served here
    // so the paid placement actually displays; at most one active row wins
    // (newest first).
    prisma.spotlight.findMany({
      where: { status: ACTIVE },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
    // Home-section visibility (admin "Show on home page" toggle): missing row
    // = ON (fresh prod renders), explicit isEnabled=false hides the rail.
    prisma.homeSection.findMany().catch(() => [] as { name: string; isEnabled: boolean }[]),
  ]);
  const sectionOff = new Set(
    (sections as { name: string; isEnabled: boolean }[]).filter((s) => !s.isEnabled).map((s) => s.name)
  );

  // Serve-time expiry guard: string endDates in the past never render, even
  // in the window before the lazy sweep expires them (or when the sweep's
  // write contends and fails). Empty/unparseable = no expiry (pinned).
  const notExpired = (r: { endDate?: unknown }) => {
    const s = typeof r.endDate === "string" ? r.endDate : "";
    if (!s) return true;
    const t = Date.parse(s);
    return Number.isNaN(t) || t > Date.now();
  };
  const liveFeatured = featuredPosts.filter(notExpired);
  const liveSpotlight = spotlight.filter(notExpired);
  // Hot deals carry string start/end dates — never serve an expired or
  // not-yet-started row even when the sweep hasn't flipped its status yet.
  const liveHotDeals = hotDeals.filter((d) => {
    if (!notExpired(d as { endDate?: unknown })) return false;
    const s = typeof (d as { startDate?: unknown }).startDate === "string" ? (d as { startDate: string }).startDate : "";
    if (!s) return true;
    const t = Date.parse(s);
    return Number.isNaN(t) || t <= Date.now();
  });

  // Live sales truth: TopSeller snapshots go stale the moment the next
  // order delivers, so re-resolve delivered-order units + review aggregates
  // per row at serve time (max 3 rows — cheap). Snapshot stays as fallback.
  // Identity is server-resolved too: a hand-cloned "(Copy)" row can never
  // serve a fabricated name with real stats (intelligence guard).
  const liveStats = new Map<string, { totalSales: number; rating: number; reviewCount: number; sellerName: string }>();
  try {
    const usernames = Array.from(new Set(topSellers.map((t) => t.sellerId).filter(Boolean)));
    await Promise.all(
      usernames.map(async (u) => {
        try {
          const [delivered, agg, seller] = await Promise.all([
            prisma!.order.findMany({ where: { sellerUsername: u, status: "delivered" }, select: { itemsList: true } }),
            prisma!.review.aggregate({ where: { sellerUsername: u }, _avg: { rating: true }, _count: { id: true } }),
            (prisma as unknown as { user: { findUnique: (a: unknown) => Promise<{ businessName?: unknown; name?: unknown } | null> } }).user.findUnique({ where: { username: u }, select: { businessName: true, name: true } }).catch(() => null),
          ]);
          let units = 0;
          for (const o of delivered) {
            const items = Array.isArray((o as { itemsList?: unknown }).itemsList)
              ? ((o as { itemsList: { qty?: unknown; quantity?: unknown }[] }).itemsList)
              : [];
            for (const it of items) units += Math.max(1, Math.round(Number(it?.qty ?? it?.quantity ?? 1)));
          }
          liveStats.set(u, {
            totalSales: units,
            rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
            reviewCount: agg._count.id,
            sellerName: String((seller as { businessName?: unknown; name?: unknown } | null)?.businessName ?? (seller as { name?: unknown } | null)?.name ?? "").trim(),
          });
        } catch {
          // Per-seller fallback: snapshot below.
        }
      })
    );
  } catch {
    // Global fallback: snapshots below.
  }

  return NextResponse.json({
    sections: {
      "top-sellers": !sectionOff.has("top-sellers"),
      "hot-deals": !sectionOff.has("hot-deals"),
      "storefront-banners": !sectionOff.has("storefront-banners"),
      // Paid rails have a kill-switch too (missing row = ON): an admin must
      // be able to hide a wrong/fraudulent paid placement immediately.
      "featured-posts": !sectionOff.has("featured-posts"),
      "spotlight": !sectionOff.has("spotlight"),
    },
    topSellers: (sectionOff.has("top-sellers") ? [] : topSellers).map((t) => {
      const live = liveStats.get(t.sellerId);
      return {
        sellerId: t.sellerId,
        sellerName: live?.sellerName || t.sellerName,
        sellerLogo: t.sellerLogo,
        totalSales: live?.totalSales ?? t.totalSales,
        rating: live?.rating ?? t.rating,
        reviewCount: live?.reviewCount ?? t.reviewCount,
        position: t.position,
        isPinned: t.isPinned,
      };
    }),
    hotDeals: (sectionOff.has("hot-deals") ? [] : liveHotDeals).map((d) => ({
      productId: d.productId,
      productName: d.productName,
      productImage: d.productImage,
      originalPrice: d.originalPrice,
      discountedPrice: d.discountedPrice,
      discountPercentage: d.discountPercentage,
      priority: d.priority,
    })),
    marketingBanners: (sectionOff.has("storefront-banners") ? [] : marketingBanners).map((b) => ({
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
    featuredPosts: (sectionOff.has("featured-posts") ? [] : liveFeatured).map((p) => ({
      id: p.id,
      postId: p.postId,
      title: p.title,
      excerpt: p.excerpt,
      imageUrl: p.imageUrl,
      position: p.position,
      isPinned: p.isPinned,
    })),
    spotlight: sectionOff.has("spotlight") || !liveSpotlight.length
      ? null
      : {
          id: liveSpotlight[0].id,
          postId: liveSpotlight[0].postId,
          productId: liveSpotlight[0].productId,
          sellerId: liveSpotlight[0].sellerId,
          sellerName: liveSpotlight[0].sellerName,
          sellerLogo: liveSpotlight[0].sellerLogo,
          title: liveSpotlight[0].title,
          imageUrl: liveSpotlight[0].imageUrl,
        },
  });
}
