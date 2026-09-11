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
  const { data: rows, refresh } = useDbResource<ReportedMessageRow>("reported-messages");
  const [items, setItems] = useState<ReportedMessageRow[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function act(r: ReportedMessageRow, action: "mute" | "block" | "dismiss") {
    setItems((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    try {
      await apiDelete("reported-messages", r.id);
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      console.error(e);
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
        <StatTile label="Reported threads" value={(items ?? []).length} tone="red" />
        <StatTile label="High severity" value={high.length} tone="red" />
        <StatTile label="Scam / fraud" value={(items ?? []).filter((r) => r.reason.toLowerCase().includes("scam") || r.reason.toLowerCase().includes("fraud")).length} tone="amber" />
        <StatTile label="Resolved" value={(rows ?? []).length - (items ?? []).length} tone="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reported Chat Threads</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(act)}
            data={items ?? []}
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