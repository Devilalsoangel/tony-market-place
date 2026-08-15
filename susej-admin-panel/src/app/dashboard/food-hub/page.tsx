"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatCurrency } from "@/lib/utils";
import { UtensilsCrossed, Star } from "lucide-react";
import type { MockFoodItem } from "@/services/mock-data";

const column = createColumnHelper<MockFoodItem>();

const statusVariant: Record<string, "success" | "danger" | "warning" | "default"> = {
  available: "success",
  out_of_stock: "danger",
  pending: "warning",
};

const columns = [
  column.accessor("title", { header: "Item", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("restaurant", { header: "Restaurant", cell: (info) => info.getValue() }),
  column.accessor("category", { header: "Category", cell: (info) => <Badge variant="default">{info.getValue()}</Badge> }),
  column.accessor("price", { header: "Price", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  column.accessor("rating", {
    header: "Rating",
    cell: (info) => (
      <span className="flex items-center gap-1 font-medium tabular-nums">
        <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" /> {info.getValue().toFixed(1)}
      </span>
    ),
  }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={statusVariant[info.getValue()]} className="capitalize">{String(info.getValue()).replace("_", " ")}</Badge>,
  }),
];

export default function FoodHubPage() {
  const { data: rows } = useDbResource<MockFoodItem>("food-hub");
  const [items, setItems] = useState<MockFoodItem[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  const available = (items ?? []).filter((f) => f.status === "available");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Food Hub</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Restaurant listings and grocery items on the food hub.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Live items" value={available.length} tone="green" />
        <StatTile label="Out of stock" value={(items ?? []).filter((f) => f.status === "out_of_stock").length} tone="red" />
        <StatTile label="Pending review" value={(items ?? []).filter((f) => f.status === "pending").length} tone="amber" />
        <StatTile label="Restaurants" value={new Set((items ?? []).map((f) => f.restaurant)).size} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Food Hub Items</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={items ?? []}
            searchable
            searchKey="title"
            filename="food-hub"
            exportColumns={[
              { key: "title", label: "Item" },
              { key: "restaurant", label: "Restaurant" },
              { key: "category", label: "Category" },
              { key: "price", label: "Price" },
              { key: "rating", label: "Rating" },
              { key: "status", label: "Status" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}