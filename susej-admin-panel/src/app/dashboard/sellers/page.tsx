"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatDate } from "@/lib/utils";
import { Eye } from "lucide-react";
import type { Seller } from "@/types";

const columnHelper = createColumnHelper<Seller>();

const baseColumns = [
  columnHelper.accessor("businessName", {
    header: "Business",
    cell: (info) => (
      <div>
        <p className="font-medium text-[#18181B] ">{info.getValue()}</p>
        <p className="text-xs text-gray-500">{info.row.original.ownerName}</p>
      </div>
    ),
  }),
  columnHelper.accessor("kycStatus", {
    header: "KYC",
    // Soft-deleted sellers otherwise render as live — the status column is
    // the only place deletion is visible (rows stay for audit recovery).
    cell: (info) => (
      <span className="inline-flex items-center gap-1.5">
        <StatusBadge status={info.getValue()} />
        {(info.row.original as { status?: string }).status === "deleted" && (
          <span className="rounded-full bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-medium text-[#991B1B]">
            Deleted
          </span>
        )}
      </span>
    ),
  }),
  columnHelper.accessor("gstStatus", {
    header: "GST",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor("productsCount", {
    header: "Products",
    cell: (info) => <span>{info.getValue()}</span>,
  }),
  columnHelper.accessor("joinedAt", {
    header: "Joined",
    cell: (info) => <span className="text-gray-500">{formatDate(info.getValue())}</span>,
  }),
];

function PendingQueue({ sellers, total }: { sellers: Seller[]; total: number | null }) {
  const pending = sellers.filter((s) => s.kycStatus === "pending");

  return (
    <div className="space-y-3">
      {typeof total === "number" && total > sellers.length && (
        <p className="text-[12px] text-[#71717A]">Server queue holds {total} — paging above pages the full queue.</p>
      )}
      {pending.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">No pending verification requests.</p>
        </div>
      ) : (
        pending.map((seller) => {
          const verifiedDocs = (seller.documents ?? []).filter((d) => d.verified).length;
          const totalDocs = (seller.documents ?? []).length;
          return (
            <Link key={seller.id} href={`/dashboard/sellers/${seller.id}`}>
              <div className="flex items-center justify-between rounded-xl border border-[#E4E4E7] px-5 py-4 transition-colors hover:bg-gray-50  ">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6C3BFF]/10 text-lg font-bold text-[#6C3BFF]">
                    {seller.businessName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-[#18181B] ">{seller.businessName}</p>
                    <p className="text-sm text-gray-500">{seller.ownerName} · {seller.email}</p>
                    <p className="text-xs text-gray-400">Submitted {formatDate(seller.submittedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Documents</p>
                    <p className="text-sm font-medium text-[#18181B] ">{verifiedDocs}/{totalDocs} verified</p>
                  </div>
                  <Button variant="primary" size="sm">
                    <Eye className="h-4 w-4" /> Review
                  </Button>
                </div>
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}

const tabs = [
  { label: "All Sellers", value: "all" },
  { label: "Pending Queue", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
];

export default function SellersPage() {
  const router = useRouter();
  const { data: sellers, total: sellersTotal, refresh } = useDbResource<Seller>("sellers", { take: 100 });
  // Pending queue pages the SERVER (?status=pending → kycStatus): the
  // in-memory filter over the first 100 hid pendings at row 101+.
  const [pendingSkip, setPendingSkip] = useState(0);
  const { data: pendingRows, total: pendingTotal } = useDbResource<Seller>("sellers", {
    take: 100,
    status: "pending",
    ...(pendingSkip > 0 ? { skip: pendingSkip } : {}),
  });
  const allSellers = sellers ?? [];
  const pendingCount = typeof pendingTotal === "number" ? pendingTotal : allSellers.filter((s) => s.kycStatus === "pending").length;
  const verifiedCount = allSellers.filter((s) => s.kycStatus === "approved").length;
  const rejectedCount = allSellers.filter((s) => s.kycStatus === "rejected").length;
  // Window qualifier for the in-memory tabs (the pending queue pages the
  // server; verified/rejected filter the loaded window).
  const win = typeof sellersTotal === "number" && sellersTotal > allSellers.length ? " · first 100" : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Sellers</h1>
        <p className="mt-1 text-sm text-gray-500">Review and verify seller applications</p>
      </div>

      <Tabs tabs={tabs} defaultTab="all">
        {(active) => (
          <>
            {active === "all" && (
              <Card>
                <CardHeader>
                  <CardTitle>All Sellers ({allSellers.length}{win})</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={baseColumns}
                    data={allSellers}
                    totalCount={sellersTotal ?? allSellers.length}
                    searchable
                    searchKey="businessName"
                    filename="sellers"
                    exportColumns={[
                      { key: "businessName", label: "Business" },
                      { key: "kycStatus", label: "KYC" },
                      { key: "gstStatus", label: "GST" },
                      { key: "productsCount", label: "Products" },
                      { key: "joinedAt", label: "Joined" },
                    ]}
                    selectable
                    onBulkDelete={async (rows) => {
                      const ids = (rows as any[]).map((r) => r.id);
                      if (!confirm(`Delete ${ids.length} seller(s)? Sellers with live data or review evidence are protected and will be skipped.`)) return;
                      const failures: string[] = [];
                      for (const id of ids) {
                        try {
                          const res = await fetch(`/api/data/sellers`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id }) });
                          // Surface the server's exact 409 reason (live data /
                          // review evidence) — never a generic permissions shrug.
                          if (!res.ok) {
                            const body = await res.json().catch(() => null);
                            failures.push(`${id}: ${body?.error ?? `HTTP ${res.status}`}`);
                          }
                        } catch (e) { failures.push(`${id}: ${e instanceof Error ? e.message : "network error"}`); }
                      }
                      if (failures.length > 0) alert(`${failures.length} delete(s) refused:\n${failures.slice(0, 5).join("\n")}${failures.length > 5 ? `\n…+${failures.length - 5} more` : ""}`);
                      refresh();
                    }}
                    onRowClick={(row) => router.push(`/dashboard/sellers/${row.id}`)}
                  />
                </CardContent>
              </Card>
            )}
            {active === "pending" && (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Queue ({pendingCount})</CardTitle>
                </CardHeader>
                <CardContent>
                  <PendingQueue sellers={pendingRows ?? []} total={pendingTotal} />
                  {typeof pendingTotal === "number" && pendingTotal > (pendingRows ?? []).length && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pendingSkip === 0}
                        onClick={() => setPendingSkip(Math.max(0, pendingSkip - 100))}
                      >
                        Prev 100
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pendingSkip + (pendingRows ?? []).length >= pendingTotal}
                        onClick={() => setPendingSkip(pendingSkip + 100)}
                      >
                        Next 100
                      </Button>
                      <span className="text-[12px] text-[#71717A]">
                        Showing {pendingSkip + 1}–{pendingSkip + (pendingRows ?? []).length} of {pendingTotal}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {active === "verified" && (
              <Card>
                <CardHeader>
                  <CardTitle>Verified Sellers ({verifiedCount}{win})</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={baseColumns}
                    data={allSellers.filter((s) => s.kycStatus === "approved")}
                    searchable
                    searchKey="businessName"
                    onRowClick={(row) => router.push(`/dashboard/sellers/${row.id}`)}
                  />
                </CardContent>
              </Card>
            )}
            {active === "rejected" && (
              <Card>
                <CardHeader>
                  <CardTitle>Rejected Sellers ({rejectedCount}{win})</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={baseColumns}
                    data={allSellers.filter((s) => s.kycStatus === "rejected")}
                    searchable
                    searchKey="businessName"
                    onRowClick={(row) => router.push(`/dashboard/sellers/${row.id}`)}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}
