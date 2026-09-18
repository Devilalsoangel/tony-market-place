"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch, apiDelete } from "@/lib/api-mutate";
import { formatDate, formatCurrency } from "@/lib/utils";
import { PackageX, EyeOff, CheckCircle2 } from "lucide-react";
import type { ReportedProductRow } from "@/types/admin-rows";
import type { Product } from "@/types";

const column = createColumnHelper<ReportedProductRow>();

const makeColumns = (
  onHide: (r: ReportedProductRow) => void,
  onDelete: (r: ReportedProductRow) => void,
  onDismiss: (r: ReportedProductRow) => void
) => [
  column.accessor("title", { header: "Product", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("sellerName", { header: "Seller", cell: (info) => info.getValue() }),
  column.accessor("reason", { header: "Reason", cell: (info) => <Badge variant="danger">{info.getValue()}</Badge> }),
  column.accessor("reporter", { header: "Reporter", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("reportCount", { header: "Reports", cell: (info) => <span className="font-medium">{info.getValue()}x</span> }),
  column.accessor("createdAt", { header: "Reported", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => onHide(info.row.original)}>
          <EyeOff className="h-3.5 w-3.5" /> Hide
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(info.row.original)}>
          <PackageX className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDismiss(info.row.original)}>
          <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Dismiss
        </Button>
      </div>
    ),
  }),
];

export default function ReportedProductsPage() {
  const { data: rows, loading: rowsLoading, refresh } = useDbResource<ReportedProductRow>("reported-products");
  const { data: products } = useDbResource<Product>("products");
  const [items, setItems] = useState<ReportedProductRow[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function actOnProduct(r: ReportedProductRow, action: "hide" | "delete") {
    try {
      if (action === "hide") {
        await apiPatch("products", r.productId, { status: "hidden" });
      } else {
        await apiDelete("products", r.productId);
      }
      await apiDelete("reported-products", r.id);
    } catch (e) {
      console.error(e);
    }
    setItems((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    refresh();
  }

  async function dismiss(r: ReportedProductRow) {
    try {
      await apiDelete("reported-products", r.id);
    } catch (e) {
      console.error(e);
    }
    setItems((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    refresh();
  }

  const highCount = (items ?? []).filter((r) => r.reportCount >= 5).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Reported Products</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Product listings reported by buyers and sellers.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Reported listings" value={(items ?? []).length} tone="red" />
        <StatTile label="High severity (5+ reports)" value={highCount} tone="red" />
        <StatTile label="Distinct sellers" value={new Set((items ?? []).map((r) => r.sellerName)).size} />
        <StatTile label="Live products" value={(products ?? []).filter((p) => p.status === "active").length} tone="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reported Product Listings</CardTitle>
        </CardHeader>
        <CardContent>
<DataTable loading={rowsLoading}
columns={makeColumns(
              (r) => actOnProduct(r, "hide"),
              (r) => actOnProduct(r, "delete"),
              dismiss
            )}
            data={items ?? []}
            searchable
            searchKey="title"
            filename="reported-products"
            exportColumns={[
              { key: "title", label: "Product" },
              { key: "sellerName", label: "Seller" },
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