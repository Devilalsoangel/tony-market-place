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
  column.accessor("method", { header: "Method", cell: (info) => <span className="capitalize text-[#71717A]">{String(info.getValue()).replaceAll("_", " ")}</span> }),
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
  // Bounded windows with honest captions: the tie-out below is only as deep
  // as the loaded window (server-side cursor export is the full-book path).
  const { data: ledger, loading: ledgerLoading, total: ledgerTotal } = useDbResource<LedgerEntry>("ledger", { take: 100 });
  const { data: dbOrders, loading: dbOrdersLoading, total: ordersTotal } = useDbResource<{ id: string; trackingNumber: string; amount: number; status: string }>("orders", { take: 100 });
  const partial =
    (typeof ledgerTotal === "number" && ledgerTotal > (ledger ?? []).length) ||
    (typeof ordersTotal === "number" && ordersTotal > (dbOrders ?? []).length);
  const windowNote = partial
    ? ` — recent window (${(ledger ?? []).length} ledger rows, ${(dbOrders ?? []).length} orders); full-book tie-out needs the server export`
    : "";

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

  // Three-way tie-out: every order must have ledger coverage, and each
  // order's legs must balance (charge == settlement + fee, reversals net out
  // on cancel). Exceptions surface here instead of hiding in two side-by-side
  // tables nobody joins.
  const exceptions = useMemo(() => {
    const rows = (ledger ?? []) as unknown as { orderId: string; type: string; direction: string; amount: number; status: string }[];
    const byOrder = new Map<string, { charge: number; settle: number; fee: number; reversalIn: number; reversalOut: number; pending: boolean }>();
    for (const l of rows) {
      if (!l.orderId) continue;
      const e = byOrder.get(l.orderId) ?? { charge: 0, settle: 0, fee: 0, reversalIn: 0, reversalOut: 0, pending: false };
      if (l.status === "pending") {
        // COD charge settles on delivery — not an exception while pending.
        if (l.type === "charge") e.pending = true;
        byOrder.set(l.orderId, e);
        continue;
      }
      if (l.type === "charge" && l.direction === "out") e.charge += l.amount;
      else if (l.type === "settlement" && l.direction === "in") e.settle += l.amount;
      else if (l.type === "fee" && l.direction === "in") e.fee += l.amount;
      else if (l.type === "reversal" && l.direction === "in") e.reversalIn += l.amount;
      else if (l.type === "reversal" && l.direction === "out") e.reversalOut += l.amount;
      byOrder.set(l.orderId, e);
    }
    const out: { orderId: string; label: string; reason: string }[] = [];
    for (const o of dbOrders ?? []) {
      const e = byOrder.get(o.id);
      if (!e || (e.charge === 0 && e.settle === 0 && !e.pending)) {
        // Pre-ledger legacy rows have no coverage — informational, not a break.
        out.push({ orderId: o.trackingNumber || o.id, label: o.trackingNumber || o.id, reason: "No ledger coverage (pre-ledger order)" });
        continue;
      }
      if (e.pending && e.settle === 0) continue; // COD in transit — settles on delivery.
      if (o.status === "cancelled") {
        if (e.reversalIn === 0 && e.reversalOut === 0) out.push({ orderId: o.id, label: o.trackingNumber || o.id, reason: "Cancelled but no reversal rows" });
      } else {
        // charge (items+delivery−discount) vs settle+fee (goods legs only).
        // diff == a delivery fee {0,12,30} ±1 rounding → honest delivery float.
        // diff < 0 → platform-funded coupon discount (charge below settle+fee).
        // Anything else → real unaccounted money.
        const diff = e.charge - (e.settle + e.fee);
        const isDeliveryFloat = [0, 12, 30].some((f) => Math.abs(diff - f) <= 1);
        if (!isDeliveryFloat) {
          out.push({
            orderId: o.id,
            label: o.trackingNumber || o.id,
            reason: diff < 0 ? `Platform-funded discount ${formatCurrency(-diff)}` : `Unaccounted ${formatCurrency(diff)} (charge vs settle+fee)`,
          });
        }
      }
    }
    return out.slice(0, 50);
  }, [ledger, dbOrders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Settlements</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Seller payout settlement history: gross, commission, net.{windowNote}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label={`Total net paid${partial ? " (first 100)" : ""}`} value={formatCurrency(totalNet)} tone="green" />
        <StatTile label={`Total commission${partial ? " (first 100)" : ""}`} value={formatCurrency(totalCommission)} tone="amber" />
        <StatTile label="Pending settlements" value={pendingSettlements.length} tone="amber" />
        <StatTile label="Settlements" value={settlements.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation exceptions {exceptions.length > 0 ? `(${exceptions.length})` : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#16A34A]">Loaded window ties out — every charge balances against settlement + fee{partial ? " (window-scoped, not full-book)" : ""}.</p>
          ) : (
            <div className="divide-y divide-[#E4E4E7]">
              {exceptions.map((x) => (
                <div key={x.orderId} className="flex items-center justify-between py-2">
                  <span className="font-mono text-sm text-[#18181B]">{x.label}</span>
                  <Badge variant="warning">{x.reason}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settlement History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable loading={ledgerLoading || dbOrdersLoading} columns={columns}
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