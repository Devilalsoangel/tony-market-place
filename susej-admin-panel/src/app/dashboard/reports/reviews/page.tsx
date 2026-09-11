"use client";

import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch, apiDelete } from "@/lib/api-mutate";
import { formatDate } from "@/lib/utils";
import { Star, StarHalf, CheckCircle2 } from "lucide-react";
import type { Review } from "@/types";

const column = createColumnHelper<Review>();

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? "fill-[#F59E0B] text-[#F59E0B]" : "text-gray-300"}`} />
      ))}
    </span>
  );
}

const makeColumns = (onDelete: (r: Review) => void, onApprove: (r: Review) => void, onDismiss: (r: Review) => void) => [
  column.accessor("productName", { header: "Product", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("reviewerName", { header: "Reviewer", cell: (info) => info.getValue() }),
  column.accessor("rating", { header: "Rating", cell: (info) => <Stars rating={info.getValue()} /> }),
  column.accessor("text", { header: "Review", cell: (info) => <span className="max-w-xs truncate text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={info.getValue() === "reported" ? "danger" : "warning"} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const r = info.row.original;
      return (
        <div className="flex gap-2">
          {r.status === "reported" && (
            <>
              <Button variant="danger" size="sm" onClick={() => onDelete(r)}>Delete</Button>
              <Button variant="secondary" size="sm" onClick={() => onApprove(r)}>Keep</Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => onDismiss(r)}>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Dismiss
          </Button>
        </div>
      );
    },
  }),
];

export default function ReportedReviewsPage() {
  const { data: reviews, refresh } = useDbResource<Review>("reviews");
  const [items, setItems] = useState<Review[] | null>(reviews);

  useEffect(() => {
    setItems((reviews ?? []).filter((r) => r.status === "reported"));
  }, [reviews]);

  const reported = useMemo(() => items ?? [], [items]);

  // Dismiss drops the REPORT without endorsing the review: back to pending
  // moderation, NOT approved. (Was wired to "approved" — dismissing a report
  // silently approved the review under it.)
  async function resolveReview(r: Review, status: "approved" | "pending") {
    try {
      await apiPatch("reviews", r.id, { status });
    } catch (e) {
      console.error(e);
    }
    setItems((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    refresh();
  }

  async function deleteReview(r: Review) {
    try {
      await apiDelete("reviews", r.id);
    } catch (e) {
      console.error(e);
    }
    setItems((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    refresh();
  }

  const avgRating = reported.length
    ? (reported.reduce((s, r) => s + r.rating, 0) / reported.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Reported Reviews</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Reviews flagged as fake, abusive, or off-topic.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Reported reviews" value={reported.length} tone="red" />
        <StatTile label="Avg rating" value={`${avgRating} / 5`} />
        <StatTile label="1-star reviews" value={reported.filter((r) => r.rating <= 2).length} tone="amber" />
        <StatTile label="Resolved" value={(reviews ?? []).filter((r) => r.status !== "reported").length} tone="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reported Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(
              deleteReview,
              (r) => resolveReview(r, "approved"),
              (r) => resolveReview(r, "pending")
            )}
            data={reported}
            searchable
            searchKey="productName"
            filename="reported-reviews"
            exportColumns={[
              { key: "productName", label: "Product" },
              { key: "reviewerName", label: "Reviewer" },
              { key: "rating", label: "Rating" },
              { key: "text", label: "Review" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}