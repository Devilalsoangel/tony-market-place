"use client";

import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch } from "@/lib/api-mutate";
import { formatDate } from "@/lib/utils";
import { UsersRound, ShieldBan, CheckCircle2 } from "lucide-react";
import type { Community } from "@/types";

const column = createColumnHelper<Community>();

const makeColumns = (onBan: (c: Community) => void, onDismiss: (c: Community) => void) => [
  column.accessor("name", { header: "Community", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("ownerName", { header: "Owner", cell: (info) => info.getValue() }),
  column.accessor("members", { header: "Members", cell: (info) => <span className="tabular-nums">{info.getValue().toLocaleString()}</span> }),
  column.accessor("type", {
    header: "Type",
    cell: (info) => <Badge variant={info.getValue() === "public" ? "primary" : "default"} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("reports", { header: "Reports", cell: (info) => <span className="font-medium text-[#EF4444]">{info.getValue()}x</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={info.getValue() === "active" ? "success" : "danger"} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("createdAt", { header: "Created", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <div className="flex gap-2">
        <Button variant="danger" size="sm" onClick={() => onBan(info.row.original)}>
          <ShieldBan className="h-3.5 w-3.5" /> Ban
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDismiss(info.row.original)}>
          <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Dismiss
        </Button>
      </div>
    ),
  }),
];

export default function ReportedCommunitiesPage() {
  const { data: communities, loading: communitiesLoading, refresh } = useDbResource<Community>("communities");
  const [items, setItems] = useState<Community[] | null>(communities);

  useEffect(() => {
    setItems((communities ?? []).filter((c) => c.reports > 0));
  }, [communities]);

  const reported = useMemo(() => items ?? [], [items]);

  async function banCommunity(c: Community) {
    try {
      await apiPatch("communities", c.id, { status: "banned" });
    } catch (e) {
      console.error(e);
    }
    setItems((prev) => (prev ?? []).filter((x) => x.id !== c.id));
    refresh();
  }

  async function dismiss(c: Community) {
    try {
      await apiPatch("communities", c.id, { reports: 0 });
    } catch (e) {
      console.error(e);
    }
    setItems((prev) => (prev ?? []).filter((x) => x.id !== c.id));
    refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Reported Communities</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Communities flagged by members or moderators.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Reported communities" value={reported.length} tone="red" />
        <StatTile label="Total reports" value={reported.reduce((s, c) => s + c.reports, 0)} tone="red" />
        <StatTile label="Private" value={reported.filter((c) => c.type === "private").length} />
        <StatTile label="Members affected" value={reported.reduce((s, c) => s + c.members, 0)} tone="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reported Communities</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable loading={communitiesLoading}
            columns={makeColumns(banCommunity, dismiss)}
            data={reported}
            searchable
            searchKey="name"
            filename="reported-communities"
            exportColumns={[
              { key: "name", label: "Community" },
              { key: "ownerName", label: "Owner" },
              { key: "members", label: "Members" },
              { key: "type", label: "Type" },
              { key: "reports", label: "Reports" },
              { key: "createdAt", label: "Created" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}