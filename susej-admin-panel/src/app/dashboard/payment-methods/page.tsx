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
import { formatDate } from "@/lib/utils";
import { CreditCard } from "lucide-react";
import type { MockPaymentMethod } from "@/services/mock-data";

const column = createColumnHelper<MockPaymentMethod>();

const typeVariant: Record<string, "primary" | "success" | "info" | "warning" | "default"> = {
  card: "primary",
  upi: "info",
  wallet: "success",
  bank: "warning",
  cod: "default",
};

const makeColumns = (onToggle: (p: MockPaymentMethod) => void) => [
  column.accessor("userName", { header: "User", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("type", {
    header: "Type",
    cell: (info) => <Badge variant={typeVariant[info.getValue()]} className="capitalize">{String(info.getValue()).replace("_", " ")}</Badge>,
  }),
  column.accessor("brand", { header: "Brand / Provider", cell: (info) => info.getValue() }),
  column.accessor("last4", { header: "Identifier", cell: (info) => <span className="font-mono text-sm text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={info.getValue() === "active" ? "success" : info.getValue() === "expired" ? "warning" : "default"} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("addedAt", { header: "Added", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const p = info.row.original;
      return (
        <Button variant="ghost" size="sm" onClick={() => onToggle(p)}>
          {p.status === "active" ? "Disable" : "Enable"}
        </Button>
      );
    },
  }),
];

export default function PaymentMethodsPage() {
  const { data: rows, refresh } = useDbResource<MockPaymentMethod>("payment-methods");
  const [items, setItems] = useState<MockPaymentMethod[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function toggle(p: MockPaymentMethod) {
    const status = p.status === "active" ? "disabled" : "active";
    setItems((prev) =>
      (prev ?? []).map((x) =>
        x.id === p.id ? { ...x, status: status as MockPaymentMethod["status"] } : x
      )
    );
    try {
      await apiPatch("payment-methods", p.id, { status });
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Payment Methods</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Saved cards, UPI, wallets, and bank accounts across users.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Active methods" value={(items ?? []).filter((p) => p.status === "active").length} tone="green" />
        <StatTile label="Cards" value={(items ?? []).filter((p) => p.type === "card").length} />
        <StatTile label="UPI & wallets" value={(items ?? []).filter((p) => p.type === "upi" || p.type === "wallet").length} />
        <StatTile label="Expired / disabled" value={(items ?? []).filter((p) => p.status !== "active").length} tone="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(toggle)}
            data={items ?? []}
            searchable
            searchKey="userName"
            filename="payment-methods"
            exportColumns={[
              { key: "userName", label: "User" },
              { key: "type", label: "Type" },
              { key: "brand", label: "Brand" },
              { key: "last4", label: "Identifier" },
              { key: "status", label: "Status" },
              { key: "addedAt", label: "Added" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}