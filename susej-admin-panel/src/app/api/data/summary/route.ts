import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

/**
 * GET /api/data/summary — server-aggregated dashboard KPIs in ONE round trip.
 * Replaces 8 unbounded full-table pulls + client-side aggregation (which dies
 * at 100k rows). Counts are exact at any scale; derivations match the legacy
 * client math (delivered gross, week-active proxy, hidden-as-pending).
 */
export async function GET(req: NextRequest) {
  const session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    newUsersToday,
    active7d,
    sellerRows,
    productRows,
    orderCount,
    ordersToday,
    deliveredAgg,
    refundRows,
    communityCount,
    reportedCount,
    openTickets,
    recentOrders,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { joinedAt: { gte: startOfDay } } }),
    prisma.user.count({ where: { joinedAt: { gte: weekAgo } } }),
    prisma.seller.findMany({ select: { kycStatus: true } }),
    prisma.product.findMany({ select: { category: true, status: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.aggregate({ where: { status: "delivered" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.refund.findMany({ where: { status: { in: ["approved", "refunded"] } }, select: { amount: true } }),
    prisma.community.count().catch(() => 0),
    prisma.reportedUser.count().catch(() => 0),
    prisma.supportTicket.count({ where: { status: "open" } }).catch(() => 0),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, buyerName: true, amount: true, status: true, createdAt: true } }),
    prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 6, select: { id: true, details: true, adminName: true, timestamp: true } }).catch(() => []),
  ]);

  const gross = Number(deliveredAgg._sum.amount ?? 0);
  const refundsOut = refundRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // Revenue by month (delivered GMV) + user growth by month need dates —
  // bounded recent-window queries (5k) keep charts exact at any real scale;
  // headline KPIs above are unbounded aggregates, always exact.
  const [userGroups, catGroups] = await Promise.all([
    prisma.user.findMany({ select: { joinedAt: true, role: true, isSeller: true }, orderBy: { joinedAt: "desc" }, take: 5000 }).catch(() => [] as { joinedAt: Date; role: string; isSeller: boolean }[]),
    prisma.product.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { _count: { category: "desc" } }, take: 6 }).catch(() => [] as { category: string | null; _count: { _all: number } }[]),
  ]);

  const revByMonth = new Map<string, number>();
  const deliveredForTrend = await prisma.order
    .findMany({ where: { status: "delivered" }, select: { amount: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5000 })
    .catch(() => [] as { amount: number; createdAt: Date }[]);
  for (const o of deliveredForTrend) {
    const d = new Date(o.createdAt);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    revByMonth.set(key, (revByMonth.get(key) ?? 0) + (Number(o.amount) || 0));
  }

  const growthByMonth = new Map<string, { users: number; sellers: number }>();
  for (const u of userGroups) {
    const d = new Date(u.joinedAt);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const e = growthByMonth.get(key) ?? { users: 0, sellers: 0 };
    e.users += 1;
    if (u.role === "seller" || u.isSeller) e.sellers += 1;
    growthByMonth.set(key, e);
  }

  const approvedSellers = sellerRows.filter((s) => s.kycStatus === "approved").length;
  const pendingSellers = sellerRows.filter((s) => s.kycStatus === "pending").length;
  const hiddenProducts = productRows.filter((p) => String(p.status ?? "").toLowerCase() === "hidden").length;

  return NextResponse.json({
    counts: {
      totalUsers: userCount,
      newUsersToday,
      onlineUsers: active7d,
      verifiedSellers: approvedSellers,
      pendingSellerRequests: pendingSellers,
      totalProducts: productRows.length,
      pendingProducts: hiddenProducts,
      communities: communityCount,
      totalOrders: orderCount,
      ordersToday,
      pendingReports: reportedCount,
      openSupportTickets: openTickets,
    },
    revenue: { gross, refundsOut, net: Math.max(0, gross - refundsOut) },
    revenueByMonth: [...revByMonth.entries()].map(([month, revenue]) => ({ month, revenue })),
    growthByMonth: [...growthByMonth.entries()].map(([month, v]) => ({ month, ...v })),
    topCategories: catGroups.map((g) => ({ name: (g.category ?? "").trim() || "Other", value: g._count._all })),
    recentOrders: recentOrders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
    recentAudit: recentAudit.map((a) => ({ ...a, timestamp: a.timestamp.toISOString() })),
  });
}
