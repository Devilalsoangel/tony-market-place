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
import { formatDate } from "@/lib/utils";
import { Ban, RotateCcw } from "lucide-react";
import type { MockBlockedUser } from "@/types/admin-rows";

const column = createColumnHelper<MockBlockedUser>();

const makeColumns = (onUnblock: (u: MockBlockedUser) => void) => [
  column.accessor("userName", { header: "User", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("email", { header: "Email", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("reason", { header: "Reason", cell: (info) => <Badge variant="danger">{info.getValue()}</Badge> }),
  column.accessor("kind", {
    header: "Type",
    cell: (info) => <Badge variant={info.getValue() === "banned" ? "danger" : "warning"} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("bannedBy", { header: "By", cell: (info) => info.getValue() }),
  column.accessor("bannedAt", { header: "Since", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue(), "long")}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <Button variant="ghost" size="sm" onClick={() => onUnblock(info.row.original)}>
        <RotateCcw className="h-3.5 w-3.5 text-[#16A34A]" /> Unblock
      </Button>
    ),
  }),
];

export default function BlockedPage() {
  const { data: rows, loading: rowsLoading, refresh } = useDbResource<MockBlockedUser>("blocked");
  const [items, setItems] = useState<MockBlockedUser[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function unblock(u: MockBlockedUser) {
    setItems((prev) => (prev ?? []).filter((x) => x.id !== u.id));
    try {
      await apiDelete("blocked", u.id);
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      console.error(e);
    }
  }

  const banned = (items ?? []).filter((u) => u.kind === "banned");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Blocked & Banned</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Users blocked or banned from the marketplace.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Blocked users" value={(items ?? []).length} tone="red" />
        <StatTile label="Banned (permanent)" value={banned.length} tone="red" />
        <StatTile label="Blocked (temporary)" value={(items ?? []).filter((u) => u.kind === "blocked").length} tone="amber" />
        <StatTile label="Most common reason" value={(() => {
          const counts = new Map<string, number>();
          (items ?? []).forEach((u) => {
            const key = (u.reason || "Unknown").trim();
            counts.set(key, (counts.get(key) ?? 0) + 1);
          });
          let best = "—";
          let bestN = 0;
          counts.forEach((n, r) => { if (n > bestN) { bestN = n; best = r; } });
          return best;
        })()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Blocked Users</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable loading={rowsLoading}
            columns={makeColumns(unblock)}
            data={items ?? []}
            searchable
            searchKey="userName"
            filename="blocked-users"
            exportColumns={[
              { key: "userName", label: "User" },
              { key: "email", label: "Email" },
              { key: "reason", label: "Reason" },
              { key: "kind", label: "Type" },
              { key: "bannedAt", label: "Since" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}