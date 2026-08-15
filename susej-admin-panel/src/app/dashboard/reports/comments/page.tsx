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
import { MessageSquareX, CheckCircle2 } from "lucide-react";
import type { ReportedCommentRow } from "@/services/mock-data";

const column = createColumnHelper<ReportedCommentRow>();

const makeColumns = (onDelete: (r: ReportedCommentRow) => void, onDismiss: (r: ReportedCommentRow) => void) => [
  column.accessor("text", { header: "Comment", cell: (info) => <span className="text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("authorName", { header: "Author", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  column.accessor("postTitle", { header: "On Post", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("reason", { header: "Reason", cell: (info) => <Badge variant="danger">{info.getValue()}</Badge> }),
  column.accessor("reportCount", { header: "Reports", cell: (info) => <span className="font-medium">{info.getValue()}x</span> }),
  column.accessor("createdAt", { header: "Reported", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <div className="flex gap-2">
        <Button variant="danger" size="sm" onClick={() => onDelete(info.row.original)}>
          <MessageSquareX className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDismiss(info.row.original)}>
          <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Dismiss
        </Button>
      </div>
    ),
  }),
];

export default function ReportedCommentsPage() {
  const { data: rows, refresh } = useDbResource<ReportedCommentRow>("reported-comments");
  const [items, setItems] = useState<ReportedCommentRow[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function remove(r: ReportedCommentRow) {
    setItems((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    try {
      await apiDelete("reported-comments", r.id);
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      console.error(e);
    }
  }

  const authors = new Set((items ?? []).map((r) => r.authorName)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Reported Comments</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Comments flagged across communities and posts.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Reported comments" value={(items ?? []).length} tone="red" />
        <StatTile label="Distinct authors" value={authors} tone="amber" />
        <StatTile label="Spam" value={(items ?? []).filter((r) => r.reason === "Spam").length} />
        <StatTile label="Resolved" value={(rows ?? []).length - (items ?? []).length} tone="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reported Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(remove, remove)}
            data={items ?? []}
            searchable
            searchKey="text"
            filename="reported-comments"
            exportColumns={[
              { key: "text", label: "Comment" },
              { key: "authorName", label: "Author" },
              { key: "postTitle", label: "On Post" },
              { key: "reason", label: "Reason" },
              { key: "reportCount", label: "Reports" },
              { key: "createdAt", label: "Reported" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}