"use client";

import { useState, useEffect, useMemo } from "react";
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
import { AlertTriangle, ShieldAlert, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Product, Category } from "@/types";

const columnHelper = createColumnHelper<Product>();

function buildColumns(act: (product: Product, action: ProductAction) => void) {
  return [
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
  columnHelper.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const p = info.row.original;
      return (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <DropdownMenu
            align="end"
            trigger={
              <Button variant="ghost" size="sm" aria-label={`Actions for ${p.title}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          >
            {p.status === "featured" && (
              <DropdownMenuItem onClick={() => act(p, "unfeature")}>
                Remove from Featured
              </DropdownMenuItem>
            )}
            {p.status !== "featured" && (
              <DropdownMenuItem onClick={() => act(p, "feature")}>
                Feature
              </DropdownMenuItem>
            )}
            {p.status === "hidden" ? (
              <DropdownMenuItem onClick={() => act(p, "unhide")}>
                Unhide
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => act(p, "hide")}>
                Hide
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => act(p, "warn")}>
              Warn Seller
            </DropdownMenuItem>
            <DropdownMenuItem danger onClick={() => act(p, "delete")}>
              Delete
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      );
    },
  }),
  ];
}

type ProductAction = "hide" | "unhide" | "feature" | "unfeature" | "warn" | "delete";

const normCat = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

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
  const { data: dbProducts, total: productsTotal, refresh } = useDbResource<Product>("products", { take: 100 });
  const { data: dbCategories } = useDbResource<Category>("categories");
  const [products, setProducts] = useState<Product[] | null>(dbProducts);
  const [categories, setCategories] = useState<Category[] | null>(dbCategories);
  const [activeCat, setActiveCat] = useState<string>("__all");
  const [confirmAction, setConfirmAction] = useState<{ product: Product; action: ProductAction } | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo(() => buildColumns((p, a) => setConfirmAction({ product: p, action: a })), []);

  useEffect(() => {
    setProducts(dbProducts ?? null);
  }, [dbProducts]);

  useEffect(() => {
    setCategories(dbCategories ?? null);
  }, [dbCategories]);

  // Live per-category counts computed from the loaded products (never the
  // stored productCount column). Only categories that actually hold products
  // get a tab; anything unmatched lands in Uncategorized so no product can
  // disappear from view.
  const { tabs, counts, uncategorized } = useMemo(() => {
    const list = products ?? [];
    const cats = categories ?? [];
    const byKey = new Map<string, number>();
    let uncategorized = 0;
    for (const p of list) {
      const hit = cats.find((c) => normCat(c.name) === normCat(p.category) || normCat(c.slug) === normCat(p.category));
      if (hit) byKey.set(hit.id, (byKey.get(hit.id) ?? 0) + 1);
      else uncategorized += 1;
    }
    const visible = cats.filter((c) => (byKey.get(c.id) ?? 0) > 0);
    return { tabs: visible, counts: byKey, uncategorized };
  }, [products, categories]);

  const effectiveCat = activeCat !== "__all" && activeCat !== "__uncat" && !tabs.some((c) => c.id === activeCat)
    ? "__all"
    : activeCat;

  const filtered = useMemo(() => {
    const list = products ?? [];
    if (effectiveCat === "__all") return list;
    if (effectiveCat === "__uncat") {
      const cats = categories ?? [];
      return list.filter(
        (p) => !cats.some((c) => normCat(c.name) === normCat(p.category) || normCat(c.slug) === normCat(p.category))
      );
    }
    const cat = (categories ?? []).find((c) => c.id === effectiveCat);
    if (!cat) return list;
    return list.filter((p) => normCat(p.category) === normCat(cat.name) || normCat(p.category) === normCat(cat.slug));
  }, [products, categories, effectiveCat]);

  const activeLabel =
    effectiveCat === "__all"
      ? "All Products"
      : effectiveCat === "__uncat"
        ? "Uncategorized"
        : (categories ?? []).find((c) => c.id === effectiveCat)?.name ?? "Products";

  function handleAction(product: Product, action: ProductAction) {
    const snapshot = products;
    if (action === "delete") {
      setProducts((prev) => (prev ?? []).filter((p) => p.id !== product.id));
      void apiDelete("products", product.id)
        .then(refresh)
        .catch((err) => {
          setProducts(snapshot);
          alert(err instanceof Error ? err.message : "Delete failed — change not saved");
        });
    } else if (action === "warn") {
      setProducts((prev) => (prev ?? []).map((p) => (p.id === product.id ? { ...p, warningReason: "Content policy warning issued by admin" } : p)));
      void apiPatch("products", product.id, { warningReason: "Content policy warning issued by admin" })
        .then(refresh)
        .catch((err) => {
          setProducts(snapshot);
          alert(err instanceof Error ? err.message : "Warn failed — change not saved");
        });
    } else {
      const status = actionToStatus(action);
      if (status === null) return;
      setProducts((prev) => (prev ?? []).map((p) => (p.id === product.id ? { ...p, status } : p)));
      void apiPatch("products", product.id, { status })
        .then(refresh)
        .catch((err) => {
          setProducts(snapshot);
          alert(err instanceof Error ? err.message : "Status update failed — change not saved");
        });
    }
    setConfirmAction(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Products</h1>
        <p className="mt-1 text-sm text-gray-500">Moderate and manage product listings</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveCat("__all")}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
            effectiveCat === "__all"
              ? "border-[#6C3BFF] bg-[#6C3BFF] text-white"
              : "border-[#E4E4E7] bg-white text-gray-600 hover:border-[#6C3BFF]/50 hover:text-[#18181B]"
          }`}
        >
          All
          <span className={`rounded-full px-1.5 text-xs ${effectiveCat === "__all" ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
            {products?.length ?? 0}
          </span>
        </button>
        {tabs.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCat(c.id)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
              effectiveCat === c.id
                ? "border-[#6C3BFF] bg-[#6C3BFF] text-white"
                : "border-[#E4E4E7] bg-white text-gray-600 hover:border-[#6C3BFF]/50 hover:text-[#18181B]"
            }`}
          >
            {c.name}
            <span className={`rounded-full px-1.5 text-xs ${effectiveCat === c.id ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
              {counts.get(c.id) ?? 0}
            </span>
          </button>
        ))}
        {uncategorized > 0 && (
          <button
            type="button"
            onClick={() => setActiveCat("__uncat")}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
              effectiveCat === "__uncat"
                ? "border-[#6C3BFF] bg-[#6C3BFF] text-white"
                : "border-[#E4E4E7] bg-white text-gray-600 hover:border-[#6C3BFF]/50 hover:text-[#18181B]"
            }`}
          >
            Uncategorized
            <span className={`rounded-full px-1.5 text-xs ${effectiveCat === "__uncat" ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
              {uncategorized}
            </span>
          </button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{activeLabel} ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filtered}
            totalCount={activeCat === "__all" ? (productsTotal ?? filtered.length) : null}
            searchable
            searchKey="title"
            filename="products"
            exportColumns={[
              { key: "title", label: "Product" },
              { key: "category", label: "Category" },
              { key: "price", label: "Price (INR)" },
              { key: "status", label: "Status" },
              { key: "reports", label: "Reports" },
              { key: "createdAt", label: "Created" },
            ]}
            selectable
            onBulkDelete={async (rows) => {
              const snapshot = products;
              const ids = (rows as any[]).map((r) => r.id);
              setProducts((prev) => (prev ? prev.filter((p) => !ids.includes(p.id)) : prev));
              // Settled, never sequential-abort: one 409 (has orders) must not
              // silently drop the tail. Per-row report, failures restored.
              const results = await Promise.allSettled(ids.map((id) => apiDelete("products", id)));
              const failed = results.filter((r) => r.status === "rejected").length;
              await refresh();
              if (failed > 0) {
                setProducts(snapshot ?? null);
                await refresh();
                alert(`${failed} of ${ids.length} could not be deleted (likely linked rows) — nothing was removed. Delete them individually for the reason.`);
              }
            }}
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
