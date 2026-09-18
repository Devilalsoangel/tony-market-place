"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { GrowthChart } from "@/components/charts/growth-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { useDbResource } from "@/hooks/use-db-resource";

// Every series below is computed from real DB rows pulled through /api/data.
// No fabricated numbers anywhere: empty databases produce empty charts.

interface OrderRow {
  amount: number;
  status: string;
  sellerName: string;
  buyerName: string;
  createdAt: string;
  itemsList: { name?: string; qty?: number; price?: number }[];
}

interface UserRow {
  joinedAt?: string;
  createdAt?: string;
  location?: string | null;
}

interface ProductRow {
  category?: string | null;
  createdAt: string;
}

interface CommunityRow {
  createdAt: string;
}

interface SellerRow {
  joinedAt?: string;
  submittedAt?: string;
  createdAt?: string;
}

interface HashtagRow {
  tag: string;
  postsCount: number;
}

type Point = { name: string; value: number };
type BucketMap = Map<string, number>;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sorted yyyy-mm bucket keys spanning every date found (max 12 most recent). */
function monthKeys(dates: Date[]): string[] {
  if (dates.length === 0) return [];
  const keys = dates.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  const unique = Array.from(new Set(keys)).sort();
  return unique.slice(-12);
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelOf(key: string): string {
  const [y, m] = key.split("-");
  const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
  return `${month} ${y.slice(2)}`;
}

function perMonth(dates: Date[]): BucketMap {
  const map: BucketMap = new Map();
  for (const d of dates) {
    const k = keyOf(d);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function toSeries(map: BucketMap): Point[] {
  return Array.from(map.keys())
    .sort()
    .map((k) => ({ name: labelOf(k), value: map.get(k) ?? 0 }));
}

function cumulativeSeries(dates: Date[]): Point[] {
  const perBucket = perMonth(dates);
  let running = 0;
  return Array.from(perBucket.keys())
    .sort()
    .map((k) => {
      running += perBucket.get(k) ?? 0;
      return { name: labelOf(k), value: running };
    });
}

function topN(map: BucketMap, n = 5): Point[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, value]) => ({ name, value }));
}

function ChartCard({
  title,
  points,
  color,
  height,
  scope,
}: {
  title: string;
  points: Point[];
  color?: string;
  height?: number;
  /** Window qualifier rendered under the title (omitted = exact server aggregate). */
  scope?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {scope && <p className="mt-0.5 text-[11px] text-[#71717A]">{scope}</p>}
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <EmptyState
            className="py-10"
            title="No data yet"
            description="This chart fills in as soon as matching records exist in the database."
          />
        ) : (
          <BarChart data={points} height={height ?? 250} color={color} />
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  // Bounded windows (never full-table pulls): charts bucket the recent
  // window client-side and every caption says so — at scale these read the
  // summary aggregates, never an OOM browser pull.
  // Server aggregates FIRST (exact at any scale): Revenue, Growth and Top
  // Categories come from /api/data/summary (same source as the overview).
  // The remaining charts bucket the recent-100 window and say so.
  const [summary, setSummary] = useState<{
    revenueByMonth?: { month: string; revenue: number }[];
    growthByMonth?: { month: string; users: number; sellers: number }[];
    topCategories?: { name: string; value: number }[];
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/data/summary", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const body = await res.json().catch(() => null);
        if (!cancelled && body) setSummary(body);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const { data: orders, total: ordersTotal } = useDbResource<OrderRow>("orders", { take: 100 });
  const { data: users, total: usersTotal } = useDbResource<UserRow>("users", { take: 100 });
  const { data: products, total: productsTotal } = useDbResource<ProductRow>("products", { take: 100 });
  const { data: communities, total: communitiesTotal } = useDbResource<CommunityRow>("communities", { take: 100 });
  const { data: sellers } = useDbResource<SellerRow>("sellers", { take: 100 });
  const { data: hashtags, total: hashtagsTotal } = useDbResource<HashtagRow>("hashtags", { take: 100 });
  const windowNote =
    (typeof ordersTotal === "number" && ordersTotal > (orders ?? []).length
      ? ` — showing recent ${(orders ?? []).length} of ${ordersTotal}`
      : "") + " · Revenue, Growth and Categories are exact server aggregates";
  // Per-chart window scope: every bucketed chart names its window so none
  // reads as platform truth past 100 rows.
  const scopeOf = (total: number | null, loaded: number) =>
    typeof total === "number" && total > loaded ? `Recent ${loaded} of ${total} — not platform totals` : undefined;

  const revenueSeries = useMemo(() => {
    // Server aggregate first (exact delivered GMV by month at any scale).
    if (summary?.revenueByMonth?.length) {
      return [...summary.revenueByMonth]
        .sort((a, b) => (a.month < b.month ? -1 : 1))
        .map(({ month, revenue }) => ({ name: labelOf(month), value: revenue }));
    }
    const totals: BucketMap = new Map();
    for (const o of orders ?? []) {
      if (o.status === "cancelled") continue;
      const d = toDate(o.createdAt);
      if (!d) continue;
      const k = keyOf(d);
      totals.set(k, (totals.get(k) ?? 0) + (Number(o.amount) || 0));
    }
    return toSeries(totals);
  }, [orders, summary]);

  const growthSeries = useMemo(() => {
    // Server aggregate first (exact cumulative signups at any scale).
    if (summary?.growthByMonth?.length) {
      let cu = 0;
      let cs = 0;
      return [...summary.growthByMonth]
        .sort((a, b) => (a.month < b.month ? -1 : 1))
        .map(({ month, users, sellers }) => {
          cu += users;
          cs += sellers;
          return { month: labelOf(month), users: cu, sellers: cs };
        });
    }
    const userDates = (users ?? []).map((u) => toDate(u.joinedAt ?? u.createdAt)).filter((d): d is Date => !!d);
    const sellerDates = (sellers ?? [])
      .map((s) => toDate(s.joinedAt ?? s.submittedAt ?? s.createdAt))
      .filter((d): d is Date => !!d);
    if (userDates.length === 0 && sellerDates.length === 0) return [];
    const keys = monthKeys([...userDates, ...sellerDates]);
    const usersPer = perMonth(userDates);
    const sellersPer = perMonth(sellerDates);
    let u = 0;
    let s = 0;
    return keys.map((k) => {
      u += usersPer.get(k) ?? 0;
      s += sellersPer.get(k) ?? 0;
      return { month: labelOf(k), users: u, sellers: s };
    });
  }, [users, sellers, summary]);

  const ordersTrend = useMemo(
    () =>
      cumulativeSeries((orders ?? []).map((o) => toDate(o.createdAt)).filter((d): d is Date => !!d)),
    [orders]
  );

  const productsGrowth = useMemo(
    () =>
      cumulativeSeries((products ?? []).map((p) => toDate(p.createdAt)).filter((d): d is Date => !!d)),
    [products]
  );

  const communitiesGrowth = useMemo(
    () =>
      cumulativeSeries((communities ?? []).map((c) => toDate(c.createdAt)).filter((d): d is Date => !!d)),
    [communities]
  );

  const newUsersByDay = useMemo(() => {
    const days: Point[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const count = (users ?? []).filter((u) => {
        const d = toDate(u.joinedAt ?? u.createdAt);
        return d !== null && d >= day && d < next;
      }).length;
      days.push({
        name: day.toLocaleDateString("en-US", { weekday: "short" }),
        value: count,
      });
    }
    return days;
  }, [users]);

  const topSellers = useMemo(() => {
    const totals: BucketMap = new Map();
    for (const o of orders ?? []) {
      if (o.status === "cancelled") continue;
      const seller = String(o.sellerName ?? "").trim();
      if (!seller) continue;
      totals.set(seller, (totals.get(seller) ?? 0) + (Number(o.amount) || 0));
    }
    return topN(totals);
  }, [orders]);

  const topProducts = useMemo(() => {
    const totals: BucketMap = new Map();
    for (const o of orders ?? []) {
      if (!Array.isArray(o.itemsList)) continue;
      for (const item of o.itemsList) {
        const name = String(item?.name ?? "").trim();
        if (!name) continue;
        const qty = Number(item?.qty) || 1;
        const price = Number.isFinite(Number(item?.price)) ? Number(item?.price) : 0;
        totals.set(name, (totals.get(name) ?? 0) + qty * price);
      }
    }
    return topN(totals);
  }, [orders]);

  const topCities = useMemo(() => {
    const counts: BucketMap = new Map();
    for (const u of users ?? []) {
      const city = String(u.location ?? "").trim();
      if (!city) continue;
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    return topN(counts);
  }, [users]);

  const conversionSeries = useMemo(() => {
    const ordersPer = perMonth((orders ?? []).map((o) => toDate(o.createdAt)).filter((d): d is Date => !!d));
    const usersPer = perMonth((users ?? []).map((u) => toDate(u.joinedAt ?? u.createdAt)).filter((d): d is Date => !!d));
    if (ordersPer.size === 0 && usersPer.size === 0) return [];
    return Array.from(new Set([...ordersPer.keys(), ...usersPer.keys()]))
      .sort()
      .map((k) => ({
        name: labelOf(k),
        value: usersPer.get(k)
          ? Math.round(((ordersPer.get(k) ?? 0) / (usersPer.get(k) ?? 1)) * 1000) / 10
          : 0,
      }));
  }, [orders, users]);

  const topCategories = useMemo(() => {
    // Server aggregate first (exact counts at any scale).
    if (summary?.topCategories?.length) {
      return summary.topCategories
        .slice(0, 5)
        .map(({ name, value }) => ({ name, value }))
        .filter((r) => r.name);
    }
    const counts: BucketMap = new Map();
    for (const p of products ?? []) {
      const cat = String(p.category ?? "").trim();
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return topN(counts);
  }, [products, summary]);

  const topHashtags = useMemo(() => {
    const rows = [...(hashtags ?? [])]
      .sort((a, b) => (Number(b.postsCount) || 0) - (Number(a.postsCount) || 0))
      .slice(0, 5)
      .map((h) => ({ name: String(h.tag ?? ""), value: Number(h.postsCount) || 0 }));
    return rows.filter((r) => r.name);
  }, [hashtags]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">In-depth platform analytics and metrics{windowNote}</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueSeries.length === 0 ? (
              <EmptyState
                className="py-10"
                title="No revenue yet"
                description="Revenue appears here once orders start landing in the database."
              />
            ) : (
              <RevenueChart data={revenueSeries.map((p) => ({ month: p.name, revenue: p.value }))} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>User &amp; Seller Growth</CardTitle>
          </CardHeader>
          <CardContent>
            {growthSeries.length === 0 ? (
              <EmptyState
                className="py-10"
                title="No signups yet"
                description="Growth appears here once users and sellers register."
              />
            ) : (
              <GrowthChart data={growthSeries} />
            )}
          </CardContent>
        </Card>
        <ChartCard title="Orders (cumulative)" points={ordersTrend} color="#6C3BFF" scope={scopeOf(ordersTotal, (orders ?? []).length)} />
        <ChartCard title="Products Growth" points={productsGrowth} color="#16A34A" scope={scopeOf(productsTotal, (products ?? []).length)} />
        <ChartCard title="Communities Growth" points={communitiesGrowth} color="#2563EB" scope={scopeOf(communitiesTotal, (communities ?? []).length)} />
        <ChartCard title="New Users (Last 7 Days)" points={newUsersByDay} scope={scopeOf(usersTotal, (users ?? []).length)} />
        <ChartCard title="Top Sellers (by order value)" points={topSellers} color="#F59E0B" scope={scopeOf(ordersTotal, (orders ?? []).length)} />
        <ChartCard title="Top Products (by sold value)" points={topProducts} color="#16A34A" scope={scopeOf(ordersTotal, (orders ?? []).length)} />
        <ChartCard title="Top Cities (by users)" points={topCities} color="#2563EB" scope={scopeOf(usersTotal, (users ?? []).length)} />
        <ChartCard title="Top Categories (by products)" points={topCategories} />
        <ChartCard title="Top Hashtags (by posts)" points={topHashtags} color="#16A34A" scope={scopeOf(hashtagsTotal, (hashtags ?? []).length)} />
        <ChartCard title="Conversion Rate (%)" points={conversionSeries} color="#2563EB" scope={scopeOf(usersTotal, (users ?? []).length)} />
      </div>
    </div>
  );
}
