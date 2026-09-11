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
import { formatNumber } from "@/lib/utils";
import { Hash, TrendingUp, Ban } from "lucide-react";
import type { MockHashtag } from "@/types/admin-rows";

const column = createColumnHelper<MockHashtag>();

const makeColumns = (onToggle: (h: MockHashtag) => void) => [
  column.accessor("tag", { header: "Hashtag", cell: (info) => <span className="font-mono font-medium text-[#6C3BFF]">{info.getValue()}</span> }),
  column.accessor("postsCount", { header: "Posts", cell: (info) => <span className="tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("followers", { header: "Followers", cell: (info) => <span className="tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("trending", {
    header: "Trending",
    cell: (info) => {
      const row = info.row.original;
      // Only show trending if the tag actually has posts — a hashtag with 0 posts
      // cannot logically be "trending" even if the DB flag is set.
      const isTrending = row.postsCount > 0;
      return isTrending ? (
        <Badge variant="primary"><TrendingUp className="mr-1 h-3 w-3" /> Trending</Badge>
      ) : (
        <span className="text-[#71717A]">—</span>
      );
    },
  }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={info.getValue() === "active" ? "success" : "danger"} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const h = info.row.original;
      return (
        <Button variant="ghost" size="sm" onClick={() => onToggle(h)}>
          {h.status === "active" ? (
            <><Ban className="h-3.5 w-3.5 text-[#EF4444]" /> Block</>
          ) : (
            <><TrendingUp className="h-3.5 w-3.5 text-[#16A34A]" /> Unblock</>
          )}
        </Button>
      );
    },
  }),
];

export default function HashtagsPage() {
  const { data: rows, refresh } = useDbResource<MockHashtag>("hashtags");
  const [items, setItems] = useState<MockHashtag[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function toggle(h: MockHashtag) {
    const status = h.status === "active" ? "blocked" : "active";
    setItems((prev) =>
      (prev ?? []).map((x) => (x.id === h.id ? { ...x, status: status as MockHashtag["status"] } : x))
    );
    try {
      await apiPatch("hashtags", h.id, { status });
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      console.error(e);
    }
  }

  const totalPosts = (items ?? []).reduce((s, h) => s + h.postsCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Hashtags</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Trending hashtags and blocked tags across posts.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Active tags" value={(items ?? []).filter((h) => h.status === "active").length} tone="green" />
        <StatTile label="Blocked" value={(items ?? []).filter((h) => h.status === "blocked").length} tone="red" />
        <StatTile label="Trending now" value={(items ?? []).filter((h) => h.trending && h.postsCount > 0).length} tone="purple" />
        <StatTile label="Total posts tagged" value={formatNumber(totalPosts)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hashtag Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(toggle)}
            data={items ?? []}
            searchable
            searchKey="tag"
            filename="hashtags"
            exportColumns={[
              { key: "tag", label: "Hashtag" },
              { key: "postsCount", label: "Posts" },
              { key: "followers", label: "Followers" },
              { key: "trending", label: "Trending" },
              { key: "status", label: "Status" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}