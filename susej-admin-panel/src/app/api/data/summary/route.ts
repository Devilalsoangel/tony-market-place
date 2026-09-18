import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getActiveAdmin } from "@/lib/auth";

/**
 * GET /api/data/summary — server-aggregated dashboard KPIs in ONE round trip.
 * Replaces 8 unbounded full-table pulls + client-side aggregation (which dies
 * at 100k rows). Counts are exact at any scale.
 * Honesty rules: no presence source exists, so there is NO "online users"
 * metric (the old key counted 7-day signups); product stats split hidden
 * (moderator-taken-down) from any real pending queue; month charts are
 * bounded recent-window queries and say so.
 */
export async function GET(req: NextRequest) {
  // Live Admin row (ban/demote bites immediately) + role-gated money.
  const session = (await getActiveAdmin(req).catch(() => null)) as { role?: unknown } | null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ACL mirror (F4): this endpoint serves revenue + recent orders/audit, so it
  // enforces the same matrix as /api/data (super_admin + manager + finance
  // only). Moderators/app get 403 — the money endpoint never consults
  // FINANCE_READ otherwise. Audit trail rows are super_admin-only (manager +
  // finance get counts + revenue, never admin activity).
  let isSuperAdmin = false;
  {
    const r = String(session.role ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "_");
    isSuperAdmin = r === "super_admin" || r === "superadmin" || r === "owner";
    const allowed =
      isSuperAdmin ||
      r === "manager" || r === "admin" ||
      r === "finance" || r === "accountant" || r === "treasury";
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    newUsersToday,
    active7d,
    sellerGroups,
    productCount,
    hiddenProductCount,
    orderCount,
    ordersToday,
    deliveredAgg,
    deliveredTrackings,
    disputeGroups,
    communityCount,
    reportedCount,
    openTickets,
    recentOrders,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { joinedAt: { gte: startOfDay } } }),
    prisma.user.count({ where: { joinedAt: { gte: weekAgo } } }),
    // Grouped counts (exact at any scale) — never full-table pulls for KPIs.
    prisma.seller.groupBy({ by: ["kycStatus"], _count: { _all: true } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: { equals: "hidden", mode: "insensitive" } } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.aggregate({ where: { status: "delivered" }, _sum: { amount: true }, _count: { _all: true } }),
    // Delivered-order trackings: refundsOut counts ONLY refunds on delivered
    // rows (gross is delivered-only GMV). Cancel-path and pre-delivery
    // approve/dispute legs never entered gross — subtracting them
    // double-subtracts (net understated 2x per cancel).
    prisma.order.findMany({ where: { status: "delivered" }, select: { trackingNumber: true } }),
    // Refund rows are resolved delivered-only in JS below (aggregate can't
    // join to orders) — see refundsOut.
    // Dispute rulings move buyer money with NO Refund row — without this leg
    // the net overstates by every dispute payout. Delivered-filtered in JS
    // below (pre-delivery rulings never entered gross).
    prisma.walletTransaction.groupBy({
      by: ["title"],
      where: {
        OR: [{ title: { startsWith: "Dispute refund ·" } }, { title: { startsWith: "Dispute split refund ·" } }],
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    }).catch(() => [] as Array<{ title: string; _sum: { amount: number | null } }>),
    prisma.community.count().catch(() => 0),
    prisma.reportedUser.count().catch(() => 0),
    prisma.supportTicket.count({ where: { status: "open" } }).catch(() => 0),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, buyerName: true, amount: true, status: true, createdAt: true } }),
    prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 6, select: { id: true, details: true, adminName: true, timestamp: true } }).catch(() => []),
  ]);

  const gross = Number(deliveredAgg._sum.amount ?? 0);
  // Delivered-only, single-counted refundsOut:
  // - Refund rows: approved/refunded rows whose orderRef is a DELIVERED
  //   tracking (pre-delivery approvals cancelled out of gross already; their
  //   rows must not subtract). Needs the row list (aggregate can't join), so
  //   this is one bounded-by-delivered query, exact at any scale.
  // - Dispute legs: no Refund row exists — sum per-title groups whose
  //   tracking suffix is delivered.
  // - Cancel legs: excluded — cancel never fires on delivered rows, so those
  //   legs never entered gross (subtracting them double-subtracted).
  // - `Order refund ·` approve legs: excluded — every approve flips its
  //   Refund row (counted above); counting both doubled every approval.
  const deliveredSet = new Set(
    (deliveredTrackings as Array<{ trackingNumber?: unknown }>).map((o) => String(o.trackingNumber ?? "")).filter(Boolean)
  );
  const refundsDelivered = await prisma.refund.findMany({
    where: { status: { in: ["approved", "refunded"] }, orderRef: { in: [...deliveredSet] } },
    select: { amount: true },
  }).catch(() => [] as Array<{ amount?: unknown }>);
  const rowsOut = refundsDelivered.reduce((s: number, r) => s + Math.max(0, Number(r.amount ?? 0)), 0);
  const disputeOut = (disputeGroups as Array<{ title: string; _sum: { amount: number | null } }>).reduce(
    (s: number, g) => {
      const tracking = String(g.title ?? "").split("·").pop()?.trim() ?? "";
      return deliveredSet.has(tracking) ? s + Math.max(0, Number(g._sum?.amount ?? 0)) : s;
    },
    0
  );
  const refundsOut = rowsOut + disputeOut;

  // Revenue by month (delivered GMV) + user growth by month need dates —
  // bounded recent-window queries (5k) keep charts exact at any real scale;
  // headline KPIs above are unbounded aggregates, always exact. Flags tell
  // the UI when a window filled (history beyond it exists).
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

  const sellerCountFor = (status: string) =>
    sellerGroups.filter((g) => String(g.kycStatus ?? "").toLowerCase() === status).reduce((s, g) => s + g._count._all, 0);
  const approvedSellers = sellerCountFor("approved");
  const pendingSellers = sellerCountFor("pending");

  return NextResponse.json({
    counts: {
      totalUsers: userCount,
      newUsersToday,
      // No presence/session source exists — this is new signups (7d), never
      // "online". The overview labels it as such; wire real presence to
      // restore an online metric.
      newUsers7d: active7d,
      verifiedSellers: approvedSellers,
      pendingSellerRequests: pendingSellers,
      totalProducts: productCount,
      // Product has no pending queue (active/featured/hidden) — hidden means
      // moderator-taken-down, reported separately and honestly.
      hiddenProducts: hiddenProductCount,
      communities: communityCount,
      totalOrders: orderCount,
      ordersToday,
      pendingReports: reportedCount,
      openSupportTickets: openTickets,
    },
    revenue: { gross, refundsOut, net: Math.max(0, gross - refundsOut) },
    revenueByMonth: [...revByMonth.entries()].map(([month, revenue]) => ({ month, revenue })),
    revenueTrendComplete: deliveredForTrend.length < 5000,
    growthByMonth: [...growthByMonth.entries()].map(([month, v]) => ({ month, ...v })),
    growthTrendComplete: userGroups.length < 5000,
    topCategories: catGroups.map((g) => ({ name: (g.category ?? "").trim() || "Other", value: g._count._all })),
    recentOrders: recentOrders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
    // Audit activity is need-to-know: the data-plane denies audit-logs to
    // manager/finance, so the summary must not smuggle the same rows in.
    recentAudit: isSuperAdmin ? recentAudit.map((a) => ({ ...a, timestamp: a.timestamp.toISOString() })) : [],
  });
}
