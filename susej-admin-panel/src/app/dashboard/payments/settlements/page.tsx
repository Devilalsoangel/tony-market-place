"use client";

import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { LedgerEntry } from "@/types";

interface SettlementRow {
  id: string;
  sellerName: string;
  orderId: string;
  gross: number;
  commission: number;
  net: number;
  method: LedgerEntry["method"];
  status: LedgerEntry["status"];
  createdAt: string;
}

const column = createColumnHelper<SettlementRow>();

const columns = [
  column.accessor("id", { header: "Settlement", cell: (info) => <span className="font-mono text-xs text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("sellerName", { header: "Seller", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  column.accessor("orderId", { header: "Order", cell: (info) => <span className="font-mono text-sm text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("gross", { header: "Gross", cell: (info) => <span className="tabular-nums">{formatCurrency(info.getValue())}</span> }),
  column.accessor("commission", { header: "Commission", cell: (info) => <span className="tabular-nums text-[#EF4444]">-{formatCurrency(info.getValue())}</span> }),
  column.accessor("net", { header: "Net Payout", cell: (info) => <span className="font-medium tabular-nums text-[#16A34A]">{formatCurrency(info.getValue())}</span> }),
  column.accessor("method", { header: "Method", cell: (info) => <span className="capitalize text-[#71717A]">{String(info.getValue()).replace("_", " ")}</span> }),
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

export default function SettlementsPage() {
  const { data: ledger } = useDbResource<LedgerEntry>("ledger");

  const settlements: SettlementRow[] = useMemo(() => {
    const settled = (ledger ?? []).filter((l) => l.type === "settlement" || l.type === "payout");
    const feeMap = new Map((ledger ?? []).filter((l) => l.type === "fee").map((f) => [f.orderId, f.amount]));
    return settled.map((s) => ({
      id: s.id,
      sellerName: s.partyName,
      orderId: s.orderId,
      gross: s.direction === "out" ? s.amount + (feeMap.get(s.orderId) ?? 0) : s.amount,
      commission: feeMap.get(s.orderId) ?? 0,
      net: s.amount,
      method: s.method,
      status: s.status,
      createdAt: s.createdAt,
    }));
  }, [ledger]);

  const totalNet = useMemo(() => settlements.filter((s) => s.status === "success").reduce((sum, s) => sum + s.net, 0), [settlements]);
  const totalCommission = useMemo(() => settlements.reduce((sum, s) => sum + s.commission, 0), [settlements]);
  const pendingSettlements = useMemo(() => settlements.filter((s) => s.status === "pending"), [settlements]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Settlements</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Seller payout settlement history: gross, commission, net.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total net paid" value={formatCurrency(totalNet)} tone="green" />
        <StatTile label="Total commission" value={formatCurrency(totalCommission)} tone="amber" />
        <StatTile label="Pending settlements" value={pendingSettlements.length} tone="amber" />
        <StatTile label="Settlements" value={settlements.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settlement History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={settlements}
            searchable
            searchKey="sellerName"
            filename="settlements"
            exportColumns={[
              { key: "id", label: "Settlement" },
              { key: "sellerName", label: "Seller" },
              { key: "orderId", label: "Order" },
              { key: "gross", label: "Gross" },
              { key: "commission", label: "Commission" },
              { key: "net", label: "Net" },
              { key: "status", label: "Status" },
              { key: "createdAt", label: "Date" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}