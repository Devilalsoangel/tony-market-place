"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch } from "@/lib/api-mutate";
import { formatDate, formatNumber } from "@/lib/utils";
import { Radio, Video, XCircle } from "lucide-react";
import type { MockLiveStream } from "@/types/admin-rows";

const column = createColumnHelper<MockLiveStream>();

const statusVariant: Record<string, "danger" | "success" | "warning" | "default"> = {
  live: "danger",
  ended: "default",
  scheduled: "warning",
};

const makeColumns = (onEnd: (s: MockLiveStream) => void) => [
  column.accessor("title", { header: "Stream", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("hostName", { header: "Host", cell: (info) => info.getValue() }),
  column.accessor("viewers", { header: "Viewers", cell: (info) => <span className="tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={statusVariant[info.getValue()]} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("startedAt", { header: "Start", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue(), "long")}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const s = info.row.original;
      if (s.status !== "live") return null;
      return (
        <Button variant="danger" size="sm" onClick={() => onEnd(s)}>
          <XCircle className="h-3.5 w-3.5" /> End Stream
        </Button>
      );
    },
  }),
];

export default function LivePage() {
  const { data: rows, refresh } = useDbResource<MockLiveStream>("live");
  const [items, setItems] = useState<MockLiveStream[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function endStream(s: MockLiveStream) {
    setItems((prev) => (prev ?? []).map((x) => (x.id === s.id ? { ...x, status: "ended" as const } : x)));
    try {
      await apiPatch("live", s.id, { status: "ended" });
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      const { toast } = await import("@/components/ui/toast");
      toast.error(e instanceof Error ? e.message : "Stream update failed — reverted.");
    }
  }

  const live = (items ?? []).filter((s) => s.status === "live");
  const liveViewers = live.reduce((s, x) => s + x.viewers, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Live Streaming</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Monitor and moderate live commerce streams.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Live now" value={live.length} tone="red" />
        <StatTile label="Concurrent viewers" value={liveViewers} tone="red" />
        <StatTile label="Scheduled" value={(items ?? []).filter((s) => s.status === "scheduled").length} tone="amber" />
        <StatTile label="Ended today" value={(items ?? []).filter((s) => s.status === "ended").length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Streams</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(endStream)}
            data={items ?? []}
            searchable
            searchKey="title"
            filename="live-streams"
            exportColumns={[
              { key: "title", label: "Stream" },
              { key: "hostName", label: "Host" },
              { key: "viewers", label: "Viewers" },
              { key: "status", label: "Status" },
              { key: "startedAt", label: "Start" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}