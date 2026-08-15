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

const ORDER_STATUSES = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;

const columns = [
  columnHelper.accessor("id", {
    header: "Order ID",
    cell: (info) => <span className="font-mono text-sm font-medium text-[#18181B] ">{info.getValue()}</span>,
  }),
  columnHelper.accessor("buyerName", {
    header: "Buyer",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("sellerName", {
    header: "Seller",
    cell: (info) => info.getValue(),
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
    cell: (info) => <Badge variant={methodVariants[info.getValue()]}>{methodLabels[info.getValue()]}</Badge>,
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
  const { data: orders } = useDbResource<Order>("orders");
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
            {s.replace("_", " ")} ({counts[s] ?? 0})
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
            searchable
            searchKey="id"
            onRowClick={(row) => router.push(`/dashboard/orders/${row.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
