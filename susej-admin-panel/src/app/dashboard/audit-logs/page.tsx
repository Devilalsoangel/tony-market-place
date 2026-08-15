"use client";

import { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatDate } from "@/lib/utils";
import type { AuditLog } from "@/types";

const column = createColumnHelper<AuditLog>();

function actionTone(action: string): "default" | "success" | "warning" | "danger" | "info" {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("ban") || a.includes("reject")) return "danger";
  if (a.includes("create") || a.includes("approve") || a.includes("verify")) return "success";
  if (a.includes("update") || a.includes("patch")) return "info";
  if (a.includes("login") || a.includes("logout")) return "warning";
  return "default";
}

const columns = [
  column.accessor("timestamp", { header: "Time", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue(), "relative")}</span> }),
  column.accessor("adminName", { header: "Admin", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  column.accessor("action", {
    header: "Action",
    cell: (info) => <Badge variant={actionTone(info.getValue())} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("entity", { header: "Entity", cell: (info) => <span className="capitalize text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("entityId", { header: "Record", cell: (info) => <span className="font-mono text-[13px]">{info.getValue()}</span> }),
  column.accessor("details", { header: "Details", cell: (info) => <span className="max-w-[280px] truncate text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("ip", { header: "IP", cell: (info) => <span className="font-mono text-[13px] text-[#71717A]">{info.getValue()}</span> }),
];

const ACTION_FILTERS = ["all", "login", "logout", "data.create", "data.update", "data.delete", "auth.reset"];

export default function AuditLogsPage() {
  const { data: logs, loading } = useDbResource<AuditLog>("audit-logs");
  const [actionFilter, setActionFilter] = useState("all");

  const filtered = useMemo(() => {
    return (logs ?? []).filter((l) => actionFilter === "all" || l.action.includes(actionFilter));
  }, [logs, actionFilter]);

  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    (logs ?? []).forEach((l) => {
      const base = l.action.split(".")[0] ?? l.action;
      set.add(base);
    });
    return ["all", ...Array.from(set).sort()];
  }, [logs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Audit Logs</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Read-only trail of admin activity. Export for compliance.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total events" value={(logs ?? []).length} />
        <StatTile label="Admins active" value={new Set((logs ?? []).map((l) => l.adminName)).size} />
        <StatTile label="Logged in today" value={(logs ?? []).filter((l) => l.action.includes("login")).length} tone="purple" />
        <StatTile label="Deletions" value={(logs ?? []).filter((l) => l.action.includes("delete")).length} tone="red" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Events</CardTitle>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-8 rounded-[6px] border border-[#E4E4E7] bg-white px-2 text-[13px] text-[#18181B] outline-none focus:border-[#6C3BFF]"
            >
              {uniqueActions.map((a) => (
                <option key={a} value={a} className="capitalize">{a}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filtered}
            loading={loading}
            searchable
            searchKey="adminName"
            filename="audit-logs"
            exportColumns={[
              { key: "timestamp", label: "Time" },
              { key: "adminName", label: "Admin" },
              { key: "action", label: "Action" },
              { key: "entity", label: "Entity" },
              { key: "entityId", label: "Record" },
              { key: "details", label: "Details" },
              { key: "ip", label: "IP" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}