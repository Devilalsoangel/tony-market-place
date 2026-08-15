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
import { Clapperboard, EyeOff, CheckCircle2 } from "lucide-react";
import type { MockReel } from "@/services/mock-data";

const column = createColumnHelper<MockReel>();

const makeColumns = (onAction: (r: MockReel, action: "hide" | "resolve") => void) => [
  column.accessor("title", { header: "Reel", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("creatorName", { header: "Creator", cell: (info) => info.getValue() }),
  column.accessor("views", { header: "Views", cell: (info) => <span className="tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("likes", { header: "Likes", cell: (info) => <span className="tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={info.getValue() === "flagged" ? "danger" : "success"} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("createdAt", { header: "Created", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const r = info.row.original;
      if (r.status !== "flagged") return null;
      return (
        <div className="flex gap-2">
          <Button variant="danger" size="sm" onClick={() => onAction(r, "hide")}>
            <EyeOff className="h-3.5 w-3.5" /> Remove
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAction(r, "resolve")}>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Resolve
          </Button>
        </div>
      );
    },
  }),
];

export default function ReelsPage() {
  const { data: rows, refresh } = useDbResource<MockReel>("reels");
  const [items, setItems] = useState<MockReel[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function act(r: MockReel, action: "hide" | "resolve") {
    const status = action === "resolve" ? "published" : "removed";
    setItems((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: status as MockReel["status"] } : x)));
    try {
      await apiPatch("reels", r.id, { status });
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      console.error(e);
    }
  }

  const totalViews = (items ?? []).reduce((s, r) => s + r.views, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Reels</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Short-form video content across the marketplace.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total reels" value={(items ?? []).length} />
        <StatTile label="Total views" value={formatNumber(totalViews)} tone="green" />
        <StatTile label="Flagged" value={(items ?? []).filter((r) => r.status === "flagged").length} tone="red" />
        <StatTile label="Creators" value={new Set((items ?? []).map((r) => r.creatorName)).size} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reels Library</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(act)}
            data={items ?? []}
            searchable
            searchKey="title"
            filename="reels"
            exportColumns={[
              { key: "title", label: "Reel" },
              { key: "creatorName", label: "Creator" },
              { key: "views", label: "Views" },
              { key: "likes", label: "Likes" },
              { key: "status", label: "Status" },
              { key: "createdAt", label: "Created" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}