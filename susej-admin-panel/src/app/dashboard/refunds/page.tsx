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
import { RotateCcw, CheckCircle2, XCircle, Send } from "lucide-react";
import type { RefundRequest } from "@/types";

const column = createColumnHelper<RefundRequest>();

const STATUS_VARIANT: Record<RefundRequest["status"], "warning" | "success" | "danger" | "info"> = {
  requested: "warning",
  approved: "info",
  rejected: "danger",
  refunded: "success",
};

// Mirrors the app lifecycle: requested (buyer) -> approved/rejected (seller + admin) -> refunded (finance).
const makeColumns = (
  onApprove: (r: RefundRequest) => void,
  onReject: (r: RefundRequest) => void,
  onIssue: (r: RefundRequest) => void
) => [
  column.accessor("id", { header: "Refund", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  column.accessor("orderRef", {
    header: "Order",
    cell: (info) => <span className="font-mono text-[13px] text-[#18181B]">{info.getValue()}</span>,
  }),
  column.accessor("buyerName", { header: "Buyer" }),
  column.accessor("sellerName", { header: "Seller", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("reason", { header: "Reason", cell: (info) => <span className="max-w-[220px] truncate text-[#71717A]">{info.getValue()}</span> }),
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
      const r = info.row.original;
      if (r.status === "requested") {
        return (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onApprove(r)}>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
              Approve
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onReject(r)}>
              <XCircle className="h-3.5 w-3.5 text-[#EF4444]" />
              Reject
            </Button>
          </div>
        );
      }
      if (r.status === "approved") {
        return (
          <Button variant="primary" size="sm" onClick={() => onIssue(r)}>
            <Send className="h-3.5 w-3.5" /> Mark issued
          </Button>
        );
      }
      return null;
    },
  }),
];

export default function RefundsPage() {
  const { data: refunds, refresh } = useDbResource<RefundRequest>("refunds");
  const [rows, setRows] = useState<RefundRequest[] | null>(refunds);
  const [confirm, setConfirm] = useState<{ r: RefundRequest; decision: "approve" | "reject" } | null>(null);

  useEffect(() => {
    setRows(refunds ?? null);
  }, [refunds]);

  const pending = (rows ?? []).filter((r) => r.status === "requested");
  const approved = (rows ?? []).filter((r) => r.status === "approved");
  const refundedAmount = (rows ?? []).filter((r) => r.status === "refunded").reduce((s, r) => s + r.amount, 0);

  function patchRow(r: RefundRequest, data: Partial<RefundRequest>) {
    setRows((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, ...data } : x)));
    fetch("/api/data/refunds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, data }),
    }).finally(() => {
      setConfirm(null);
      refresh();
    });
  }

  function handleDecision() {
    if (!confirm) return;
    const { r, decision } = confirm;
    patchRow(r, { status: decision === "approve" ? "approved" : "rejected", respondedAt: new Date().toISOString() });
  }

  function handleIssue(r: RefundRequest) {
    patchRow(r, { status: "refunded", respondedAt: new Date().toISOString() });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Refunds</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          Refund requests mirror the app lifecycle: buyer requests, seller responds, finance issues.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total requests" value={(rows ?? []).length} />
        <StatTile label="Requested" value={pending.length} tone="amber" />
        <StatTile label="Approved, pending issue" value={approved.length} tone="purple" />
        <StatTile label="Refunded amount" value={formatCurrency(refundedAmount)} tone="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Refund Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(
              (r) => setConfirm({ r, decision: "approve" }),
              (r) => setConfirm({ r, decision: "reject" }),
              handleIssue
            )}
            data={rows ?? []}
            searchable
            searchKey="orderRef"
            filename="refunds"
            exportColumns={[
              { key: "id", label: "Refund" },
              { key: "orderRef", label: "Order" },
              { key: "buyerName", label: "Buyer" },
              { key: "sellerName", label: "Seller" },
              { key: "reason", label: "Reason" },
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
              <RotateCcw className="h-6 w-6 text-[#6C3BFF]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#18181B]">
              {confirm.decision === "approve" ? "Approve refund" : "Reject refund"}
            </h3>
            <p className="mt-2 text-sm text-[#71717A]">
              {confirm.decision === "approve"
                ? `Approve refund of ${formatCurrency(confirm.r.amount)} to ${confirm.r.buyerName} for ${confirm.r.orderRef}? The seller has agreed to this request.`
                : `Reject the refund request from ${confirm.r.buyerName} for ${confirm.r.orderRef}?`}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant={confirm.decision === "approve" ? "primary" : "danger"} onClick={handleDecision}>
                {confirm.decision === "approve" ? "Approve refund" : "Reject refund"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
