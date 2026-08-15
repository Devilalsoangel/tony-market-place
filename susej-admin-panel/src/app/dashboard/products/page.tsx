"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch, apiDelete } from "@/lib/api-mutate";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { Product } from "@/types";

const columnHelper = createColumnHelper<Product>();

const columns = [
  columnHelper.accessor("title", {
    header: "Product",
    cell: (info) => (
      <div>
        <p className="font-medium text-[#18181B] ">{info.getValue()}</p>
        <p className="text-xs text-gray-500">{info.row.original.sellerName}</p>
      </div>
    ),
  }),
  columnHelper.accessor("category", {
    header: "Category",
    cell: (info) => <Badge variant="default">{info.getValue()}</Badge>,
  }),
  columnHelper.accessor("price", {
    header: "Price",
    cell: (info) => <span className="font-medium">{formatCurrency(info.getValue())}</span>,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const p = info.row.original;
      return (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={p.status} />
          {p.warningReason && (
            <Badge variant="warning">
              <ShieldAlert className="mr-1 h-3 w-3" /> Warned
            </Badge>
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor("reports", {
    header: "Reports",
    cell: (info) => (
      <span className={info.getValue() > 0 ? "text-[#EF4444]" : "text-gray-500"}>{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: "Created",
    cell: (info) => <span className="text-gray-500">{formatDate(info.getValue())}</span>,
  }),
];

type ProductAction = "hide" | "unhide" | "feature" | "unfeature" | "warn" | "delete";

const actionMeta: Record<ProductAction, { title: string; message: (title: string) => string; confirmLabel: string; danger?: boolean }> = {
  hide: {
    title: "Hide Product",
    message: (title) => `Are you sure you want to hide "${title}"? It will be removed from listings.`,
    confirmLabel: "Hide",
  },
  unhide: {
    title: "Unhide Product",
    message: (title) => `Are you sure you want to restore "${title}" to listings?`,
    confirmLabel: "Restore",
  },
  feature: {
    title: "Feature Product",
    message: (title) => `Are you sure you want to feature "${title}"? It will be highlighted on the platform.`,
    confirmLabel: "Feature",
  },
  unfeature: {
    title: "Unfeature Product",
    message: (title) => `Are you sure you want to remove "${title}" from featured listings?`,
    confirmLabel: "Unfeature",
  },
  warn: {
    title: "Warn Seller",
    message: (title) => `Are you sure you want to send a warning to the seller of "${title}"?`,
    confirmLabel: "Send Warning",
  },
  delete: {
    title: "Delete Product",
    message: (title) => `Are you sure you want to permanently delete "${title}"? This action cannot be undone.`,
    confirmLabel: "Delete",
    danger: true,
  },
};

function actionToStatus(action: ProductAction): Product["status"] | null {
  switch (action) {
    case "hide": return "hidden";
    case "unhide": return "active";
    case "feature": return "featured";
    case "unfeature": return "active";
    case "warn": return null;
    case "delete": return null;
  }
}

export default function ProductsPage() {
  const router = useRouter();
  const { data: dbProducts, refresh } = useDbResource<Product>("products");
  const [products, setProducts] = useState<Product[] | null>(dbProducts);
  const [confirmAction, setConfirmAction] = useState<{ product: Product; action: ProductAction } | null>(null);

  useEffect(() => {
    setProducts(dbProducts ?? null);
  }, [dbProducts]);

  function handleAction(product: Product, action: ProductAction) {
    if (action === "delete") {
      setProducts((prev) => (prev ?? []).filter((p) => p.id !== product.id));
      void apiDelete("products", product.id).then(refresh);
    } else if (action === "warn") {
      setProducts((prev) => (prev ?? []).map((p) => (p.id === product.id ? { ...p, warningReason: "Content policy warning issued by admin" } : p)));
      void apiPatch("products", product.id, { warningReason: "Content policy warning issued by admin" }).then(refresh);
    } else {
      const status = actionToStatus(action);
      if (status === null) return;
      setProducts((prev) => (prev ?? []).map((p) => (p.id === product.id ? { ...p, status } : p)));
      void apiPatch("products", product.id, { status }).then(refresh);
    }
    setConfirmAction(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Products</h1>
        <p className="mt-1 text-sm text-gray-500">Moderate and manage product listings</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={products ?? []}
            searchable
            searchKey="title"
            onRowClick={(row) => router.push(`/dashboard/products/${row.id}`)}
          />
        </CardContent>
      </Card>

      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)}>
        {confirmAction && (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EF4444]/10">
              {confirmAction.action === "warn" ? (
                <ShieldAlert className="h-6 w-6 text-[#F59E0B]" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-[#EF4444]" />
              )}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#18181B] ">
              {actionMeta[confirmAction.action].title}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {actionMeta[confirmAction.action].message(confirmAction.product.title)}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                variant={actionMeta[confirmAction.action].danger ? "danger" : "primary"}
                onClick={() => handleAction(confirmAction.product, confirmAction.action)}
              >
                {actionMeta[confirmAction.action].confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
