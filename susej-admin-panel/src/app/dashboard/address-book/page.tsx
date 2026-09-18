"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MapPin } from "lucide-react";
import type { MockAddressBookEntry } from "@/types/admin-rows";

const column = createColumnHelper<MockAddressBookEntry>();

const columns = [
  column.accessor("userName", { header: "User", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("label", { header: "Label", cell: (info) => <Badge variant="default">{info.getValue()}</Badge> }),
  column.accessor("address", { header: "Address", cell: (info) => info.getValue() }),
  column.accessor("city", { header: "City", cell: (info) => info.getValue() }),
  column.accessor("phone", { header: "Phone", cell: (info) => <span className="tabular-nums text-[#71717A]">{info.getValue()}</span> }),
  column.accessor("isDefault", {
    header: "Default",
    cell: (info) => (info.getValue() ? <Badge variant="success">Default</Badge> : <span className="text-[#71717A]">—</span>),
  }),
];

export default function AddressBookPage() {
  const { data: rows, loading: rowsLoading } = useDbResource<MockAddressBookEntry>("address-book");
  const [items, setItems] = useState<MockAddressBookEntry[] | null>(rows);

  useEffect(() => {
    setItems(rows ?? []);
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Address Book</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Saved delivery addresses across all users.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Saved addresses" value={(items ?? []).length} />
        <StatTile label="Users" value={new Set((items ?? []).map((a) => a.userName)).size} />
        <StatTile label="Default addresses" value={(items ?? []).filter((a) => a.isDefault).length} tone="green" />
        <StatTile label="Cities" value={new Set((items ?? []).map((a) => a.city)).size} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable loading={rowsLoading}
            columns={columns}
            data={items ?? []}
            searchable
            searchKey="userName"
            filename="address-book"
            exportColumns={[
              { key: "userName", label: "User" },
              { key: "label", label: "Label" },
              { key: "address", label: "Address" },
              { key: "city", label: "City" },
              { key: "phone", label: "Phone" },
              { key: "isDefault", label: "Default" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}