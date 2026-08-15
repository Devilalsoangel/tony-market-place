"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { Star, CheckCircle2, Trash2 } from "lucide-react";
import type { Review } from "@/types";

const column = createColumnHelper<Review>();

const makeColumns = (onApprove: (r: Review) => void, onDelete: (r: Review) => void) => [
  column.accessor("productName", { header: "Product", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  column.accessor("reviewerName", { header: "Reviewer" }),
  column.accessor("rating", {
    header: "Rating",
    cell: (info) => {
      const r = info.getValue();
      return (
        <span className="inline-flex items-center gap-1">
          <Star className={`h-4 w-4 ${r >= 4 ? "fill-amber-400 text-amber-400" : r >= 3 ? "fill-amber-300 text-amber-300" : "fill-gray-300 text-gray-300"}`} />
          <span className="font-medium tabular-nums">{r}.0</span>
        </span>
      );
    },
  }),
  column.accessor("text", {
    header: "Review",
    cell: (info) => <span className="line-clamp-2 max-w-[320px] text-[#71717A]">{info.getValue()}</span>,
  }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant={info.getValue() === "approved" ? "success" : info.getValue() === "pending" ? "warning" : "danger"} className="capitalize">
        {info.getValue()}
      </Badge>
    ),
  }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const r = info.row.original;
      return (
        <div className="flex items-center gap-2">
          {r.status === "pending" && (
            <Button variant="secondary" size="sm" onClick={() => onApprove(r)}>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
              Approve
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onDelete(r)} className="text-[#EF4444] hover:bg-[#EF4444]/5">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  }),
];

export default function ReviewsPage() {
  const { data: reviews, refresh } = useDbResource<Review>("reviews");
  const [list, setList] = useState<Review[] | null>(reviews);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  useEffect(() => {
    setList(reviews ?? null);
  }, [reviews]);

  const pending = (list ?? []).filter((r) => r.status === "pending").length;
  const reported = (list ?? []).filter((r) => r.status === "reported").length;
  const avg = (list ?? []).length
    ? (list ?? []).reduce((s, r) => s + r.rating, 0) / (list ?? []).length
    : 0;

  function handleApprove(r: Review) {
    setList((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: "approved" as const } : x)));
    fetch("/api/data/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, data: { status: "approved" } }),
    }).finally(refresh);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setList((prev) => (prev ?? []).filter((x) => x.id !== deleteTarget.id));
    fetch("/api/data/reviews", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteTarget.id }),
    }).finally(() => {
      setDeleteTarget(null);
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Reviews & Ratings</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Moderate product reviews and rating quality.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total reviews" value={(list ?? []).length} />
        <StatTile label="Average rating" value={avg ? `${avg.toFixed(1)} ★` : "—"} tone="purple" />
        <StatTile label="Pending approval" value={pending} tone="amber" />
        <StatTile label="Reported" value={reported} tone="red" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(handleApprove, setDeleteTarget)}
            data={list ?? []}
            searchable
            searchKey="productName"
            filename="reviews"
            exportColumns={[
              { key: "productName", label: "Product" },
              { key: "reviewerName", label: "Reviewer" },
              { key: "rating", label: "Rating" },
              { key: "text", label: "Review" },
              { key: "status", label: "Status" },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        {deleteTarget && (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EF4444]/10">
              <Trash2 className="h-6 w-6 text-[#EF4444]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#18181B]">Remove review</h3>
            <p className="mt-2 text-sm text-[#71717A]">
              Remove the review for <span className="font-medium text-[#18181B]">{deleteTarget.productName}</span> by {deleteTarget.reviewerName}?
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Remove</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}