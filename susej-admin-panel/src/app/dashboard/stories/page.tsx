"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiDelete } from "@/lib/api-mutate";
import { formatDate, formatNumber } from "@/lib/utils";
import { Images, Trash2 } from "lucide-react";
import type { MockStory } from "@/types/admin-rows";

const column = createColumnHelper<MockStory>();

const makeColumns = (onRemove: (s: MockStory) => void) => [
  column.accessor("creatorName", { header: "Creator", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("views", { header: "Views", cell: (info) => <span className="tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={info.getValue() === "active" ? "success" : "default"} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("createdAt", { header: "Posted", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue(), "long")}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <Button variant="ghost" size="sm" onClick={() => onRemove(info.row.original)}>
        <Trash2 className="h-3.5 w-3.5 text-[#EF4444]" /> Remove
      </Button>
    ),
  }),
];

export default function StoriesPage() {
  const { data: rows, loading: rowsLoading, refresh } = useDbResource<MockStory>("stories");
  const [items, setItems] = useState<MockStory[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function remove(s: MockStory) {
    setItems((prev) => (prev ?? []).filter((x) => x.id !== s.id));
    try {
      await apiDelete("stories", s.id);
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      const { toast } = await import("@/components/ui/toast");
      toast.error(e instanceof Error ? e.message : "Story delete failed — reverted.");
    }
  }

  const activeViews = (items ?? []).filter((s) => s.status === "active").reduce((sum, s) => sum + s.views, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Stories</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">24-hour ephemeral content across the app.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Active stories" value={(items ?? []).filter((s) => s.status === "active").length} tone="green" />
        <StatTile label="Active views" value={formatNumber(activeViews)} tone="green" />
        <StatTile label="Expired (24h)" value={(items ?? []).filter((s) => s.status === "expired").length} />
        <StatTile label="Creators" value={new Set((items ?? []).map((s) => s.creatorName)).size} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stories Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable loading={rowsLoading}
            columns={makeColumns(remove)}
            data={items ?? []}
            searchable
            searchKey="creatorName"
            filename="stories"
            exportColumns={[
              { key: "creatorName", label: "Creator" },
              { key: "views", label: "Views" },
              { key: "status", label: "Status" },
              { key: "createdAt", label: "Posted" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}