"use client";

import { useRouter } from "next/navigation";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatNumber } from "@/lib/utils";
import { Flag, ShieldAlert } from "lucide-react";
import type { Community } from "@/types";

const columnHelper = createColumnHelper<Community>();

const baseColumns = [
  columnHelper.accessor("name", {
    header: "Community",
    cell: (info) => (
      <div>
        <p className="font-medium text-[#18181B] ">{info.getValue()}</p>
        <p className="text-xs text-gray-500">Owner: {info.row.original.ownerName}</p>
      </div>
    ),
  }),
  columnHelper.accessor("members", {
    header: "Members",
    cell: (info) => formatNumber(info.getValue()),
  }),
  columnHelper.accessor("posts", {
    header: "Posts",
    cell: (info) => formatNumber(info.getValue()),
  }),
  columnHelper.accessor("type", {
    header: "Type",
    cell: (info) => <Badge variant={info.getValue() === "public" ? "info" : "default"}>{info.getValue()}</Badge>,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor("reports", {
    header: "Reports",
    cell: (info) => (
      <span className={info.getValue() > 0 ? "flex items-center gap-1 text-[#EF4444]" : "text-gray-500"}>
        {info.getValue() > 0 && <Flag className="h-3.5 w-3.5" />}
        {info.getValue()}
      </span>
    ),
  }),
];

function ModerationQueue({ communities }: { communities: Community[] }) {
  const router = useRouter();
  const withReports = communities.filter((c) => c.reports > 0 || c.status !== "active");

  return (
    <div className="space-y-3">
      {withReports.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">All communities are clear. No moderation needed.</p>
        </div>
      ) : (
        withReports.map((c) => (
          <div
            key={c.id}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-[#E4E4E7] px-5 py-4 transition-colors hover:bg-gray-50  "
            onClick={() => router.push(`/dashboard/communities/${c.id}`)}
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                c.status === "banned" ? "bg-[#EF4444]/10" : c.reports > 0 ? "bg-[#F59E0B]/10" : "bg-[#16A34A]/10"
              }`}>
                <ShieldAlert className={`h-6 w-6 ${
                  c.status === "banned" ? "text-[#EF4444]" : c.reports > 0 ? "text-[#F59E0B]" : "text-[#16A34A]"
                }`} />
              </div>
              <div>
                <p className="font-medium text-[#18181B] ">{c.name}</p>
                <p className="text-sm text-gray-500">
                  {c.reports > 0 ? `${c.reports} report${c.reports > 1 ? "s" : ""}` : c.status === "suspended" ? "Suspended" : c.status === "banned" ? "Banned" : "Clear"}
                  {" · "}{formatNumber(c.members)} members
                </p>
              </div>
            </div>
            <Button variant="primary" size="sm">Review</Button>
          </div>
        ))
      )}
    </div>
  );
}

const tabs = [
  { label: "All Communities", value: "all" },
  { label: "Moderation Queue", value: "moderation" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Banned", value: "banned" },
];

export default function CommunitiesPage() {
  const router = useRouter();
  const { data: dbCommunities, loading: dbCommunitiesLoading } = useDbResource<Community>("communities");
  const communities = dbCommunities ?? [];
  const totalReports = communities.reduce((sum, c) => sum + c.reports, 0);
  const flaggedCount = communities.filter((c) => c.status !== "active" || c.reports > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Communities</h1>
        <p className="mt-1 text-sm text-gray-500">Moderate communities, posts, comments, and reports</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Total Communities</p>
          <p className="text-2xl font-bold text-[#18181B] ">{communities.length}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Needs Attention</p>
          <p className="text-2xl font-bold text-[#F59E0B]">{flaggedCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Total Reports</p>
          <p className="text-2xl font-bold text-[#EF4444]">{totalReports}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Active Communities</p>
          <p className="text-2xl font-bold text-[#16A34A]">{communities.filter((c) => c.status === "active").length}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Community Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs tabs={tabs} defaultTab="all">
            {(active) => {
              let data = communities;
              if (active === "moderation") data = communities.filter((c) => c.reports > 0 || c.status !== "active");
              else if (active === "active") data = communities.filter((c) => c.status === "active");
              else if (active === "suspended") data = communities.filter((c) => c.status === "suspended");
              else if (active === "banned") data = communities.filter((c) => c.status === "banned");

              if (active === "moderation") {
                return <ModerationQueue communities={communities} />;
              }

              return <DataTable loading={dbCommunitiesLoading} columns={baseColumns} data={data} searchable searchKey="name" onRowClick={(row) => router.push(`/dashboard/communities/${row.id}`)} />;
            }}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
