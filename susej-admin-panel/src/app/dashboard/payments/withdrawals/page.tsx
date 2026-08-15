"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Wallet, CheckCircle2, XCircle, Banknote } from "lucide-react";
import type { WithdrawalRequest } from "@/types";

const column = createColumnHelper<WithdrawalRequest>();

const STATUS_VARIANT: Record<WithdrawalRequest["status"], "warning" | "info" | "danger" | "success"> = {
  requested: "warning",
  approved: "info",
  rejected: "danger",
  completed: "success",
};

// Mirrors the app wallet flow: requested (seller) -> approved/rejected (finance) -> completed (paid out).
const makeColumns = (
  onApprove: (w: WithdrawalRequest) => void,
  onReject: (w: WithdrawalRequest) => void,
  onComplete: (w: WithdrawalRequest) => void
) => [
  column.accessor("id", { header: "Request", cell: (info) => <span className="font-mono text-[13px] font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("userName", { header: "Seller", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  column.accessor("method", { header: "Account", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("amount", { header: "Amount", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => {
      const s = info.getValue();
      return (
        <Badge variant={STATUS_VARIANT[s]} className="capitalize">
          {s}
        </Badge>
      );
    },
  }),
  column.accessor("requestedAt", { header: "Requested", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const w = info.row.original;
      if (w.status === "requested") {
        return (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onApprove(w)}>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
              Approve
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onReject(w)}>
              <XCircle className="h-3.5 w-3.5 text-[#EF4444]" />
              Reject
            </Button>
          </div>
        );
      }
      if (w.status === "approved") {
        return (
          <Button variant="primary" size="sm" onClick={() => onComplete(w)}>
            <Banknote className="h-3.5 w-3.5" /> Mark paid
          </Button>
        );
      }
      return null;
    },
  }),
];

export default function WithdrawalsPage() {
  const { data: withdrawals, refresh } = useDbResource<WithdrawalRequest>("withdrawals");
  const [items, setItems] = useState<WithdrawalRequest[] | null>(withdrawals);
  const [confirm, setConfirm] = useState<{ w: WithdrawalRequest; decision: "approve" | "reject" } | null>(null);

  useEffect(() => {
    setItems(withdrawals ?? null);
  }, [withdrawals]);

  const pending = (items ?? []).filter((w) => w.status === "requested");
  const approved = (items ?? []).filter((w) => w.status === "approved");
  const paidOut = (items ?? []).filter((w) => w.status === "completed").reduce((s, w) => s + w.amount, 0);

  function patchRow(w: WithdrawalRequest, data: Partial<WithdrawalRequest>) {
    setItems((prev) => (prev ?? []).map((x) => (x.id === w.id ? { ...x, ...data } : x)));
    fetch("/api/data/withdrawals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: w.id, data }),
    }).finally(() => {
      setConfirm(null);
      refresh();
    });
  }

  function handleDecision() {
    if (!confirm) return;
    const { w, decision } = confirm;
    patchRow(w, { status: decision === "approve" ? "approved" : "rejected", respondedAt: new Date().toISOString() });
  }

  function handleComplete(w: WithdrawalRequest) {
    patchRow(w, { status: "completed", respondedAt: new Date().toISOString() });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Withdrawals</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          Payout requests mirror the app flow: seller requests, finance approves, bank pays out.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total requested" value={formatCurrency((items ?? []).reduce((s, w) => s + w.amount, 0))} />
        <StatTile label="Requested" value={pending.length} tone="amber" />
        <StatTile label="Approved, pending pay" value={approved.length} tone="purple" />
        <StatTile label="Paid out" value={formatCurrency(paidOut)} tone="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(
              (w) => setConfirm({ w, decision: "approve" }),
              (w) => setConfirm({ w, decision: "reject" }),
              handleComplete
            )}
            data={items ?? []}
            searchable
            searchKey="userName"
            filename="withdrawals"
            exportColumns={[
              { key: "id", label: "Request" },
              { key: "userName", label: "Seller" },
              { key: "method", label: "Account" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" },
              { key: "requestedAt", label: "Requested" },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        {confirm && (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#6C3BFF]/10">
              <Wallet className="h-6 w-6 text-[#6C3BFF]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#18181B]">
              {confirm.decision === "approve" ? "Approve payout" : "Reject payout"}
            </h3>
            <p className="mt-2 text-sm text-[#71717A]">
              {confirm.decision === "approve"
                ? `Approve ${formatCurrency(confirm.w.amount)} payout to ${confirm.w.userName} (${confirm.w.method})?`
                : `Reject the payout request of ${formatCurrency(confirm.w.amount)} from ${confirm.w.userName}?`}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant={confirm.decision === "approve" ? "primary" : "danger"} onClick={handleDecision}>
                {confirm.decision === "approve" ? "Approve payout" : "Reject payout"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
