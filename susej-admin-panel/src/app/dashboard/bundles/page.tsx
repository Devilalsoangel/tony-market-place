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
import { formatCurrency, formatDate } from "@/lib/utils";
import { Boxes, CheckCircle2, XCircle } from "lucide-react";
import type { MockBundle } from "@/services/mock-data";

const column = createColumnHelper<MockBundle>();

const statusVariant: Record<string, "success" | "warning" | "default" | "danger"> = {
  active: "success",
  pending: "warning",
  ended: "default",
};

const makeColumns = (onApprove: (b: MockBundle) => void, onReject: (b: MockBundle) => void) => [
  column.accessor("title", { header: "Bundle", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("sellerName", { header: "Seller", cell: (info) => info.getValue() }),
  column.accessor("itemsCount", { header: "Items", cell: (info) => <span className="tabular-nums">{info.getValue()}</span> }),
  column.accessor("price", { header: "Price", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  column.accessor("discount", { header: "Discount", cell: (info) => <Badge variant="primary">-{info.getValue()}%</Badge> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={statusVariant[info.getValue()]} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("createdAt", { header: "Created", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const b = info.row.original;
      if (b.status !== "pending") return null;
      return (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onApprove(b)}>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Approve
          </Button>
          <Button variant="danger" size="sm" onClick={() => onReject(b)}>
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      );
    },
  }),
];

export default function BundlesPage() {
  const { data: rows, refresh } = useDbResource<MockBundle>("bundles");
  const [items, setItems] = useState<MockBundle[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function decide(b: MockBundle, status: "active" | "ended") {
    setItems((prev) => (prev ?? []).map((x) => (x.id === b.id ? { ...x, status } : x)));
    try {
      await apiPatch("bundles", b.id, { status });
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Bundles</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Multi-item deal bundles created by sellers.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Active bundles" value={(items ?? []).filter((b) => b.status === "active").length} tone="green" />
        <StatTile label="Pending approval" value={(items ?? []).filter((b) => b.status === "pending").length} tone="amber" />
        <StatTile label="Ended" value={(items ?? []).filter((b) => b.status === "ended").length} />
        <StatTile label="Sellers" value={new Set((items ?? []).map((b) => b.sellerName)).size} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deal Bundles</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns((b) => decide(b, "active"), (b) => decide(b, "ended"))}
            data={items ?? []}
            searchable
            searchKey="title"
            filename="bundles"
            exportColumns={[
              { key: "title", label: "Bundle" },
              { key: "sellerName", label: "Seller" },
              { key: "itemsCount", label: "Items" },
              { key: "price", label: "Price" },
              { key: "discount", label: "Discount" },
              { key: "status", label: "Status" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}