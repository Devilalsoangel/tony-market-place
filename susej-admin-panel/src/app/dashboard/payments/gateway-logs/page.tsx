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
import type { GatewayLog } from "@/types";

const column = createColumnHelper<GatewayLog>();

const columns = [
  column.accessor("id", { header: "Log ID", cell: (info) => <span className="font-mono text-xs text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("gateway", {
    header: "Gateway",
    cell: (info) => <Badge variant={info.getValue() === "Bank Transfer" ? "info" : "primary"}>{info.getValue()}</Badge>,
  }),
  column.accessor("event", { header: "Event", cell: (info) => <span className="font-mono text-xs text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("amount", { header: "Amount", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant={info.getValue() === "success" ? "success" : "danger"} className="capitalize">
        {info.getValue()}
      </Badge>
    ),
  }),
  column.accessor("message", { header: "Response", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("createdAt", { header: "Time", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue(), "long")}</span> }),
];

export default function GatewayLogsPage() {
  const { data: logs } = useDbResource<GatewayLog>("gateway-logs");
  const [gatewayFilter, setGatewayFilter] = useState("all");

  const filtered = useMemo(
    () => (logs ?? []).filter((l) => gatewayFilter === "all" || l.gateway === gatewayFilter),
    [logs, gatewayFilter]
  );

  const failed = (logs ?? []).filter((l) => l.status === "failed").length;
  const successRate = logs && logs.length > 0 ? Math.round(((logs.length - failed) / logs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Gateway Logs</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Raw payment gateway responses and errors.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total calls" value={(logs ?? []).length} />
        <StatTile label="Success rate" value={`${successRate}%`} tone="green" />
        <StatTile label="Failed" value={failed} tone="red" />
        <StatTile label="Gateways" value={new Set((logs ?? []).map((l) => l.gateway)).size} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gateway Response Logs</CardTitle>
            <Select
              className="w-44"
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value)}
              options={[
                { label: "All Gateways", value: "all" },
                { label: "Stripe", value: "Stripe" },
                { label: "M-Pesa", value: "M-Pesa" },
                { label: "Razorpay", value: "Razorpay" },
                { label: "PayPal", value: "PayPal" },
                { label: "Bank Transfer", value: "Bank Transfer" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filtered}
            searchable
            searchKey="gateway"
            filename="gateway-logs"
            exportColumns={[
              { key: "id", label: "Log ID" },
              { key: "gateway", label: "Gateway" },
              { key: "event", label: "Event" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" },
              { key: "message", label: "Response" },
              { key: "createdAt", label: "Time" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}