"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { useDbResource } from "@/hooks/use-db-resource";
import type { SupportTicket } from "@/types";

const columnHelper = createColumnHelper<SupportTicket>();

const columns = [
  columnHelper.accessor("id", {
    header: "Ticket",
    cell: (info) => <span className="font-mono font-medium text-[#18181B] ">{info.getValue()}</span>,
  }),
  columnHelper.accessor("userName", {
    header: "User",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("subject", {
    header: "Subject",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("priority", {
    header: "Priority",
    cell: (info) => {
      const map: Record<string, "warning" | "danger" | "default"> = {
        low: "default",
        medium: "warning",
        high: "danger",
        urgent: "danger",
      };
      return <Badge variant={map[info.getValue()] || "default"}>{info.getValue()}</Badge>;
    },
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor("assignee", {
    header: "Assignee",
    cell: (info) => info.getValue() || <span className="text-gray-400">â€”</span>,
  }),
  columnHelper.accessor("createdAt", {
    header: "Created",
    cell: (info) => <span className="text-gray-500">{formatDate(info.getValue())}</span>,
  }),
];

export default function SupportPage() {
  const { data: tickets } = useDbResource<SupportTicket>("tickets");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Support Center</h1>
        <p className="mt-1 text-sm text-gray-500">Manage support tickets and live chat</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={tickets ?? []} searchable searchKey="subject" />
        </CardContent>
      </Card>
    </div>
  );
}
