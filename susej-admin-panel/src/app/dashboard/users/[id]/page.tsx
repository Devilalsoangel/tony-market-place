"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/data-table/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ArrowLeft, UserX, ShieldCheck, Trash2, Mail, Calendar, KeyRound, Smartphone, Flag } from "lucide-react";
import Link from "next/link";
import type { User, Product, Order } from "@/types";

const columnHelper = createColumnHelper<Product>();

const listingColumns = [
  columnHelper.accessor("title", { header: "Listing", cell: (info) => <span className="font-medium text-[#18181B] ">{info.getValue()}</span> }),
  columnHelper.accessor("category", { header: "Category", cell: (info) => info.getValue() }),
  columnHelper.accessor("price", { header: "Price", cell: (info) => <span className="font-medium">{formatCurrency(info.getValue())}</span> }),
  columnHelper.accessor("status", { header: "Status", cell: (info) => <StatusBadge status={info.getValue()} /> }),
  columnHelper.accessor("createdAt", { header: "Created", cell: (info) => <span className="text-gray-500">{formatDate(info.getValue())}</span> }),
];

const orderColumnHelper = createColumnHelper<Order>();

const orderColumns = [
  orderColumnHelper.accessor("id", { header: "Order ID", cell: (info) => <span className="font-mono text-sm text-gray-600">{info.getValue()}</span> }),
  orderColumnHelper.accessor("amount", { header: "Amount", cell: (info) => <span className="font-medium">{formatCurrency(info.getValue())}</span> }),
  orderColumnHelper.accessor("items", { header: "Items", cell: (info) => info.getValue() }),
  orderColumnHelper.accessor("status", { header: "Status", cell: (info) => <StatusBadge status={info.getValue()} /> }),
  orderColumnHelper.accessor("paymentMethod", { header: "Payment", cell: (info) => <span className="capitalize text-gray-600">{String(info.getValue()).replace("_", " ")}</span> }),
  orderColumnHelper.accessor("createdAt", { header: "Date", cell: (info) => <span className="text-gray-500">{formatDate(info.getValue())}</span> }),
];

interface LoginSession {
  id: string;
  device: string;
  location: string;
  ip: string;
  at: string;
  current?: boolean;
}

interface ReportEntry {
  id: string;
  reporter: string;
  reason: string;
  date: string;
}

function generateLoginSessions(userId: string): LoginSession[] {
  return [
    { id: `${userId}_s1`, device: "iPhone 15 Pro", location: "Bengaluru, IN", ip: "103.21.44.118", at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), current: true },
    { id: `${userId}_s2`, device: "Windows 11 · Chrome", location: "Bengaluru, IN", ip: "103.21.44.119", at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: `${userId}_s3`, device: "Samsung Galaxy S24", location: "Mumbai, IN", ip: "49.207.10.52", at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
  ];
}

function generateReports(): ReportEntry[] {
  return [
    { id: "rep_a1", reporter: "TechStore", reason: "Spam in comments", date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "rep_a2", reporter: "FashionHub", reason: "Abusive language", date: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString() },
  ];
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: users, refresh } = useDbResource<User>("users");
  const { data: products } = useDbResource<Product>("products");
  const { data: orders } = useDbResource<Order>("orders");
  const [confirmAction, setConfirmAction] = useState<"suspend" | "ban" | "delete" | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const fetched = useMemo(() => users?.find((u) => u.id === id) ?? null, [users, id]);

  useEffect(() => {
    if (fetched) setUser(fetched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const listings = useMemo(
    () => (user ? (products ?? []).filter((p) => p.sellerName === user.name) : []),
    [user, products]
  );
  const userOrders = useMemo(
    () => (user ? (orders ?? []).filter((o) => o.buyerName === user.name || o.sellerName === user.name) : []),
    [user, orders]
  );

  if (!user) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Users", href: "/dashboard/users" }, { label: "User" }]} />
        <EmptyState
          icon={<UserX className="h-8 w-8 text-gray-300" />}
          title="User not found"
          description={`No user exists with ID ${id}.`}
          action={
            <Link href="/dashboard/users">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" /> Back to Users
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  function patchUser(patch: Partial<User>) {
    const current = user;
    if (!current) return;
    setUser({ ...current, ...patch });
    void fetch("/api/data/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, data: patch }),
    });
    setConfirmAction(null);
  }

  function deleteUser() {
    const current = user;
    if (!current) return;
    void fetch("/api/data/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id }),
    });
    setConfirmAction(null);
    window.location.href = "/dashboard/users";
  }

  const loginSessions = generateLoginSessions(user.id);
  const reports = generateReports();

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Users", href: "/dashboard/users" }, { label: user.name }]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6C3BFF]/10 text-xl font-bold text-[#6C3BFF]">
            {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#18181B] ">{user.name}</h1>
              {user.verified && <Badge variant="success"><ShieldCheck className="h-3.5 w-3.5" /> Verified</Badge>}
              <StatusBadge status={user.status} />
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!user.verified && (
            <Button variant="outline" onClick={() => patchUser({ verified: true })}>
              <ShieldCheck className="h-4 w-4" /> Verify User
            </Button>
          )}
          {user.status === "active" ? (
            <Button variant="secondary" onClick={() => setConfirmAction("suspend")}>
              Suspend
            </Button>
          ) : user.status === "suspended" ? (
            <Button variant="outline" onClick={() => patchUser({ status: "active" })}>
              Reactivate
            </Button>
          ) : null}
          <Button variant="danger" onClick={() => setConfirmAction("ban")} disabled={user.status === "banned"}>
            Ban
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
          <p className="text-sm text-gray-500">Role</p>
          <p className="text-xl font-bold capitalize text-[#18181B] ">{user.role}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
          <p className="text-sm text-gray-500">Listings</p>
          <p className="text-xl font-bold text-[#18181B] ">{listings.length}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
          <p className="text-sm text-gray-500">Orders</p>
          <p className="text-xl font-bold text-[#18181B] ">{userOrders.length}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
          <p className="text-sm text-gray-500">Joined</p>
          <p className="text-xl font-bold text-[#18181B] ">{formatDate(user.joinedAt, "long")}</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { label: "Profile Info", value: "info" },
          { label: "Listings", value: "listings" },
          { label: "Orders", value: "orders" },
          { label: "Reports", value: "reports" },
          { label: "Login History", value: "sessions" },
          { label: "Devices", value: "devices" },
        ]}
      >
        {(active) => (
          <>
            {active === "info" && (
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs text-gray-500">Full Name</p>
                      <p className="mt-1 text-sm font-medium text-[#18181B] ">{user.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="mt-1 text-sm font-medium text-[#18181B] ">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Role</p>
                      <p className="mt-1 text-sm font-medium capitalize text-[#18181B] ">{user.role}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <div className="mt-1"><StatusBadge status={user.status} /></div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Account Type</p>
                      <p className="mt-1 text-sm font-medium text-[#18181B] ">
                        {user.verified ? "Verified" : "Unverified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Joined</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-[#18181B] ">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" /> {formatDate(user.joinedAt, "long")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "listings" && (
              <Card>
                <CardHeader>
                  <CardTitle>Listings ({listings.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable columns={listingColumns} data={listings} searchable searchKey="title" />
                </CardContent>
              </Card>
            )}

            {active === "orders" && (
              <Card>
                <CardHeader>
                  <CardTitle>Orders ({userOrders.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable columns={orderColumns} data={userOrders} searchable searchKey="id" />
                </CardContent>
              </Card>
            )}

            {active === "reports" && (
              <Card>
                <CardHeader>
                  <CardTitle>Reports Against User ({reports.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {reports.length === 0 ? (
                    <EmptyState icon={<Flag className="h-8 w-8 text-gray-300" />} title="No reports" description="This user has no reports against them." />
                  ) : (
                    <div className="space-y-3">
                      {reports.map((r) => (
                        <div key={r.id} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EF4444]/10">
                              <Flag className="h-4 w-4 text-[#EF4444]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#18181B] ">{r.reason}</p>
                              <p className="text-xs text-gray-500">Reported by {r.reporter}</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(r.date, "long")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {active === "sessions" && (
              <Card>
                <CardHeader>
                  <CardTitle>Login History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loginSessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                            <KeyRound className="h-4 w-4 text-[#6C3BFF]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#18181B] ">
                              {s.device} {s.current && <Badge variant="success">Current</Badge>}
                            </p>
                            <p className="text-xs text-gray-500">{s.location} · {s.ip}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(s.at, "long")}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "devices" && (
              <Card>
                <CardHeader>
                  <CardTitle>Devices ({loginSessions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loginSessions.map((s) => (
                      <div key={`dev_${s.id}`} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                            <Smartphone className="h-4 w-4 text-[#6C3BFF]" />
                          </div>
                          <p className="text-sm font-medium text-[#18181B] ">{s.device}</p>
                        </div>
                        <span className="text-xs text-gray-400">Last active {formatDate(s.at, "relative")}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>

      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)}>
        <div className="p-6 text-center">
          {confirmAction === "suspend" && (
            <>
              <UserX className="mx-auto h-10 w-10 text-[#F59E0B]" />
              <h3 className="mt-3 text-lg font-semibold text-[#18181B] ">Suspend {user.name}</h3>
              <p className="mt-2 text-sm text-gray-500">
                The user will not be able to log in or place orders until reactivated.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
                <Button variant="secondary" onClick={() => patchUser({ status: "suspended" })}>Suspend</Button>
              </div>
            </>
          )}
          {confirmAction === "ban" && (
            <>
              <UserX className="mx-auto h-10 w-10 text-[#EF4444]" />
              <h3 className="mt-3 text-lg font-semibold text-[#18181B] ">Ban {user.name}</h3>
              <p className="mt-2 text-sm text-gray-500">
                This permanently blocks the account. The user cannot appeal automatically.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
                <Button variant="danger" onClick={() => patchUser({ status: "banned" })}>Ban User</Button>
              </div>
            </>
          )}
          {confirmAction === "delete" && (
            <>
              <Trash2 className="mx-auto h-10 w-10 text-[#EF4444]" />
              <h3 className="mt-3 text-lg font-semibold text-[#18181B] ">Delete {user.name}</h3>
              <p className="mt-2 text-sm text-gray-500">This action cannot be undone.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
                <Button variant="danger" onClick={deleteUser}>Delete</Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}