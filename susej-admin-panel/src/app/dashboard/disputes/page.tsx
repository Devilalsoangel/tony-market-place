"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { ServerTableBar } from "@/components/data-table/server-table-bar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useDbResource } from "@/hooks/use-db-resource";
import { useAuthStore } from "@/store/auth-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Scale, CheckCircle2, ShieldCheck } from "lucide-react";
import type { MockDispute } from "@/types/admin-rows";

const column = createColumnHelper<MockDispute>();

const statusVariant: Record<string, "danger" | "warning" | "success" | "default"> = {
  open: "danger",
  under_review: "warning",
  resolved: "success",
};

const OUTCOME_LABELS: Record<string, string> = {
  full_refund: "Full refund to buyer",
  release_seller: "Release payment to seller",
  split_50_50: "Split 50/50",
};

const makeColumns = (
  onReview: (d: MockDispute) => void,
  onResolve: (d: MockDispute) => void,
  canResolve: boolean
) => [
  column.accessor("id", { header: "Dispute", cell: (info) => <span className="font-mono text-sm font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("orderId", { header: "Order", cell: (info) => <span className="font-mono text-sm text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("buyerName", { header: "Buyer", cell: (info) => info.getValue() }),
  column.accessor("sellerName", { header: "Seller", cell: (info) => info.getValue() }),
  column.accessor("reason", { header: "Reason", cell: (info) => <Badge variant="danger">{info.getValue()}</Badge> }),
  column.accessor("amount", { header: "Amount", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={statusVariant[info.getValue()]} className="capitalize">{String(info.getValue()).replaceAll("_", " ")}</Badge>,
  }),
  column.display({
    id: "outcome",
    header: "Outcome",
    cell: (info) => {
      const d = info.row.original;
      if (!d.outcome) return <span className="text-[#A1A1AA]">—</span>;
      return (
        <span className="flex items-center gap-1.5 text-[13px] text-[#18181B]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#16A34A]" />
          {OUTCOME_LABELS[d.outcome]}
        </span>
      );
    },
  }),
  column.accessor("raisedAt", { header: "Raised", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const d = info.row.original;
      if (d.status === "resolved") return null;
      return (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onReview(d)}>
            <Scale className="h-3.5 w-3.5" /> Review
          </Button>
          {canResolve ? (
            <Button variant="ghost" size="sm" onClick={() => onResolve(d)}>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Resolve
            </Button>
          ) : null}
        </div>
      );
    },
  }),
];

export default function DisputesPage() {
  // Server-driven queue: q/skip ride useDbResource (?q=&skip=&take=) so rows
  // past the first 100 are searchable and reachable — client-only search
  // made row 101+ unfindable. Paging resets on new search.
  const [q, setQ] = useState("");
  const [skip, setSkip] = useState(0);
  const { data: rows, loading: rowsLoading, total: disputesTotal, refresh } = useDbResource<MockDispute>("disputes", {
    take: 100,
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(skip > 0 ? { skip } : {}),
  });
  const role = useAuthStore((s) => s.user?.role);
  // Resolution moves money — moderators triage (Review) only. Same matrix as
  // the API layer (normalizeRole): owner/superadmin/admin fold up.
  const canResolve = (() => {
    const r = String(role ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "_");
    return r === "super_admin" || r === "superadmin" || r === "owner" || r === "manager" || r === "admin";
  })();
  const [items, setItems] = useState<MockDispute[] | null>(rows);
  const [resolving, setResolving] = useState<MockDispute | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string>("full_refund");
  const [note, setNote] = useState("");

  useEffect(() => {
    setItems(rows ?? null);
  }, [rows]);

  function review(d: MockDispute) {
    const snapshot = items;
    setItems((prev) => (prev ?? []).map((x) => (x.id === d.id ? { ...x, status: "under_review" } : x)));
    fetch("/api/data/disputes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: d.id, data: { status: "under_review" } }),
    })
      .then(async (res) => {
        if (!res.ok) {
          // Roll back the optimistic flip — refresh() below snaps the row,
          // but not silently: the error banner names the failure.
          setItems(snapshot);
          const body = await res.json().catch(() => null);
          setResolveError(
            String((body as { error?: unknown } | null)?.error || `Could not mark ${d.id} under review (HTTP ${res.status}). Nothing changed.`)
          );
        }
      })
      .catch(() => {
        setItems(snapshot);
        setResolveError("Could not reach the server. Nothing changed.");
      })
      .finally(refresh);
  }

  function openResolve(d: MockDispute) {
    setResolving(d);
    setOutcome(d.outcome ?? "full_refund");
    setNote(d.note ?? "");
  }

  function submitResolution() {
    if (!resolving) return;
    const snapshot = items;
    const resolvedAt = new Date().toISOString();
    setItems((prev) =>
      (prev ?? []).map((x) =>
        x.id === resolving.id
          ? { ...x, status: "resolved" as const, outcome: outcome as MockDispute["outcome"], note, resolvedAt }
          : x
      )
    );
    fetch("/api/data/disputes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: resolving.id,
        data: { status: "resolved", outcome, note, resolvedAt },
      }),
    })
      .then(async (res) => {
        // Surface settlement refusals (unknown order, split/full already
        // paid): revert the optimistic resolve AND name it — a dual-control
        // 409 or offline refresh() failure used to leave approved rows the
        // server refused.
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setItems(snapshot);
          setResolveError(
            String((body as { error?: unknown } | null)?.error || `Ruling refused (HTTP ${res.status}). No money moved.`)
          );
          return;
        }
        setResolveError(null);
      })
      .catch(() => {
        setItems(snapshot);
        setResolveError("Could not reach the server. No money moved.");
      })
      .finally(() => {
        setResolving(null);
        refresh();
      });
  }

  const openList = (items ?? []).filter((d) => d.status === "open");
  const openAmount = openList.reduce((s, d) => s + d.amount, 0);
  const underReview = (items ?? []).filter((d) => d.status === "under_review").length;
  const resolved = (items ?? []).filter((d) => d.status === "resolved").length;
  // Window qualifier shared by every count tile below (single source).
  const win = typeof disputesTotal === "number" && disputesTotal > (items ?? []).length ? " · first 100" : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Disputes</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          Order disputes between buyers and sellers — review evidence and issue rulings.
        </p>
      </div>
      {resolveError && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[13px] text-[#B91C1C]">
          {resolveError}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <StatTile label={`Open disputes${win}`} value={openList.length} tone="red" />
        <StatTile label={`Open amount${win}`} value={formatCurrency(openAmount)} tone="red" />
        <StatTile label={`Under review${win}`} value={underReview} tone="amber" />
        <StatTile label={`Resolved${win}`} value={resolved} tone="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dispute Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <ServerTableBar
            q={q}
            onQ={(v) => { setQ(v); setSkip(0); }}
            skip={skip}
            onSkip={setSkip}
            total={disputesTotal}
            loaded={(items ?? []).length}
            searchPlaceholder="Search order, buyer, seller, reason…"
          />
          <DataTable loading={rowsLoading}
            columns={makeColumns(review, openResolve, canResolve)}
            data={items ?? []}
            totalCount={disputesTotal ?? (items ?? []).length}
            searchable
            searchKey="orderId"
            filename="disputes"
            exportColumns={[
              { key: "id", label: "Dispute" },
              { key: "orderId", label: "Order" },
              { key: "buyerName", label: "Buyer" },
              { key: "sellerName", label: "Seller" },
              { key: "reason", label: "Reason" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" },
              { key: "outcome", label: "Outcome" },
              { key: "raisedAt", label: "Raised" },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={!!resolving} onClose={() => setResolving(null)} title="Resolve dispute">
        {resolving && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#18181B]">
                    Order {resolving.orderId} · {formatCurrency(resolving.amount)}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#71717A]">
                    {resolving.buyerName} vs {resolving.sellerName}
                  </p>
                </div>
                <Badge variant="danger">{resolving.reason}</Badge>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#18181B]">Ruling</label>
              <Select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                options={[
                  { label: "Full refund to buyer", value: "full_refund" },
                  { label: "Release payment to seller", value: "release_seller" },
                  { label: "Split 50/50", value: "split_50_50" },
                ]}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#18181B]">
                Resolution note (visible to both parties)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. Tracking shows delivered but photo evidence supports buyer. Refunding."
                className="w-full resize-none rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3 text-sm text-[#18181B] outline-none focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setResolving(null)}>
                Cancel
              </Button>
              <Button onClick={submitResolution}>
                <CheckCircle2 className="h-4 w-4" /> Issue ruling
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}