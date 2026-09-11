"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Receipt, Banknote, Activity, Scale } from "lucide-react";
import type { Transaction, GatewayLog } from "@/types";

const tColumn = createColumnHelper<Transaction>();

const tColumns = [
  tColumn.accessor("id", { header: "Transaction", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  tColumn.accessor("userName", { header: "User" }),
  tColumn.accessor("type", {
    header: "Type",
    cell: (info) => <Badge variant={info.getValue() === "payment" ? "primary" : "info"} className="capitalize">{info.getValue()}</Badge>,
  }),
  tColumn.accessor("method", {
    header: "Method",
    cell: (info) => <span className="capitalize text-[#71717A]">{info.getValue().replaceAll("_", " ")}</span>,
  }),
  tColumn.accessor("amount", { header: "Amount", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  tColumn.accessor("status", {
    header: "Status",
    cell: (info) => {
      const s = info.getValue();
      return (
        <Badge variant={s === "success" ? "success" : s === "pending" ? "warning" : "danger"} className="capitalize">
          {s}
        </Badge>
      );
    },
  }),
  tColumn.accessor("createdAt", { header: "Date", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
];

const gColumn = createColumnHelper<GatewayLog>();

const gColumns = [
  gColumn.accessor("gateway", { header: "Gateway", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  gColumn.accessor("event", { header: "Event", cell: (info) => <span className="capitalize">{info.getValue()}</span> }),
  gColumn.accessor("amount", { header: "Amount", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  gColumn.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={info.getValue() === "success" ? "success" : "danger"} className="capitalize">{info.getValue()}</Badge>,
  }),
  gColumn.accessor("message", { header: "Message" }),
  gColumn.accessor("createdAt", { header: "Date", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
];

const TYPE_FILTERS = ["all", "payment", "withdrawal", "refund", "commission", "settlement"];
const STATUS_FILTERS = ["all", "success", "pending", "failed"];

export default function PaymentsPage() {
  const { data: txns, loading: txnsLoading } = useDbResource<Transaction>("transactions");
  const { data: logs, loading: logsLoading } = useDbResource<GatewayLog>("gateway-logs");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return (txns ?? []).filter(
      (t) =>
        (typeFilter === "all" || t.type === typeFilter) &&
        (statusFilter === "all" || t.status === statusFilter)
    );
  }, [txns, typeFilter, statusFilter]);

  const success = (txns ?? []).filter((t) => t.status === "success");
  const pending = (txns ?? []).filter((t) => t.status === "pending");
  const failed = (txns ?? []).filter((t) => t.status === "failed");
  const volume = success.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Payments</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Review all payment transactions and gateway activity.</p>
      </div>

      {/* Sub-page quick links */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { href: "/dashboard/payments/transactions", icon: Receipt, label: "Transactions", sub: "All payment events" },
          { href: "/dashboard/payments/withdrawals", icon: Banknote, label: "Withdrawals", sub: "Seller payout requests" },
          { href: "/dashboard/payments/gateway-logs", icon: Activity, label: "Gateway Logs", sub: "Raw gateway responses" },
          { href: "/dashboard/payments/settlements", icon: Scale, label: "Settlements", sub: "Gross / commission / net" },
        ].map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.href} href={q.href} className="group">
              <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 transition-colors group-hover:border-[#6C3BFF]/40">
                <Icon className="h-5 w-5 text-[#6C3BFF]" />
                <p className="mt-2.5 text-sm font-semibold text-[#18181B]">{q.label}</p>
                <p className="mt-0.5 text-xs text-[#71717A]">{q.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Success volume" value={formatCurrency(volume)} tone="green" />
        <StatTile label="Successful" value={success.length} />
        <StatTile label="Pending" value={pending.length} tone="amber" />
        <StatTile label="Failed" value={failed.length} tone="red" />
      </div>

      <Tabs
        tabs={[
          { label: "Transactions", value: "transactions" },
          { label: "Gateway Logs", value: "gateway" },
        ]}
      >
        {(active) => (
          <>
            {active === "transactions" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Transactions</CardTitle>
                    <div className="flex gap-2">
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="h-8 rounded-[6px] border border-[#E4E4E7] bg-white px-2 text-[13px] text-[#18181B] outline-none focus:border-[#6C3BFF]"
                      >
                        {TYPE_FILTERS.map((f) => (
                          <option key={f} value={f} className="capitalize">{f}</option>
                        ))}
                      </select>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-8 rounded-[6px] border border-[#E4E4E7] bg-white px-2 text-[13px] text-[#18181B] outline-none focus:border-[#6C3BFF]"
                      >
                        {STATUS_FILTERS.map((f) => (
                          <option key={f} value={f} className="capitalize">{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={tColumns}
                    data={filtered}
                    loading={txnsLoading}
                    searchable
                    searchKey="userName"
                    filename="payments"
                    exportColumns={[
                      { key: "id", label: "Transaction" },
                      { key: "userName", label: "User" },
                      { key: "type", label: "Type" },
                      { key: "method", label: "Method" },
                      { key: "amount", label: "Amount" },
                      { key: "status", label: "Status" },
                      { key: "createdAt", label: "Date" },
                    ]}
                  />
                </CardContent>
              </Card>
            )}

            {active === "gateway" && (
              <Card>
                <CardHeader>
                  <CardTitle>Gateway Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable columns={gColumns} data={logs ?? []} loading={logsLoading} searchable searchKey="gateway" filename="gateway-logs" />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}