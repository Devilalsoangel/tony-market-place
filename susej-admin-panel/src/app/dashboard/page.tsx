"use client";

import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Users, ShoppingCart, Headphones } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { GrowthChart } from "@/components/charts/growth-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import type { KPIData } from "@/types";
import Link from "next/link";

export default function DashboardPage() {
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );
  }, []);

  // Server-aggregated KPIs: ONE bounded round trip, exact at any scale.
  // (Replaces 8 unbounded full-table pulls + client-side aggregation.)
  interface SummaryShape {
    counts: Record<string, number>;
    revenue: { gross: number; refundsOut: number; net: number };
    revenueByMonth: { month: string; revenue: number }[];
    revenueTrendComplete?: boolean;
    growthByMonth: { month: string; users: number; sellers: number }[];
    growthTrendComplete?: boolean;
    topCategories: { name: string; value: number }[];
    recentOrders: { id: string; buyerName: string; amount: number; status: string; createdAt: string }[];
    recentAudit: { id: string; details: string; adminName: string; timestamp: string }[];
  }
  const [summary, setSummary] = useState<SummaryShape | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    fetch("/api/data/summary", { cache: "no-store", credentials: "include", signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(body?.error ?? "Failed to load");
        setSummary(body as SummaryShape);
        setSummaryErr(null);
      })
      .catch((e) => {
        if (!cancelled) setSummaryErr(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);
  const dbDown = !!summaryErr;

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    if (!y || !m) return key;
    return new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  };

  // KPIs computed from REAL rows — no fabricated business metrics.
  const kpis = useMemo<KPIData>(() => {
    const c = summary?.counts ?? {};
    const num = (k: string) => Number(c[k] ?? 0) || 0;
    return {
      totalUsers: num("totalUsers"),
      newUsersToday: num("newUsersToday"),
      newUsers7d: num("newUsers7d"),
      verifiedSellers: num("verifiedSellers"),
      pendingSellerRequests: num("pendingSellerRequests"),
      totalProducts: num("totalProducts"),
      hiddenProducts: num("hiddenProducts"),
      communities: num("communities"),
      ordersToday: num("ordersToday"),
      revenue: Number(summary?.revenue.gross ?? 0),
      refundsOut: Number(summary?.revenue.refundsOut ?? 0),
      netRevenue: Number(summary?.revenue.net ?? 0),
      pendingReports: num("pendingReports"),
      openSupportTickets: num("openSupportTickets"),
    };
  }, [summary]);

  const revenueData = useMemo(() => {
    // Trend chart stays on delivered GMV (shape signal); the KPI headline
    // above is net of refunds. Server-bucketed — no row pulls.
    return [...(summary?.revenueByMonth ?? [])]
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .map(({ month, revenue }) => ({ month: monthLabel(month), revenue }));
  }, [summary]);
  // Growth + categories arrive server-bucketed from /api/data/summary.
  const growthData = useMemo(() => {
    return [...(summary?.growthByMonth ?? [])]
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .map(({ month, users, sellers }) => ({ month: monthLabel(month), users, sellers }));
  }, [summary]);
  const topCategories = useMemo(() => {
    return [...(summary?.topCategories ?? [])].sort((a, b) => b.value - a.value).slice(0, 6);
  }, [summary]);

  const recentOrders = summary?.recentOrders ?? [];
  const recentAudit = summary?.recentAudit ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Overview</h1>
          <p className="mt-0.5 text-[13px] text-[#71717A]">Key metrics and recent activity across SUSEJ.</p>
        </div>
        <p className="shrink-0 text-[13px] font-medium text-[#A1A1AA]">{today}</p>
      </div>

      {dbDown && (
        <div className="rounded-[8px] border border-[#FCD34D]/40 bg-[#FEF9C3] px-4 py-2.5 text-[13px] text-[#92400E]">
          Database unavailable — live data paused. KPIs show zeros until connection restores.
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Net Revenue"
          value={formatCurrency(kpis.netRevenue)}
          subtitle={`Gross ${formatCurrency(kpis.revenue)} · refunds ${formatCurrency(kpis.refundsOut)}`}
          icon={IndianRupee}
          variant="primary"
        />
        <KPICard title="Total Users" value={formatNumber(kpis.totalUsers)} icon={Users} variant="default" />
        <KPICard title="Orders Today" value={kpis.ordersToday} icon={ShoppingCart} variant="default" />
        <KPICard title="Open Support Tickets" value={kpis.openSupportTickets} icon={Headphones} variant="warning" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
            {summary && summary.revenueTrendComplete === false && (
              <p className="mt-2 text-[12px] text-[#71717A]">Trend covers the last 5,000 delivered orders.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex w-full items-center justify-between">
              <CardTitle>Latest orders</CardTitle>
              <Link
                href="/dashboard/orders"
                className="text-[13px] font-medium text-[#6C3BFF] hover:underline"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#E4E4E7]">
              {recentOrders.map((order) => (
                <Link key={order.id} href={`/dashboard/orders/${order.id}`} className="flex items-center justify-between rounded-[6px] px-2 py-2 transition-colors hover:bg-[#F5F3FF]/40">
                  <div>
                    <p className="text-[13px] font-medium text-[#18181B]">{order.id}</p>
                    <p className="text-xs text-[#71717A]">{order.buyerName} — {formatCurrency(order.amount)}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </Link>
              ))}
              {recentOrders.length === 0 && (
                <p className="py-6 text-center text-sm text-[#A1A1AA]">No orders yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>User &amp; seller growth</CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthChart data={growthData} />
            {summary && summary.growthTrendComplete === false && (
              <p className="mt-2 text-[12px] text-[#71717A]">Trend covers the 5,000 most recent users.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top categories</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={topCategories} height={250} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-[#E4E4E7]">
            {recentAudit.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6C3BFF]" />
                <div className="flex-1">
                  <p className="text-[13px] text-[#18181B]">{log.details}</p>
                  <p className="text-xs text-[#A1A1AA]">{log.adminName} — {formatDate(log.timestamp, "relative")}</p>
                </div>
              </div>
            ))}
            {recentAudit.length === 0 && (
              <p className="py-6 text-center text-sm text-[#A1A1AA]">No activity yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
