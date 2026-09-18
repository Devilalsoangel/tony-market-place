"use client";

import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { Dialog } from "@/components/ui/dialog";
import { useDbResource } from "@/hooks/use-db-resource";
import { Megaphone, RotateCcw, Banknote, CalendarClock } from "lucide-react";
import type { PromotionPurchase, PromotionKind, PromotionStatus } from "@/types";
import { PROMOTION_KIND_LABEL } from "@/types";

// susej is an Indian marketplace — promo pricing is INR everywhere (admin catalog + seller app).
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const column = createColumnHelper<PromotionPurchase>();

const STATUS_BADGE: Record<PromotionStatus, { variant: "success" | "info" | "default" | "danger"; label: string }> = {
  active: { variant: "success", label: "Active" },
  pending_payment: { variant: "info", label: "Pending payment" },
  expired: { variant: "default", label: "Expired" },
  refunded: { variant: "danger", label: "Refunded" },
};

const KIND_TONE: Record<PromotionKind, "primary" | "success" | "info"> = {
  topSeller: "primary",
  hotDeal: "success",
  featuredPost: "info",
  spotlight: "success",
};

function daysLeft(endsAt?: string): number {
  if (!endsAt) return 0;
  return Math.max(0, (new Date(endsAt).getTime() - Date.now()) / 864e5);
}

const makeColumns = (
  onRefund: (p: PromotionPurchase) => void
) => [
  column.display({
    id: "package",
    header: "Package",
    cell: (info) => {
      const p = info.row.original;
      return (
        <div>
          <div className="font-medium text-[#18181B]">{p.packageName}</div>
          {p.productName ? (
            <div className="text-[12px] text-[#71717A]">{p.productName}</div>
          ) : p.postTitle ? (
            <div className="max-w-[220px] truncate text-[12px] text-[#71717A]">{p.postTitle}</div>
          ) : null}
        </div>
      );
    },
  }),
  column.accessor("sellerName", { header: "Seller", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  column.display({
    id: "kind",
    header: "Type",
    cell: (info) => <Badge variant={KIND_TONE[info.row.original.kind]}>{PROMOTION_KIND_LABEL[info.row.original.kind]}</Badge>,
  }),
  column.accessor("amountPaid", {
    header: "Paid",
    cell: (info) => <span className="font-medium tabular-nums">{inr(info.getValue())}</span>,
  }),
  column.accessor("durationDays", { header: "Duration", cell: (info) => <span className="tabular-nums text-[#71717A]">{info.getValue()}d</span> }),
  // Performance (views/clicks/CTR) intentionally NOT shown: the app emits no
  // impression events yet, so any column here would read 0 forever — a dead
  // metric masquerading as measurement. It returns with the event pipeline.
  column.accessor("status", {
    header: "Status",
    cell: (info) => {
      const { variant, label } = STATUS_BADGE[info.getValue()];
      return <Badge variant={variant}>{label}</Badge>;
    },
  }),
  column.display({
    id: "ends",
    header: "Ends In",
    cell: (info) => {
      const p = info.row.original;
      if (p.status !== "active") return <span className="text-[#71717A]">—</span>;
      const d = daysLeft(p.endsAt);
      return (
        <span className={`tabular-nums ${d < 3 ? "font-medium text-[#D97706]" : "text-[#71717A]"}`}>
          {d < 1 ? `${Math.max(1, Math.round(d * 24))}h` : `${d.toFixed(1)}d`}
        </span>
      );
    },
  }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const p = info.row.original;
      if (p.status !== "active") {
        return p.status === "pending_payment" ? (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-[#EF4444] hover:bg-[#EF4444]/5" onClick={() => onRefund(p)}>
              <RotateCcw className="h-3.5 w-3.5" /> Void
            </Button>
          </div>
        ) : null;
      }
      return (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" className="text-[#EF4444] hover:bg-[#EF4444]/5" onClick={() => onRefund(p)}>
            <RotateCcw className="h-3.5 w-3.5" /> Refund & unpin
          </Button>
        </div>
      );
    },
  }),
];

export default function PromotionsPage() {
  const { data: rows, loading: rowsLoading, total: promosTotal, refresh } = useDbResource<PromotionPurchase>("promotions", { take: 100 });
  const [items, setItems] = useState<PromotionPurchase[] | null>(rows);
  const [kindFilter, setKindFilter] = useState<PromotionKind | "all">("all");
  const [refundTarget, setRefundTarget] = useState<PromotionPurchase | null>(null);

  useEffect(() => {
    setItems(rows ?? null);
  }, [rows]);

  function patch(id: string, data: Partial<PromotionPurchase>) {
    const snapshot = items;
    setItems((prev) => (prev ?? []).map((p) => (p.id === id ? { ...p, ...data } : p)));
    fetch("/api/data/promotions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, data }),
    })
      .then(async (res) => {
        // Roll back the optimistic flip when the server refuses (e.g. the
        // money-field guard) — the row must never show a state that didn't persist.
        if (!res.ok) setItems(snapshot);
      })
      .catch(() => setItems(snapshot))
      .finally(refresh);
  }

  function handleRefund() {
    if (!refundTarget) return;
    patch(refundTarget.id, { status: "refunded", isPinned: false });
    setRefundTarget(null);
  }

  const list = useMemo(() => {
    const base = items ?? [];
    return kindFilter === "all" ? base : base.filter((p) => p.kind === kindFilter);
  }, [items, kindFilter]);

  const active = (items ?? []).filter((p) => p.status === "active");
  const pending = (items ?? []).filter((p) => p.status === "pending_payment").length;
  const expired = (items ?? []).filter((p) => p.status === "expired").length;
  const revenue = (items ?? []).filter((p) => p.status !== "refunded" && p.status !== "expired").reduce((s, p) => s + p.amountPaid, 0);

  const counts = useMemo(() => {
    const base = items ?? [];
    return {
      topSeller: base.filter((p) => p.kind === "topSeller").length,
      hotDeal: base.filter((p) => p.kind === "hotDeal").length,
      featuredPost: base.filter((p) => p.kind === "featuredPost").length,
      spotlight: base.filter((p) => p.kind === "spotlight").length,
    };
  }, [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Promotions & Ads</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          Sellers pay to boost visibility — Top Seller Spotlight, Hot Deals and Boost Posts (IG / OLX / FB model).
          Monitor live campaigns or refund & unpin. Slot extensions are re-purchases (keeps purchase and home-slot expiry in sync).
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Active campaigns" value={active.length} tone="purple" />
        <StatTile label={`Promo revenue${typeof promosTotal === "number" && promosTotal > (items ?? []).length ? " (first 100)" : ""}`} value={inr(revenue)} tone="green" />
        <StatTile label="Expired campaigns" value={expired} tone="default" />
        <StatTile label="Pending payment" value={pending} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {(["topSeller", "hotDeal", "featuredPost", "spotlight"] as const).map((kind) => (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[14px]">
                <Megaphone className="h-4 w-4 text-[#6C3BFF]" />
                {PROMOTION_KIND_LABEL[kind]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-[#18181B]">{counts[kind]}</span>
                <span className="text-[12px] text-[#71717A]">campaigns</span>
              </div>
              <p className="mt-1.5 text-[12px] leading-5 text-[#71717A]">
                {kind === "topSeller" && "Pins the seller in the home Top Sellers rail. 7d ₹599 / 30d ₹1999."}
                {kind === "hotDeal" && "Pins a product in Hot Deals with a URGENT badge. 7d ₹499 / 30d ₹1499."}
                {kind === "featuredPost" && "Shows the post as Sponsored in buyer feeds. 7d ₹349 / 30d ₹999."}
                {kind === "spotlight" && "Pin-to-Top: listing #1 in buyer feeds for a day. 24h ₹49 (impulse SKU)."}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Queue</CardTitle>
          <div className="mt-3 flex gap-2">
            {(["all", "spotlight", "topSeller", "hotDeal", "featuredPost"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={kindFilter === k ? "primary" : "secondary"}
                onClick={() => setKindFilter(k)}
              >
                {k === "all" ? "All" : PROMOTION_KIND_LABEL[k]}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <DataTable loading={rowsLoading}
            columns={makeColumns(setRefundTarget)}
            data={list}
            totalCount={kindFilter === "all" ? (promosTotal ?? list.length) : null}
            searchable
            searchKey="sellerName"
            filename="promotions"
            exportColumns={[
              { key: "packageName", label: "Package" },
              { key: "sellerName", label: "Seller" },
              { key: "amountPaid", label: "Paid" },
              { key: "durationDays", label: "Duration" },
              { key: "status", label: "Status" },
              { key: "endsAt", label: "Ends At" },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={!!refundTarget} onClose={() => setRefundTarget(null)} title="Refund & unpin campaign?">
        <p className="text-sm text-[#71717A]">
          <strong className="text-[#18181B]">{refundTarget?.packageName}</strong> by{" "}
          <strong className="text-[#18181B]">{refundTarget?.sellerName}</strong> ({inr(refundTarget?.amountPaid ?? 0)})
          will be refunded to the seller wallet, the slot unpinned immediately and the campaign ended. This mirrors the
          payment-engine refund flow.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRefundTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRefund}>
            <RotateCcw className="h-4 w-4" /> Refund & unpin
          </Button>
        </div>
      </Dialog>

      <div className="grid grid-cols-4 gap-4">
        <div className="flex items-center gap-2 text-[13px] text-[#71717A]">
          <CalendarClock className="h-4 w-4" />
          Impression / click tracking ships with the app event pipeline — no zeros shown until then
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[#71717A]">
          <CalendarClock className="h-4 w-4" />
          Expired campaigns unpin automatically (lazy sweep on every data read)
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[#71717A]">
          <Banknote className="h-4 w-4" />
          Payments flow through the wallet — promo spend is a wallet debit, refunds credit it back
        </div>
      </div>
    </div>
  );
}
