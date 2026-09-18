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
import { formatCurrency } from "@/lib/utils";
import { CalendarCheck, CheckCircle2, XCircle } from "lucide-react";
import type { MockBooking } from "@/types/admin-rows";

const column = createColumnHelper<MockBooking>();

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  confirmed: "success",
  placed: "warning",
  cancelled: "danger",
  completed: "info",
};

const makeColumns = (onDecide: (b: MockBooking, status: "confirmed" | "cancelled") => void) => [
  column.accessor("serviceName", { header: "Service", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("customerName", { header: "Customer", cell: (info) => info.getValue() }),
  column.accessor("sellerName", { header: "Provider", cell: (info) => info.getValue() }),
  column.accessor("date", { header: "Date", cell: (info) => info.getValue() }),
  column.accessor("time", { header: "Time", cell: (info) => <span className="tabular-nums">{info.getValue()}</span> }),
  column.accessor("price", { header: "Price", cell: (info) => <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => <Badge variant={statusVariant[info.getValue()]} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const b = info.row.original;
      if (b.status !== "placed") return null;
      return (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onDecide(b, "confirmed")}>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Confirm
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDecide(b, "cancelled")}>
            <XCircle className="h-3.5 w-3.5" /> Cancel
          </Button>
        </div>
      );
    },
  }),
];

export default function BookingsPage() {
  const { data: rows, loading: rowsLoading, total: bookingsTotal, refresh } = useDbResource<MockBooking>("bookings", { take: 100 });
  const [items, setItems] = useState<MockBooking[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  async function decide(b: MockBooking, status: "confirmed" | "cancelled") {
    setItems((prev) => (prev ?? []).map((x) => (x.id === b.id ? { ...x, status } : x)));
    try {
      await apiPatch("bookings", b.id, { status });
      refresh();
    } catch (e) {
      setItems(rows ?? []);
      const { toast } = await import("@/components/ui/toast");
      toast.error(e instanceof Error ? e.message : "Booking update failed — reverted.");
    }
  }

  const revenue = (items ?? []).filter((b) => b.status === "confirmed" || b.status === "completed").reduce((s, b) => s + b.price, 0);
  // Window qualifier shared by revenue + counts below (single source).
  const win = typeof bookingsTotal === "number" && bookingsTotal > (items ?? []).length ? " · first 100" : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Bookings & Services</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Service listings, appointments, and bookings.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label={`Confirmed revenue${win}`} value={formatCurrency(revenue)} tone="green" />
        <StatTile label={`Placed requests${win}`} value={(items ?? []).filter((b) => b.status === "placed").length} tone="amber" />
        <StatTile label={`Completed${win}`} value={(items ?? []).filter((b) => b.status === "completed").length} tone="green" />
        <StatTile label={`Cancelled${win}`} value={(items ?? []).filter((b) => b.status === "cancelled").length} tone="red" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable loading={rowsLoading}
            columns={makeColumns(decide)}
            data={items ?? []}
            searchable
            searchKey="serviceName"
            filename="bookings"
            exportColumns={[
              { key: "serviceName", label: "Service" },
              { key: "customerName", label: "Customer" },
              { key: "sellerName", label: "Provider" },
              { key: "date", label: "Date" },
              { key: "time", label: "Time" },
              { key: "price", label: "Price" },
              { key: "status", label: "Status" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}