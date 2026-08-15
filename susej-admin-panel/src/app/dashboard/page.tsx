"use client";

import { useEffect, useState } from "react";
import { DollarSign, Users, ShoppingCart, Headphones } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { GrowthChart } from "@/components/charts/growth-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { mockKPIs, mockRevenueData, mockGrowthData, mockTopCategories, mockOrders, mockAuditLogs } from "@/services/mock-data";
import { useDbResource } from "@/hooks/use-db-resource";
import type { KPIData, Order, AuditLog } from "@/types";

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

  const { data: settings } = useDbResource<{ key: string; value: unknown }>("app-settings");
  const { data: dbOrders } = useDbResource<Order>("orders");
  const { data: dbAuditLogs } = useDbResource<AuditLog>("audit-logs");

  const setting = (key: string) => settings?.find((s) => s.key === key)?.value;
  const kpis = (setting("kpis") ?? mockKPIs) as KPIData;
  const revenueData = (setting("revenueData") ?? mockRevenueData) as typeof mockRevenueData;
  const growthData = (setting("growthData") ?? mockGrowthData) as typeof mockGrowthData;
  const topCategories = (setting("topCategories") ?? mockTopCategories) as typeof mockTopCategories;
  const recentOrders = (dbOrders ?? mockOrders).slice(0, 6);
  const recentAudit = (dbAuditLogs ?? mockAuditLogs).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Overview</h1>
          <p className="mt-0.5 text-[13px] text-[#71717A]">Key metrics and recent activity across SUSEJ.</p>
        </div>
        <p className="shrink-0 text-[13px] font-medium text-[#A1A1AA]">{today}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Total Revenue" value={formatCurrency(kpis.revenue)} icon={DollarSign} trend={{ value: 18, positive: true }} variant="primary" />
        <KPICard title="Total Users" value={formatNumber(kpis.totalUsers)} icon={Users} trend={{ value: 12, positive: true }} variant="default" />
        <KPICard title="Orders Today" value={kpis.ordersToday} icon={ShoppingCart} trend={{ value: 5, positive: true }} variant="default" />
        <KPICard title="Open Tickets" value={kpis.openSupportTickets} icon={Headphones} variant="warning" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#E4E4E7]">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-[13px] font-medium text-[#18181B]">{order.id}</p>
                    <p className="text-xs text-[#71717A]">{order.buyerName} — {formatCurrency(order.amount)}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>User & seller growth</CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthChart data={growthData} />
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
