"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { ServerTableBar } from "@/components/data-table/server-table-bar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { type MockReportedUser } from "@/types/admin-rows";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiDelete } from "@/lib/api-mutate";
import { formatDate } from "@/lib/utils";
import { Flag, AlertTriangle, ShieldAlert } from "lucide-react";
import type { User } from "@/types";

const columnHelper = createColumnHelper<User>();

const columns = [
  columnHelper.accessor("name", {
    header: "User",
    cell: (info) => (
      <div className="flex items-center gap-3">
        <Avatar name={info.getValue()} size="sm" />
        <div>
          <p className="font-medium">{info.getValue()}</p>
          <p className="text-xs text-gray-500">{info.row.original.email}</p>
        </div>
      </div>
    ),
  }),
  columnHelper.accessor("role", {
    header: "Role",
    cell: (info) => <Badge variant="info">{info.getValue()}</Badge>,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor("verified", {
    header: "Verified",
    cell: (info) => {
      // KYC truth lives in `verification` (synced from seller approvals);
      // `verified` is a legacy boolean that nothing sets.
      const u = info.row.original;
      const isVerified = u.verification === "approved" || (!u.verification && u.verified);
      return isVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="default">Unverified</Badge>;
    },
  }),
  columnHelper.accessor("joinedAt", {
    header: "Joined",
    cell: (info) => <span className="text-gray-500">{formatDate(info.getValue())}</span>,
  }),
];

const reportedTabs = [
  { label: "All Users", value: "all" },
  { label: "Reported", value: "reported" },
];

type ReportAction = "warn" | "suspend" | "ban" | "dismiss";

const actionMeta: Record<ReportAction, { title: string; message: (name: string) => string; confirmLabel: string }> = {
  warn: {
    title: "Warn User",
    message: (name) => `Are you sure you want to send a warning to ${name}?`,
    confirmLabel: "Send Warning",
  },
  suspend: {
    title: "Suspend User",
    message: (name) => `Are you sure you want to suspend ${name}? They'll be temporarily blocked from the platform.`,
    confirmLabel: "Suspend",
  },
  ban: {
    title: "Ban User",
    message: (name) => `Are you sure you want to permanently ban ${name}? This action cannot be undone.`,
    confirmLabel: "Ban",
  },
  dismiss: {
    title: "Dismiss Report",
    message: (name) => `Are you sure you want to dismiss the report against ${name}?`,
    confirmLabel: "Dismiss",
  },
};

export default function UsersPage() {
  const router = useRouter();
  // Server-driven user table (?q=&skip=&take=) — row 101+ searchable.
  const [uq, setUq] = useState("");
  const [uskip, setUskip] = useState(0);
  const { data: users, total: usersTotal, refresh: refreshUsers } = useDbResource<User>("users", {
    take: 100,
    ...(uq.trim() ? { q: uq.trim() } : {}),
    ...(uskip > 0 ? { skip: uskip } : {}),
  });
  const { data: reportedRows, refresh: refreshReported } = useDbResource<MockReportedUser>("reported-users");
  const [reportedList, setReportedList] = useState<MockReportedUser[]>(reportedRows ?? []);
  const [confirmAction, setConfirmAction] = useState<{ id: string; name: string; action: ReportAction } | null>(null);

  useEffect(() => {
    if (reportedRows) setReportedList(reportedRows);
  }, [reportedRows]);

  const totalReports = reportedList.reduce((sum, u) => sum + u.reports, 0);
  const pendingReports = reportedList.filter((u) => u.status === "pending").length;

  async function handleAction(targetId: string, action: ReportAction) {
    const target = reportedList.find((u) => u.id === targetId);
    if (!target) return;
    // The local queue flips ONLY on server success: a refused moderation
    // (role-denied, already-reviewed) used to paint "reviewed" while the
    // server did nothing.
    let ok = false;
    try {
      if (action === "dismiss") {
        await apiDelete("reported-users", target.id);
        ok = true;
      } else {
        // Server-side moderation (POST /api/admin/moderation): full-table
        // email resolution (no 100-row window limit), account patch, and a
        // user-visible warning tell. The old client path silently no-opped
        // out-of-window bans and warned nobody.
        const res = await fetch("/api/admin/moderation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reportId: target.id, action }),
        }).catch(() => null);
        const data = await res?.json().catch(() => null);
        if (!res?.ok) throw new Error(String(data?.error ?? "moderation failed"));
        ok = true;
        if (!data?.accountTouched) {
          alert(
            action === "warn"
              ? `No user account found for ${target.email} — report marked reviewed, no warning delivered.`
              : `No user account found for ${target.email} — report marked reviewed, no account ${action === "ban" ? "banned" : "suspended"}.`
          );
        }
      }
      refreshReported();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Moderation failed — nothing was recorded.");
    }
    if (!ok) {
      setConfirmAction(null);
      return;
    }
    if (action === "dismiss") {
      setReportedList((prev) => prev.filter((u) => u.id !== targetId));
    } else {
      setReportedList((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, status: "reviewed" as const } : u))
      );
    }
    setConfirmAction(null);
  }

  function renderControls(user: MockReportedUser) {
    return (
      <>
        {user.status === "pending" && (
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction({ id: user.id, name: user.name, action: "warn" })}>Warn</Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmAction({ id: user.id, name: user.name, action: "suspend" })}>Suspend</Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmAction({ id: user.id, name: user.name, action: "ban" })}>Ban</Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ id: user.id, name: user.name, action: "dismiss" })} className="text-gray-400">Dismiss</Button>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#18181B] ">Users</h1>
        <p className="mt-1 text-sm text-gray-500">Manage all platform users and review reported accounts</p>
      </div>

      <Tabs tabs={reportedTabs} defaultTab="all">
        {(active) => (
          <>
            {active === "all" && (
              <Card>
                <CardHeader>
                  <CardTitle>All Users ({users?.length ?? 0}{typeof usersTotal === "number" && usersTotal > (users?.length ?? 0) ? ` of ${usersTotal}` : ""})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ServerTableBar
                    q={uq}
                    onQ={(v) => { setUq(v); setUskip(0); }}
                    skip={uskip}
                    onSkip={setUskip}
                    total={usersTotal}
                    loaded={(users ?? []).length}
                    searchPlaceholder="Search name, email, username, phone…"
                  />
                  <DataTable
                    columns={columns}
                    data={users ?? []}
                    totalCount={usersTotal ?? (users ?? []).length}
                    searchable
                    searchKey="name"
                    filename="users"
                    exportColumns={[
                      { key: "name", label: "Name" },
                      { key: "email", label: "Email" },
                      { key: "role", label: "Role" },
                      { key: "status", label: "Status" },
                      { key: "verification", label: "Verification" },
                      { key: "joinedAt", label: "Joined" },
                    ]}
                    selectable
                    onBulkDelete={async (rows) => {
                      const ids = (rows as any[]).map((r) => r.id);
                      if (!confirm(`Soft-delete ${ids.length} user(s)? They will be marked deleted and hidden from active views.`)) return;
                      let failed = 0;
                      for (const id of ids) {
                        try {
                          const res = await fetch(`/api/data/users`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id }) });
                          if (!res.ok) failed++;
                        } catch {
                          failed++;
                        }
                      }
                      refreshUsers();
                      if (failed > 0) alert(`${failed} of ${ids.length} deletes failed — table refreshed to server truth.`);
                    }}
                    onRowClick={(row) => router.push(`/dashboard/users/${row.id}`)}
                  />
                </CardContent>
              </Card>
            )}

            {active === "reported" && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
                    <p className="text-sm text-gray-500">Reported Users</p>
                    <p className="text-2xl font-bold text-[#18181B] ">{reportedList.length}</p>
                  </div>
                  <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
                    <p className="text-sm text-gray-500">Total Reports</p>
                    <p className="text-2xl font-bold text-[#EF4444]">{totalReports}</p>
                  </div>
                  <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-2xl font-bold text-[#F59E0B]">{pendingReports}</p>
                  </div>
                  <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
                    <p className="text-sm text-gray-500">Reviewed</p>
                    <p className="text-2xl font-bold text-[#16A34A]">{reportedList.filter((u) => u.status === "reviewed").length}</p>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Reported Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reportedList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Flag className="mb-3 h-10 w-10 text-gray-300" />
                        <p className="text-sm text-gray-500">No reported users</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reportedList.map((user) => (
                          <div
                            key={user.id}
                            className="flex cursor-pointer items-center justify-between rounded-xl border border-[#E4E4E7] p-4 transition-colors hover:bg-gray-50  "
                            onClick={() => router.push(`/dashboard/users/${(user as unknown as { userId?: string }).userId ?? user.id}`)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar name={user.name} size="md" />
                              <div>
                                <p className="font-medium text-[#18181B] ">{user.name}</p>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <span>{user.reason}</span>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <Flag className="h-3 w-3 text-[#EF4444]" />
                                    {user.reports} reports
                                  </span>
                                </div>
                              </div>
                              <Badge variant={user.status === "pending" ? "warning" : "default"}>{user.status}</Badge>
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              {renderControls(user)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </Tabs>

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
              {actionMeta[confirmAction.action].message(confirmAction.name)}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                variant={confirmAction.action === "warn" || confirmAction.action === "dismiss" ? "primary" : "danger"}
                onClick={() => handleAction(confirmAction.id, confirmAction.action)}
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
