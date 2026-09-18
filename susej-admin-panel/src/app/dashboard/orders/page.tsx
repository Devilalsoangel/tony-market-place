"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDbResource } from "@/hooks/use-db-resource";
import type { Order, PaymentMethod } from "@/types";

const methodLabels: Record<PaymentMethod, string> = {
  card: "Card",
  mobile_money: "Mobile Money",
  bank_transfer: "Bank Transfer",
  cod: "Cash on Delivery",
  wallet: "Wallet",
  coupon: "Coupon",
};

const methodVariants: Record<PaymentMethod, "primary" | "success" | "info" | "warning" | "default" | "danger"> = {
  card: "primary",
  mobile_money: "success",
  bank_transfer: "info",
  cod: "warning",
  wallet: "default",
  coupon: "danger",
};

const columnHelper = createColumnHelper<Order>();

// App clients persist free-form strings ("Cash on Delivery", "Wallet · ₹120")
// while the canonical keys are snake_case ("cod", "wallet") — align before
// lookup so the column renders a real badge instead of an empty one.
function normalizePaymentMethod(value: string): PaymentMethod | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "cod" || v === "cash on delivery" || v.includes("cash on delivery")) return "cod";
  const known: PaymentMethod[] = ["card", "mobile_money", "bank_transfer", "cod", "wallet", "coupon"];
  if ((known as string[]).includes(v)) return v as PaymentMethod;
  const snake = v.replace(/\s+/g, "_");
  if ((known as string[]).includes(snake)) return snake as PaymentMethod;
  return null;
}

const ORDER_STATUSES = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;

const columns = [
  columnHelper.accessor("id", {
    header: "Order ID",
    // Buyers quote the human SJ- tracking number, not the cuid — show it
    // primary so support can map calls without opening rows.
    cell: (info) => {
      const tracking = (info.row.original as { trackingNumber?: string }).trackingNumber;
      return (
        <span className="whitespace-nowrap font-mono text-sm font-medium text-[#18181B] ">
          {tracking || info.getValue()}
        </span>
      );
    },
  }),
  columnHelper.accessor("buyerName", {
    header: "Buyer",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("sellerName", {
    header: "Seller",
    cell: (info) => {
      const attributed = String((info.row.original as { sellerUsername?: string }).sellerUsername ?? "").trim();
      // Legacy rows store sellerName "Seller" even when attributed: show the
      // handle we actually know instead of a placeholder name.
      const rawName = String(info.getValue() ?? "").trim();
      const display = rawName && rawName.toLowerCase() !== "seller" ? rawName : attributed ? `@${attributed}` : rawName || "—";
      return (
        <span className="flex items-center gap-1.5">
          {display}
          {!attributed && (
            <Badge variant="warning">unattributed</Badge>
          )}
        </span>
      );
    },
  }),
  columnHelper.accessor("amount", {
    header: "Amount",
    cell: (info) => <span className="font-medium">{formatCurrency(info.getValue())}</span>,
  }),
  columnHelper.accessor("items", {
    header: "Items",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const s = info.getValue();
      return (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={s} />
          {info.row.original.refundStatus && (
            <Badge variant={info.row.original.refundStatus === "refunded" ? "success" : "warning"} className="capitalize">
              {info.row.original.refundStatus}
            </Badge>
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor("paymentMethod", {
    header: "Payment Method",
    cell: (info) => {
      const raw = String(info.getValue() ?? "");
      const key = normalizePaymentMethod(raw);
      if (!key) {
        return raw ? (
          <Badge variant="default" className="capitalize">{raw}</Badge>
        ) : (
          <span className="text-gray-400">—</span>
        );
      }
      return <Badge variant={methodVariants[key]}>{methodLabels[key]}</Badge>;
    },
  }),
  columnHelper.accessor("paymentStatus", {
    header: "Payment Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor("createdAt", {
    header: "Date",
    cell: (info) => <span className="text-gray-500">{formatDate(info.getValue())}</span>,
  }),
];

export default function OrdersPage() {
  const router = useRouter();
  const { data: orders, total: ordersTotal, refresh } = useDbResource<Order>("orders", { take: 100 });
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const all = orders ?? [];
    return filter === "all" ? all : all.filter((o) => o.status === filter);
  }, [orders, filter]);

  const counts = useMemo(() => {
    const all = orders ?? [];
    return ORDER_STATUSES.reduce<Record<string, number>>((acc, s) => {
      acc[s] = all.filter((o) => o.status === s).length;
      return acc;
    }, {});
  }, [orders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Lifecycle mirrors the app: placed → confirmed → preparing → out for delivery → delivered / cancelled
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === "all" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({orders?.length ?? 0})
        </Button>
        {ORDER_STATUSES.map((s) => (
          <Button
            key={s}
            variant={filter === s ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s.replaceAll("_", " ")} ({counts[s] ?? 0})
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filtered}
            totalCount={filter === "all" ? (ordersTotal ?? filtered.length) : null}
            searchable
            searchKey="id"
            filename="orders"
            exportColumns={[
              { key: "id", label: "Order ID" },
              { key: "buyerName", label: "Buyer" },
              { key: "sellerName", label: "Seller" },
              { key: "amount", label: "Amount (INR)" },
              { key: "status", label: "Status" },
              { key: "paymentMethod", label: "Payment Method" },
              { key: "createdAt", label: "Date" },
            ]}
            selectable
            onBulkDelete={async (rows) => {
              const ids = (rows as any[]).map((r) => r.id);
              if (!confirm(`Soft-delete ${ids.length} order(s)? They will be marked deleted but remain recoverable.`)) return;
              let failed = 0;
              for (const id of ids) {
                try {
                  const res = await fetch(`/api/data/orders`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id }) });
                  if (!res.ok) failed++;
                } catch { failed++; }
              }
              if (failed > 0) alert(`${failed} delete(s) failed — check permissions`);
              refresh();
            }}
            onRowClick={(row) => router.push(`/dashboard/orders/${row.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
