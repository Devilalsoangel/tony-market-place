"use client";

import { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction, TransactionType, TransactionStatus } from "@/types";

const column = createColumnHelper<Transaction>();

const typeBadge: Record<TransactionType, "primary" | "success" | "warning" | "info" | "default" | "danger"> = {
  payment: "success",
  withdrawal: "info",
  refund: "warning",
  commission: "primary",
  settlement: "default",
};

const columns = [
  column.accessor("id", { header: "Transaction", cell: (info) => <span className="font-mono text-sm font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("userName", { header: "User / Party", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  column.accessor("type", {
    header: "Type",
    cell: (info) => <Badge variant={typeBadge[info.getValue()]} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("amount", { header: "Amount", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  column.accessor("method", { header: "Method", cell: (info) => <span className="capitalize text-[#71717A]">{String(info.getValue()).replaceAll("_", " ")}</span> }),
  column.accessor("gateway", { header: "Gateway", cell: (info) => info.getValue() }),
  column.accessor("reference", { header: "Reference", cell: (info) => <span className="font-mono text-xs text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant={info.getValue() === "success" ? "success" : info.getValue() === "pending" ? "warning" : "danger"} className="capitalize">
        {info.getValue()}
      </Badge>
    ),
  }),
  column.accessor("createdAt", { header: "Date", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
];

export default function TransactionsPage() {
  const { data: txns } = useDbResource<Transaction>("transactions");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(
    () =>
      (txns ?? []).filter(
        (t) =>
          (typeFilter === "all" || t.type === typeFilter) &&
          (statusFilter === "all" || t.status === statusFilter)
      ),
    [txns, typeFilter, statusFilter]
  );

  const volume = (txns ?? []).reduce((s, t) => s + (t.status === "success" ? t.amount : 0), 0);
  const pendingCount = (txns ?? []).filter((t) => t.status === "pending").length;
  const failedCount = (txns ?? []).filter((t) => t.status === "failed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Transactions</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">All payment transactions across the marketplace.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Successful volume" value={formatCurrency(volume)} tone="green" />
        <StatTile label="Pending" value={pendingCount} tone="amber" />
        <StatTile label="Failed" value={failedCount} tone="red" />
        <StatTile label="Total transactions" value={(txns ?? []).length} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Transactions</CardTitle>
            <div className="flex items-center gap-3">
              <Select
                className="w-44"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { label: "All Types", value: "all" },
                  { label: "Payment", value: "payment" },
                  { label: "Withdrawal", value: "withdrawal" },
                  { label: "Refund", value: "refund" },
                  { label: "Commission", value: "commission" },
                  { label: "Settlement", value: "settlement" },
                ]}
              />
              <Select
                className="w-40"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { label: "All Status", value: "all" },
                  { label: "Success", value: "success" },
                  { label: "Pending", value: "pending" },
                  { label: "Failed", value: "failed" },
                ]}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filtered}
            searchable
            searchKey="userName"
            filename="transactions"
            exportColumns={[
              { key: "id", label: "Transaction" },
              { key: "userName", label: "User" },
              { key: "type", label: "Type" },
              { key: "amount", label: "Amount" },
              { key: "method", label: "Method" },
              { key: "gateway", label: "Gateway" },
              { key: "status", label: "Status" },
              { key: "createdAt", label: "Date" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}