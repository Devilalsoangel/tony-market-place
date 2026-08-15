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
import type { MockBroadcast } from "@/services/mock-data";

const column = createColumnHelper<MockBroadcast>();

const statusVariant: Record<string, "danger" | "warning" | "default" | "success"> = {
  live: "danger",
  scheduled: "warning",
  ended: "default",
};

const makeColumns = (onEnd: (b: MockBroadcast) => void, onStart: (b: MockBroadcast) => void, onCancel: (b: MockBroadcast) => void) => [
  column.accessor("title", { header: "Broadcast", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("hostName", { header: "Host", cell: (info) => info.getValue() }),
  column.accessor("listeners", { header: "Listeners", cell: (info) => <span className="tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={statusVariant[info.getValue()]} className="capitalize">{info.getValue()}</Badge>,
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
  const { data: rows, refresh } = useDbResource<MockBroadcast>("broadcasts");
  const [items, setItems] = useState<MockBroadcast[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? null);
  }, [rows]);

  function patch(id: string, data: Partial<MockBroadcast>) {
    setItems((prev) => (prev ?? []).map((b) => (b.id === id ? { ...b, ...data } : b)));
    fetch("/api/data/broadcasts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data }),
    }).finally(refresh);
  }

  function endNow(b: MockBroadcast) {
    patch(b.id, { status: "ended" });
  }

  function startNow(b: MockBroadcast) {
    patch(b.id, { status: "live", scheduledAt: new Date().toISOString() });
  }

  function cancel(b: MockBroadcast) {
    patch(b.id, { status: "ended" });
  }

  const live = (items ?? []).filter((b) => b.status === "live");
  const liveListeners = live.reduce((s, b) => s + b.listeners, 0);
  const scheduled = (items ?? []).filter((b) => b.status === "scheduled").length;
  const ended = (items ?? []).filter((b) => b.status === "ended").length;

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
          <DataTable
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