"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { ServerTableBar } from "@/components/data-table/server-table-bar";
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

const STATUS_VARIANT: Record<WithdrawalRequest["status"] | "pending", "warning" | "info" | "danger" | "success"> = {
  pending: "warning", // legacy mirror value — normalized to "requested" server-side on decision
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
  column.accessor("destination", {
    header: "Destination",
    cell: (info) => {
      const v = String(info.getValue() ?? "");
      const legacy = /not recorded|no verified account/.test(v);
      return (
        <span className={legacy ? "text-[#B45309]" : "font-mono text-[13px] text-[#18181B]"}>
          {v || "—"}
        </span>
      );
    },
  }),
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
  // Server-driven queue (?q=&skip=&take=) + snapshot revert on refusal:
  // money decisions must never ghost-approved on a 409/offline.
  const [q, setQ] = useState("");
  const [skip, setSkip] = useState(0);
  const { data: withdrawals, loading: withdrawalsLoading, total: withdrawalsTotal, refresh } = useDbResource<WithdrawalRequest>("withdrawals", {
    take: 100,
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(skip > 0 ? { skip } : {}),
  });
  const [items, setItems] = useState<WithdrawalRequest[] | null>(withdrawals);
  const [confirm, setConfirm] = useState<{ w: WithdrawalRequest; decision: "approve" | "reject" | "complete" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(withdrawals ?? null);
  }, [withdrawals]);

  const pending = (items ?? []).filter((w) => w.status === "requested");
  const approved = (items ?? []).filter((w) => w.status === "approved");
  const paidOut = (items ?? []).filter((w) => w.status === "completed").reduce((s, w) => s + w.amount, 0);
  // Window qualifier shared by every count tile below (single source).
  const win = typeof withdrawalsTotal === "number" && withdrawalsTotal > (items ?? []).length ? " · first 100" : "";

  async function patchRow(w: WithdrawalRequest, data: Partial<WithdrawalRequest>) {
    setError(null);
    const snapshot = items;
    setItems((prev) => (prev ?? []).map((x) => (x.id === w.id ? { ...x, ...data } : x)));
    try {
      // credentials:"include" so the server session identifies the deciding
      // admin for the immutable audit trail (industry: state changes are
      // attributed, timestamped and reviewable).
      const res = await fetch("/api/data/withdrawals", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: w.id, data }),
      });
      if (!res.ok) {
        const j: { error?: string } = await res.json().catch(() => ({}));
        // Revert the optimistic flip: a maker-check 409 or offline refresh
        // failure used to leave approved rows the server refused.
        setItems(snapshot);
        setError(j.error || `Payout update failed (HTTP ${res.status}) — reverted.`);
      }
      // Audit trail is written server-side in the data-plane PATCH
      // (writeAuditSafe: action=data.update, admin identity from the session
      // cookie, before/after diff) — no client-side audit call needed.
    } catch {
      setItems(snapshot);
      setError("Network error — payout decision was not saved, reverted.");
    } finally {
      setConfirm(null);
      refresh();
    }
  }

  function handleDecision() {
    if (!confirm) return;
    const { w, decision } = confirm;
    // Mark-paid moves real money (bank transfer happened offline): it goes
    // through the same confirm dialog as approve/reject — no one-click payout.
    patchRow(
      w,
      decision === "complete"
        ? { status: "completed", respondedAt: new Date().toISOString() }
        : { status: decision === "approve" ? "approved" : "rejected", respondedAt: new Date().toISOString() }
    );
  }

  function handleComplete(w: WithdrawalRequest) {
    setConfirm({ w, decision: "complete" });
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
        <StatTile label={`Total requested${typeof withdrawalsTotal === "number" && withdrawalsTotal > (withdrawals ?? []).length ? " (first 100)" : ""}`} value={formatCurrency((items ?? []).reduce((s, w) => s + w.amount, 0))} />
        <StatTile label={`Requested${win}`} value={pending.length} tone="amber" />
        <StatTile label={`Approved, pending pay${win}`} value={approved.length} tone="purple" />
        <StatTile label={`Paid out${typeof withdrawalsTotal === "number" && withdrawalsTotal > (withdrawals ?? []).length ? " (first 100)" : ""}`} value={formatCurrency(paidOut)} tone="green" />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payout Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <ServerTableBar
            q={q}
            onQ={(v) => { setQ(v); setSkip(0); }}
            skip={skip}
            onSkip={setSkip}
            total={withdrawalsTotal}
            loaded={(items ?? []).length}
            searchPlaceholder="Search seller, method, status…"
          />
          <DataTable loading={withdrawalsLoading}
            columns={makeColumns(
              (w) => setConfirm({ w, decision: "approve" }),
              (w) => setConfirm({ w, decision: "reject" }),
              handleComplete
            )}
            data={items ?? []}
            totalCount={withdrawalsTotal ?? (items ?? []).length}
            searchable
            searchKey="userName"
            filename="withdrawals"
            exportColumns={[
              { key: "id", label: "Request" },
              { key: "userName", label: "Seller" },
              { key: "method", label: "Account" },
              { key: "destination", label: "Destination" },
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
              {confirm.decision === "approve" ? "Approve payout" : confirm.decision === "complete" ? "Confirm money paid" : "Reject payout"}
            </h3>
            <p className="mt-2 text-sm text-[#71717A]">
              {confirm.decision === "approve"
                ? `Approve ${formatCurrency(confirm.w.amount)} payout to ${confirm.w.userName} (${confirm.w.method})?`
                : confirm.decision === "complete"
                  ? `Confirm ${formatCurrency(confirm.w.amount)} was actually paid to ${confirm.w.userName}? Only confirm after the bank transfer completes — this is irreversible.`
                  : `Reject the payout request of ${formatCurrency(confirm.w.amount)} from ${confirm.w.userName}?`}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant={confirm.decision === "reject" ? "danger" : "primary"} onClick={handleDecision}>
                {confirm.decision === "approve" ? "Approve payout" : confirm.decision === "complete" ? "Yes, money paid" : "Reject payout"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
