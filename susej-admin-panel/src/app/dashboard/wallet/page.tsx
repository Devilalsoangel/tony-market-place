"use client";

import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction, LedgerEntry, WithdrawalRequest, RefundRequest } from "@/types";

const tColumn = createColumnHelper<Transaction>();

const tColumns = [
  tColumn.accessor("id", { header: "Transaction", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  tColumn.accessor("userName", { header: "User" }),
  tColumn.accessor("type", {
    header: "Type",
    cell: (info) => <Badge variant={info.getValue() === "withdrawal" ? "warning" : info.getValue() === "refund" ? "danger" : info.getValue() === "settlement" ? "success" : "info"} className="capitalize">{info.getValue()}</Badge>,
  }),
  tColumn.accessor("amount", { header: "Amount", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  tColumn.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant={info.getValue() === "success" ? "success" : info.getValue() === "pending" ? "warning" : "danger"} className="capitalize">
        {info.getValue()}
      </Badge>
    ),
  }),
  tColumn.accessor("createdAt", { header: "Date", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
];

const lColumn = createColumnHelper<LedgerEntry>();

const lColumns = [
  lColumn.accessor("id", { header: "Entry", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  lColumn.accessor("partyName", { header: "Party" }),
  lColumn.accessor("partyRole", { header: "Role", cell: (info) => <Badge variant="default" className="capitalize">{info.getValue()}</Badge> }),
  lColumn.accessor("direction", {
    header: "Direction",
    cell: (info) => (
      <Badge variant={info.getValue() === "in" ? "success" : "warning"} className="capitalize">{info.getValue()}</Badge>
    ),
  }),
  lColumn.accessor("type", { header: "Type", cell: (info) => <span className="capitalize">{info.getValue()}</span> }),
  lColumn.accessor("amount", { header: "Amount", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  lColumn.accessor("orderId", { header: "Order" }),
  lColumn.accessor("createdAt", { header: "Date", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
];

export default function WalletPage() {
  const { data: txns, total: txnsTotal, loading: txnsLoading } = useDbResource<Transaction>("transactions", { take: 100 });
  const { data: ledger, total: ledgerTotal, loading: ledgerLoading } = useDbResource<LedgerEntry>("ledger", { take: 100 });
  // Pending money lives in the decision queues (the transactions projection
  // is settled-only, status success) — requested withdrawals + refunds.
  const { data: pendingWd } = useDbResource<WithdrawalRequest>("withdrawals", { status: "requested", take: 100 });
  const { data: pendingRf } = useDbResource<RefundRequest>("refunds", { status: "requested", take: 100 });

  const totals = useMemo(() => {
    const inTotal = (ledger ?? []).filter((l) => l.direction === "in").reduce((s, l) => s + l.amount, 0);
    const outTotal = (ledger ?? []).filter((l) => l.direction === "out").reduce((s, l) => s + l.amount, 0);
    const pending =
      (pendingWd ?? []).reduce((s, w) => s + Math.max(0, Number(w.amount) || 0), 0) +
      (pendingRf ?? []).reduce((s, r) => s + Math.max(0, Number(r.amount) || 0), 0);
    return { inTotal, outTotal, net: inTotal - outTotal, pending };
  }, [ledger, pendingWd, pendingRf]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Wallet</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Wallet movements, withdrawals and settlements.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label={`Credits (in)${typeof ledgerTotal === "number" && ledgerTotal > (ledger ?? []).length ? " (first 100)" : ""}`} value={formatCurrency(totals.inTotal)} tone="green" />
        <StatTile label={`Debits (out)${typeof ledgerTotal === "number" && ledgerTotal > (ledger ?? []).length ? " (first 100)" : ""}`} value={formatCurrency(totals.outTotal)} tone="red" />
        <StatTile label={`Net balance${typeof ledgerTotal === "number" && ledgerTotal > (ledger ?? []).length ? " (first 100)" : ""}`} value={formatCurrency(totals.net)} tone={totals.net >= 0 ? "default" : "red"} />
        <StatTile label="Pending (requested payouts + refunds)" value={formatCurrency(totals.pending)} tone="amber" />
      </div>

      <Tabs
        tabs={[
          { label: "Transactions", value: "transactions" },
          { label: "Ledger", value: "ledger" },
        ]}
      >
        {(active) => (
          <>
            {active === "transactions" && (
              <Card>
                <CardHeader>
                  <CardTitle>Wallet Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={tColumns}
                    data={txns ?? []}
                    totalCount={txnsTotal ?? (txns ?? []).length}
                    loading={txnsLoading}
                    searchable
                    searchKey="userName"
                    filename="wallet-transactions"
                    exportColumns={[
                      { key: "id", label: "Transaction" },
                      { key: "userName", label: "User" },
                      { key: "type", label: "Type" },
                      { key: "amount", label: "Amount" },
                      { key: "status", label: "Status" },
                      { key: "createdAt", label: "Date" },
                    ]}
                  />
                </CardContent>
              </Card>
            )}

            {active === "ledger" && (
              <Card>
                <CardHeader>
                  <CardTitle>Ledger Entries</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={lColumns}
                    data={ledger ?? []}
                    totalCount={ledgerTotal ?? (ledger ?? []).length}
                    loading={ledgerLoading}
                    searchable
                    searchKey="partyName"
                    filename="ledger"
                    exportColumns={[
                      { key: "id", label: "Entry" },
                      { key: "partyName", label: "Party" },
                      { key: "partyRole", label: "Role" },
                      { key: "direction", label: "Direction" },
                      { key: "type", label: "Type" },
                      { key: "amount", label: "Amount" },
                      { key: "orderId", label: "Order" },
                      { key: "createdAt", label: "Date" },
                    ]}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}