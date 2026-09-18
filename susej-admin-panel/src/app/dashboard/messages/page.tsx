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
import { VolumeX, ShieldBan, CheckCircle2 } from "lucide-react";
import type { ReportedMessageRow } from "@/types/admin-rows";

const column = createColumnHelper<ReportedMessageRow>();

const severityVariant: Record<string, "success" | "warning" | "danger" | "default"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const makeColumns = (onAction: (r: ReportedMessageRow, action: "mute" | "block" | "dismiss") => void) => [
  column.accessor("threadId", { header: "Thread", cell: (info) => <span className="font-mono text-sm font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("participants", { header: "Participants", cell: (info) => info.getValue() }),
  column.accessor("preview", { header: "Last Message", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("reason", { header: "Reason", cell: (info) => <Badge variant="danger">{info.getValue()}</Badge> }),
  column.accessor("severity", {
    header: "Severity",
    cell: (info) => <Badge variant={severityVariant[info.getValue()]} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("reportCount", { header: "Reports", cell: (info) => <span className="font-medium">{info.getValue()}x</span> }),
  column.accessor("createdAt", { header: "Reported", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => onAction(info.row.original, "mute")}>
          <VolumeX className="h-3.5 w-3.5" /> Mute
        </Button>
        <Button variant="danger" size="sm" onClick={() => onAction(info.row.original, "block")}>
          <ShieldBan className="h-3.5 w-3.5" /> Block
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAction(info.row.original, "dismiss")}>
          <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Dismiss
        </Button>
      </div>
    ),
  }),
];

export default function MessagesPage() {
  const { data: rows, loading: rowsLoading, total: messagesTotal, refresh } = useDbResource<ReportedMessageRow>("reported-messages", { take: 100 });
  const [items, setItems] = useState<ReportedMessageRow[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function act(r: ReportedMessageRow, action: "mute" | "block" | "dismiss") {
    setItems((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    try {
      // Enforcement honesty: this desk knows the THREAD, not which participant
      // offended — so it must NOT mint BlockedUser rows keyed `thread:<id>`
      // (they match no user ever and pollute the Blocked & Banned desk while
      // the offender keeps chatting). Mute/Block here clears the report (audit-
      // logged by the API) and the per-user block is taken from the Blocked &
      // Banned desk against the real user row. Thread-level server enforcement
      // (chat honoring bans) is the tracked follow-up.
      if (action === "mute" || action === "block") {
        const { toast } = await import("@/components/ui/toast");
        toast.success(
          action === "block"
            ? "Report cleared and logged — place the per-user block from the Blocked & Banned desk."
            : "Report cleared and logged — mute the user from the Blocked & Banned desk if needed."
        );
      }
      await apiDelete("reported-messages", r.id);
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      console.error(e);
      alert(e instanceof Error ? e.message : "Action failed — nothing was changed. Try again.");
    }
  }

  const high = (items ?? []).filter((r) => r.severity === "high");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Messages & Chat</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Chat moderation: reported threads between buyers and sellers.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label={`Reported threads${typeof messagesTotal === "number" && messagesTotal > (items ?? []).length ? " · first 100" : ""}`} value={(items ?? []).length} tone="red" />
        <StatTile label={`High severity${typeof messagesTotal === "number" && messagesTotal > (items ?? []).length ? " · first 100" : ""}`} value={high.length} tone="red" />
        <StatTile label={`Scam / fraud${typeof messagesTotal === "number" && messagesTotal > (items ?? []).length ? " · first 100" : ""}`} value={(items ?? []).filter((r) => r.reason.toLowerCase().includes("scam") || r.reason.toLowerCase().includes("fraud")).length} tone="amber" />
        <StatTile label={`Resolved${typeof messagesTotal === "number" && messagesTotal > (rows ?? []).length ? " · first 100" : ""}`} value={(rows ?? []).length - (items ?? []).length} tone="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reported Chat Threads</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable loading={rowsLoading}
            columns={makeColumns(act)}
            data={items ?? []}
            totalCount={messagesTotal ?? (items ?? []).length}
            searchable
            searchKey="participants"
            filename="messages"
            exportColumns={[
              { key: "threadId", label: "Thread" },
              { key: "participants", label: "Participants" },
              { key: "reason", label: "Reason" },
              { key: "severity", label: "Severity" },
              { key: "reportCount", label: "Reports" },
              { key: "createdAt", label: "Reported" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}