"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { Dialog } from "@/components/ui/dialog";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Gavel, Ban, Clock3, Trash2, CheckCircle2 } from "lucide-react";
import type { MockAuction } from "@/types/admin-rows";

const column = createColumnHelper<MockAuction>();

function hoursLeft(endsAt: string): number {
  return Math.max(0, (new Date(endsAt).getTime() - Date.now()) / 36e5);
}

const makeColumns = (
  onClose: (a: MockAuction) => void,
  onExtend: (a: MockAuction) => void,
  onDelete: (a: MockAuction) => void
) => [
  column.accessor("title", { header: "Listing", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("sellerName", { header: "Seller", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("currentBid", { header: "Current Bid", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  column.accessor("bids", { header: "Bids", cell: (info) => <span className="tabular-nums text-[#71717A]">{info.getValue()}</span> }),
  column.display({
    id: "endsIn",
    header: "Ends In",
    cell: (info) => {
      const a = info.row.original;
      if (a.status === "ended") return <span className="text-[#71717A]">—</span>;
      if (a.status === "upcoming") return <Badge variant="info">Upcoming</Badge>;
      const h = hoursLeft(a.endsAt);
      const text = h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
      return (
        <span className={`tabular-nums ${h < 24 ? "font-medium text-[#D97706]" : "text-[#71717A]"}`}>
          {text}
        </span>
      );
    },
  }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => {
      const s = info.getValue();
      return s === "live" ? (
        <Badge variant="success">Live</Badge>
      ) : s === "upcoming" ? (
        <Badge variant="info">Upcoming</Badge>
      ) : (
        <Badge variant="default">Ended</Badge>
      );
    },
  }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const a = info.row.original;
      if (a.status !== "live") {
        return (
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="text-[#EF4444] hover:bg-[#EF4444]/5" onClick={() => onDelete(a)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        );
      }
      return (
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => onExtend(a)}>
            <Clock3 className="h-3.5 w-3.5" /> Extend 24h
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onClose(a)}>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Close early
          </Button>
          <Button variant="ghost" size="sm" className="text-[#EF4444] hover:bg-[#EF4444]/5" onClick={() => onDelete(a)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    },
  }),
];

export default function AuctionsPage() {
  const { data: rows, refresh } = useDbResource<MockAuction>("auctions");
  const [items, setItems] = useState<MockAuction[] | null>(rows);
  const [deleteTarget, setDeleteTarget] = useState<MockAuction | null>(null);

  useEffect(() => {
    setItems(rows ?? null);
  }, [rows]);

  function patch(id: string, data: Partial<MockAuction>) {
    setItems((prev) => (prev ?? []).map((a) => (a.id === id ? { ...a, ...data } : a)));
    fetch("/api/data/auctions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, data }),
    }).finally(refresh);
  }

  function closeEarly(a: MockAuction) {
    patch(a.id, { status: "ended" });
  }

  function extend24h(a: MockAuction) {
    patch(a.id, { endsAt: new Date(new Date(a.endsAt).getTime() + 24 * 36e5).toISOString() });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setItems((prev) => (prev ?? []).filter((a) => a.id !== deleteTarget.id));
    fetch("/api/data/auctions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: deleteTarget.id }),
    }).finally(() => {
      setDeleteTarget(null);
      refresh();
    });
  }

  const live = (items ?? []).filter((a) => a.status === "live");
  const liveValue = live.reduce((s, a) => s + a.currentBid, 0);
  const endingSoon = live.filter((a) => hoursLeft(a.endsAt) < 24).length;
  const upcoming = (items ?? []).filter((a) => a.status === "upcoming").length;
  const ended = (items ?? []).filter((a) => a.status === "ended").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Auctions</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          Live bidding listings — monitor, close early, extend, or remove.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Live auctions" value={live.length} tone="purple" />
        <StatTile label="Live bid value" value={formatCurrency(liveValue)} tone="green" />
        <StatTile label="Upcoming" value={upcoming} tone="purple" />
        <StatTile label="Ended" value={ended} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auction Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(closeEarly, extend24h, setDeleteTarget)}
            data={items ?? []}
            searchable
            searchKey="title"
            filename="auctions"
            emptyTitle="No auctions running"
            emptyDescription="Sellers start live-bidding listings from the app's Create flow — auctions appear here to monitor, close early, extend, or remove."
            exportColumns={[
              { key: "title", label: "Listing" },
              { key: "sellerName", label: "Seller" },
              { key: "currentBid", label: "Current Bid" },
              { key: "bids", label: "Bids" },
              { key: "endsAt", label: "Ends At" },
              { key: "status", label: "Status" },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove auction listing?">
        <p className="text-sm text-[#71717A]">
          "{deleteTarget?.title}" will be removed from the marketplace. Bids on it are void —
          contact the seller and bidders directly, as no automatic notifications are sent.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            <Ban className="h-4 w-4" /> Remove auction
          </Button>
        </div>
      </Dialog>

      <div className="flex items-center gap-2 text-[13px] text-[#71717A]">
        <Gavel className="h-4 w-4" />
        Close early ends bidding with the current highest bid recorded as the winner — order and
        payment are arranged between seller and buyer. Extend 24h pushes the deadline for
        active auctions only.
      </div>
    </div>
  );
}