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
import { Newspaper, EyeOff, RotateCcw, CheckCircle2 } from "lucide-react";
import type { MockFeedPost } from "@/services/mock-data";

const column = createColumnHelper<MockFeedPost>();

const typeVariant: Record<string, "primary" | "info" | "warning" | "default"> = {
  post: "primary",
  reel: "info",
  story: "warning",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "default"> = {
  published: "success",
  pending: "warning",
  flagged: "danger",
  removed: "default",
};

const makeColumns = (onToggle: (p: MockFeedPost, action: "hide" | "restore" | "resolve") => void) => [
  column.accessor("title", { header: "Post", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("authorName", { header: "Author", cell: (info) => info.getValue() }),
  column.accessor("type", {
    header: "Type",
    cell: (info) => <Badge variant={typeVariant[info.getValue()]} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("likes", { header: "Likes", cell: (info) => <span className="tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("comments", { header: "Comments", cell: (info) => <span className="tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={statusVariant[info.getValue()]} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("createdAt", { header: "Created", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const p = info.row.original;
      if (p.status === "removed") return null;
      return (
        <div className="flex gap-2">
          {p.status === "flagged" ? (
            <>
              <Button variant="danger" size="sm" onClick={() => onToggle(p, "hide")}>
                <EyeOff className="h-3.5 w-3.5" /> Remove
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onToggle(p, "resolve")}>
                <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Resolve
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onToggle(p, "hide")}>
              <EyeOff className="h-3.5 w-3.5" /> Hide
            </Button>
          )}
        </div>
      );
    },
  }),
];

export default function PostsPage() {
  const { data: rows, refresh } = useDbResource<MockFeedPost>("posts");
  const [items, setItems] = useState<MockFeedPost[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function act(p: MockFeedPost, action: "hide" | "restore" | "resolve") {
    const status = action === "resolve" ? "published" : "removed";
    setItems((prev) => (prev ?? []).map((x) => (x.id === p.id ? { ...x, status: status as MockFeedPost["status"] } : x)));
    try {
      await apiPatch("posts", p.id, { status });
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      console.error(e);
    }
  }

  const flagged = (items ?? []).filter((p) => p.status === "flagged");
  const published = (items ?? []).filter((p) => p.status === "published");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Posts & Moderation</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Feed posts, reels, stories, and the content moderation queue.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total posts" value={(items ?? []).length} />
        <StatTile label="Published" value={published.length} tone="green" />
        <StatTile label="Flagged" value={flagged.length} tone="red" />
        <StatTile label="Pending review" value={(items ?? []).filter((p) => p.status === "pending").length} tone="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Content Moderation Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(act)}
            data={items ?? []}
            searchable
            searchKey="title"
            filename="posts"
            exportColumns={[
              { key: "title", label: "Post" },
              { key: "authorName", label: "Author" },
              { key: "type", label: "Type" },
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