"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatDate, formatNumber } from "@/lib/utils";
import { RadioTower, XCircle, PlayCircle, Square } from "lucide-react";
import type { MockBroadcast } from "@/types/admin-rows";

const column = createColumnHelper<MockBroadcast>();

const TWO_HOURS = 2 * 60 * 60 * 1000;

const statusVariant: Record<string, "danger" | "warning" | "default" | "success"> = {
  live: "danger",
  scheduled: "warning",
  ended: "default",
};

const makeColumns = (onEnd: (b: MockBroadcast) => void, onStart: (b: MockBroadcast) => void, onCancel: (b: MockBroadcast) => void) => [
  column.accessor("title", { header: "Broadcast", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("hostName", { header: "Host", cell: (info) => info.getValue() }),
  column.accessor("listeners", {
    header: "Listeners",
    cell: (info) => {
      const val = info.getValue();
      const status = info.row.original.status;
      // Only show listener count for live broadcasts; ended/scheduled show 0
      return <span className="tabular-nums">{status === "live" ? formatNumber(val) : "—"}</span>;
    },
  }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => {
      const raw = info.getValue();
      const started = info.row.original.scheduledAt ? new Date(info.row.original.scheduledAt).getTime() : 0;
      const stale = raw === "live" && started > 0 && (Date.now() - started) >= TWO_HOURS;
      const display = stale ? "ended" : raw;
      return <Badge variant={statusVariant[display] ?? "default"} className="capitalize">{display}</Badge>;
    },
  }),
  column.accessor("scheduledAt", { header: "Time", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue(), "long")}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const b = info.row.original;
      if (b.status === "live") {
        return (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-[#EF4444] hover:bg-[#EF4444]/5" onClick={() => onEnd(b)}>
              <Square className="h-3.5 w-3.5" /> End now
            </Button>
          </div>
        );
      }
      if (b.status === "scheduled") {
        return (
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => onStart(b)}>
              <PlayCircle className="h-3.5 w-3.5" /> Start now
            </Button>
            <Button variant="ghost" size="sm" className="text-[#EF4444] hover:bg-[#EF4444]/5" onClick={() => onCancel(b)}>
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        );
      }
      return null;
    },
  }),
];

export default function BroadcastsPage() {
  const { data: rows, loading: rowsLoading, refresh } = useDbResource<MockBroadcast>("broadcasts");
  const [items, setItems] = useState<MockBroadcast[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? null);
  }, [rows]);

  async function patch(id: string, data: Partial<MockBroadcast>) {
    setItems((prev) => (prev ?? []).map((b) => (b.id === id ? { ...b, ...data } : b)));
    // ok-checked + revert + toast: the old `.finally(refresh)` flashed the
    // refused state, then snapped back silently on paid-rail 403s.
    try {
      const res = await fetch("/api/data/broadcasts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, data }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Broadcast update failed (${res.status})`);
      refresh();
    } catch (e: unknown) {
      setItems(rows ?? null);
      const { toast } = await import("@/components/ui/toast");
      toast.error(e instanceof Error ? e.message : "Broadcast update failed — reverted.");
    }
  }

  function endNow(b: MockBroadcast) {
    patch(b.id, { status: "ended", listeners: 0 });
  }

  function startNow(b: MockBroadcast) {
    patch(b.id, { status: "live", scheduledAt: new Date().toISOString(), listeners: 0 });
  }

  function cancel(b: MockBroadcast) {
    patch(b.id, { status: "ended", listeners: 0 });
  }

  // Compute live status from timestamps: a broadcast is only truly "live" if it was
  // started and not yet ended, AND started within the last 2 hours (otherwise it's stale).
  const now = Date.now();
  const isEffectivelyLive = (b: MockBroadcast) => {
    if (b.status === "ended") return false;
    if (b.status === "live") {
      // Check if startedAt is recent (within 2h) — stale "live" entries are ended
      const started = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return started > 0 && (now - started) < TWO_HOURS;
    }
    return false;
  };
  const live = (items ?? []).filter(isEffectivelyLive);
  // Listeners only count for truly live broadcasts
  const liveListeners = live.reduce((s, b) => s + (b.listeners || 0), 0);
  const scheduled = (items ?? []).filter((b) => b.status === "scheduled").length;
  const ended = (items ?? []).filter((b) => b.status === "ended" || (b.status === "live" && !isEffectivelyLive(b))).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Broadcasts</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          One-to-many audio broadcasts — monitor live rooms and control scheduling.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Live now" value={live.length} tone="red" />
        <StatTile label="Live listeners" value={formatNumber(liveListeners)} tone="red" />
        <StatTile label="Scheduled" value={scheduled} tone="amber" />
        <StatTile label="Ended" value={ended} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Broadcast History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable loading={rowsLoading}
            columns={makeColumns(endNow, startNow, cancel)}
            data={items ?? []}
            searchable
            searchKey="title"
            filename="broadcasts"
            exportColumns={[
              { key: "title", label: "Broadcast" },
              { key: "hostName", label: "Host" },
              { key: "listeners", label: "Listeners" },
              { key: "status", label: "Status" },
              { key: "scheduledAt", label: "Time" },
            ]}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-[13px] text-[#71717A]">
        <RadioTower className="h-4 w-4" />
        Ending a live broadcast notifies all current listeners; cancelled scheduled broadcasts are
        removed from the calendar.
      </div>
    </div>
  );
}