"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/data-table/data-table";
import { AdminForm } from "@/components/forms/admin-form";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch, apiPost, apiDelete } from "@/lib/api-mutate";
import { formatDate } from "@/lib/utils";
import { Plus, MoreVertical, AlertTriangle, Shield, Users, MessageSquare, Pencil, Filter, X, CheckCircle2, Copy, Mail } from "lucide-react";
import type { AdminUser, AuditLog } from "@/types";

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  moderator: "Moderator",
};

const roleIcons: Record<string, typeof Shield> = {
  super_admin: Shield,
  manager: Users,
  moderator: MessageSquare,
};

const roleColors: Record<string, string> = {
  super_admin: "#EF4444",
  manager: "#6C3BFF",
  moderator: "#F59E0B",
};

const modules = [
  "Dashboard", "Users", "Sellers", "Products", "Categories",
  "Communities", "Orders", "Reviews", "Payments", "Reports",
  "Messages", "Notifications", "Analytics", "Support", "Settings",
  "Admin Roles",
];

const actions = ["View", "Create", "Edit", "Delete", "Approve", "Reject"];

const managerModules = ["Dashboard", "Users", "Sellers", "Products", "Categories", "Orders", "Payments", "Promotions", "Notifications", "Analytics"];
const managerActions = ["View", "Create", "Edit", "Delete"];
const moderatorModules = ["Communities", "Reviews", "Reports", "Messages"];
const moderatorActions = ["View", "Edit", "Approve", "Reject"];

function getActionVariant(action: string): "info" | "success" | "danger" | "warning" | "default" {
  const map: Record<string, "info" | "success" | "danger" | "warning" | "default"> = {
    login: "info", logout: "default", create: "success", update: "warning",
    delete: "danger", approve: "success", reject: "danger",
    permission_change: "warning", settings_change: "info",
  };
  return map[action] || "default";
}

const auditColumns: ColumnDef<AuditLog>[] = [
  { accessorKey: "adminName", header: "Admin", cell: ({ row }) => <span className="font-medium text-[#18181B] ">{row.getValue("adminName") as string}</span> },
  { accessorKey: "action", header: "Action", cell: ({ row }) => { const a = row.getValue("action") as string; return <Badge variant={getActionVariant(a)}>{a.replaceAll("_", " ")}</Badge>; } },
  { accessorKey: "entity", header: "Entity", cell: ({ row }) => row.getValue("entity") as string },
  { accessorKey: "entityId", header: "Entity ID", cell: ({ row }) => <span className="font-mono text-sm text-gray-500">{row.getValue("entityId") as string}</span> },
  { accessorKey: "details", header: "Details", cell: ({ row }) => <span className="text-sm text-gray-500">{row.getValue("details") as string}</span> },
  { accessorKey: "ip", header: "IP Address", cell: ({ row }) => <span className="font-mono text-xs text-gray-400">{row.getValue("ip") as string}</span> },
  { accessorKey: "timestamp", header: "Timestamp", cell: ({ row }) => <span className="text-gray-500">{formatDate(row.getValue("timestamp") as string, "long")}</span> },
];

const initialPermissions: Record<string, { [module: string]: { [action: string]: boolean } }> = {
  "Super Admin": Object.fromEntries(modules.map((m) => [m, Object.fromEntries(actions.map((a) => [a, true]))])),
  "Manager": Object.fromEntries(modules.map((m) => [m, Object.fromEntries(actions.map((a) => [a, managerModules.includes(m) && managerActions.includes(a)]))])),
  "Moderator": Object.fromEntries(modules.map((m) => [m, Object.fromEntries(actions.map((a) => [a, moderatorModules.includes(m) && moderatorActions.includes(a)]))])),
};

export default function AdminsPage() {
  const { data: auditLogs } = useDbResource<AuditLog>("audit-logs");
  const { data: dbAdmins, refresh } = useDbResource<AdminUser>("admins");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  useEffect(() => {
    setAdmins(dbAdmins ?? []);
  }, [dbAdmins]);
  const [formOpen, setFormOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [createdAdmin, setCreatedAdmin] = useState<AdminUser | null>(null);

  // Every mutation is optimistic with snapshot-revert + toast: the server
  // refuses self-modify, last-super-admin removal, and sub-8-char passwords,
  // and the old `.then(refresh)` showed the refused row until a reload.
  async function revertFail(promise: Promise<unknown>, rollback: () => void) {
    try {
      await promise;
      refresh();
    } catch (e: unknown) {
      rollback();
      const { toast } = await import("@/components/ui/toast");
      toast.error(e instanceof Error ? e.message : "Change refused — reverted.");
    }
  }

  function handleSave(data: Partial<AdminUser>) {
    if (editAdmin) {
      const prev = admins;
      const id = editAdmin.id;
      setAdmins((p) => p.map((a) => (a.id === id ? { ...a, ...data } : a)));
      setEditAdmin(null);
      void revertFail(apiPatch("admins", id, data), () => setAdmins(prev));
    } else {
      const newAdmin: AdminUser = {
        id: `admin_${Date.now()}`,
        name: data.name || "",
        loginId: data.loginId || "",
        email: data.email || undefined,
        password: data.password || undefined,
        role: data.role || "manager",
        status: data.status || "active",
        createdAt: new Date().toISOString(),
      };
      const prev = admins;
      setAdmins((p) => [...p, newAdmin]);
      setCreatedAdmin(newAdmin);
      void revertFail(apiPost("admins", newAdmin), () => {
        setAdmins(prev);
        setCreatedAdmin(null);
      });
    }
  }

  function handleToggleStatus(admin: AdminUser) {
    const prev = admins;
    const status = admin.status === "active" ? "inactive" : "active";
    setAdmins((p) => p.map((a) => (a.id === admin.id ? { ...a, status } : a)));
    void revertFail(apiPatch("admins", admin.id, { status }), () => setAdmins(prev));
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const prev = admins;
    const id = deleteTarget.id;
    setAdmins((p) => p.filter((a) => a.id !== id));
    setDeleteTarget(null);
    void revertFail(apiDelete("admins", id), () => setAdmins(prev));
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  const superAdminCount = admins.filter((a) => a.role === "super_admin").length;
  const managerCount = admins.filter((a) => a.role === "manager").length;
  const moderatorCount = admins.filter((a) => a.role === "moderator").length;

  const [permissions, setPermissions] = useState(initialPermissions);
  const [editRole, setEditRole] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [actionFilter, setActionFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const { data: appSettings } = useDbResource<{ key: string; value: unknown }>("app-settings");

  // hydrate permissions from persisted app-settings once
  useEffect(() => {
    const row = appSettings?.find((s) => s.key === "rolePermissions");
    if (row && typeof row.value === "object" && row.value !== null) {
      setPermissions((prev) => ({ ...prev, ...(row.value as typeof prev) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appSettings]);

  async function savePermissions() {
    try {
      await apiPatch("app-settings", "rolePermissions", { value: permissions });
    } catch {
      await apiPost("app-settings", { key: "rolePermissions", value: permissions });
    }
    setEditRole(null);
  }

  const filteredLogs = useMemo(() => {
    let logs = auditLogs ?? [];
    if (actionFilter !== "all") logs = logs.filter((l) => l.action === actionFilter);
    if (adminFilter !== "all") logs = logs.filter((l) => l.adminName === adminFilter);
    if (dateFilter !== "all") {
      const now = Date.now();
      const cutoff = dateFilter === "today" ? now - 864e5 : dateFilter === "7d" ? now - 7 * 864e5 : dateFilter === "30d" ? now - 30 * 864e5 : dateFilter === "quarter" ? now - 90 * 864e5 : 0;
      logs = logs.filter((l) => Date.parse(l.timestamp) >= cutoff);
    }
    return logs;
  }, [auditLogs, actionFilter, adminFilter, dateFilter]);

  const togglePermission = (role: string, module: string, action: string) => {
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [module]: {
          ...prev[role][module],
          [action]: !prev[role][module][action],
        },
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B] ">Admins</h1>
          <p className="mt-1 text-sm text-gray-500">Manage admin users and their roles</p>
        </div>
        <Button
          onClick={() => {
            setEditAdmin(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add Admin
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-[#18181B] ">{admins.length}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Super Admins</p>
          <p className="text-2xl font-bold text-[#EF4444]">{superAdminCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Managers</p>
          <p className="text-2xl font-bold text-[#6C3BFF]">{managerCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Moderators</p>
          <p className="text-2xl font-bold text-[#F59E0B]">{moderatorCount}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-[#18181B] ">Roles & Permissions</h2>
        <p className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-xs text-[#92400E]">
          Access enforcement is role-based and hardcoded on the server (super_admin / manager / finance / moderator).
          This matrix is recorded for the RBAC-v2 rollout and does not enforce anything yet — changing a checkbox here changes no access today.
        </p>
        <div className="grid grid-cols-3 gap-6">
          {(["Super Admin", "Manager", "Moderator"] as const).map((role) => {
            const roleKey = role === "Super Admin" ? "super_admin" : role.toLowerCase() as "manager" | "moderator";
            const Icon = roleIcons[roleKey];
            const color = roleColors[roleKey];
            const mods = permissions[role];
            const userCount = admins.filter((a) => a.role === roleKey).length;
            return (
              <Card key={role}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}>
                        <Icon className="h-5 w-5" style={{ color }} />
                      </div>
                      <CardTitle>{role}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{userCount} users</Badge>
                      <Button variant="ghost" size="sm" onClick={() => setEditRole(editRole === role ? null : role)}>
                        <Pencil className="h-4 w-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(mods).filter(([, actions]) => Object.values(actions).some(Boolean)).map(([module]) => (
                      <Badge key={module} variant="primary">{module}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Tabs
        tabs={[
          { label: "Admin Users", value: "users" },
          { label: "Activity Log", value: "logs" },
        ]}
      >
        {(active) => (
          <>
            {active === "users" && (
              <Card>
                <CardHeader>
                  <CardTitle>Admin Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E4E4E7] text-left text-sm text-gray-500 ">
                          <th className="pb-3 pl-2 font-medium">Admin</th>
                          <th className="pb-3 font-medium">Admin ID</th>
                          <th className="pb-3 font-medium">Email</th>
                          <th className="pb-3 font-medium">Role</th>
                          <th className="pb-3 font-medium">Status</th>
                          <th className="pb-3 font-medium">Created</th>
                          <th className="w-12 pb-3 font-medium"> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {admins.map((admin) => {
                          const RoleIcon = roleIcons[admin.role] || Shield;
                          return (
                            <tr
                              key={admin.id}
                              className="border-b border-[#E4E4E7] transition-colors hover:bg-gray-50  "
                            >
                              <td className="py-3 pl-2">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                                    style={{ backgroundColor: roleColors[admin.role] }}
                                  >
                                    {getInitials(admin.name)}
                                  </div>
                                  <span className="text-sm font-medium text-[#18181B] ">
                                    {admin.name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 font-mono text-sm text-gray-500">{admin.loginId}</td>
                              <td className="py-3 text-sm text-gray-500">{admin.email || "â€”"}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-1.5">
                                  <RoleIcon className="h-3.5 w-3.5" style={{ color: roleColors[admin.role] }} />
                                  <span className="text-sm text-gray-600 ">
                                    {roleLabels[admin.role] || admin.role}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3">
                                <Badge variant={admin.status === "active" ? "success" : "default"}>
                                  {admin.status}
                                </Badge>
                              </td>
                              <td className="py-3 text-sm text-gray-500">{formatDate(admin.createdAt)}</td>
                              <td className="w-12 py-3" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu
                                  trigger={
                                    <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 ">
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                  }
                                  align="end"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditAdmin(admin);
                                      setFormOpen(true);
                                    }}
                                  >
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleStatus(admin)}>
                                    {admin.status === "active" ? "Deactivate" : "Activate"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem danger onClick={() => setDeleteTarget(admin)}>
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "logs" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Activity Log</CardTitle>
                    <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}>
                      {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                      {showFilters ? "Hide Filters" : "Filters"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showFilters && (
                    <div className="mb-4 grid grid-cols-3 gap-4 rounded-xl bg-[#FAFAFA] p-4 ">
                      <div>
                        <Label>Action Type</Label>
                        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} options={[
                          { label: "All Actions", value: "all" },
                          { label: "Login", value: "login" },
                          { label: "Create", value: "create" },
                          { label: "Update", value: "update" },
                          { label: "Delete", value: "delete" },
                          { label: "Approve", value: "approve" },
                          { label: "Reject", value: "reject" },
                        ]} />
                      </div>
                      <div>
                        <Label>Admin</Label>
                        <Select value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)} options={[
                          { label: "All Admins", value: "all" },
                          ...admins
                            .map((a) => a.name || "")
                            .filter(Boolean)
                            .map((name) => ({ label: name, value: name })),
                        ]} />
                      </div>
                      <div>
                        <Label>Date Range</Label>
                        <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} options={[
                          { label: "All Time", value: "all" },
                          { label: "Today", value: "today" },
                          { label: "Last 7 Days", value: "7d" },
                          { label: "Last 30 Days", value: "30d" },
                          { label: "This Quarter", value: "quarter" },
                        ]} />
                      </div>
                    </div>
                  )}
                  <DataTable columns={auditColumns} data={filteredLogs} searchable searchKey="adminName" />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>

      <AdminForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        editAdmin={editAdmin}
      />

      <Dialog open={!!editRole} onClose={() => setEditRole(null)}>
        <div className="max-h-[80vh] overflow-y-auto p-6">
          <h3 className="mb-4 text-lg font-semibold text-[#18181B] ">Edit Permissions: {editRole}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7]">
                <th className="pb-2 text-left font-medium text-gray-500">Module</th>
                {actions.map((a) => <th key={a} className="pb-2 px-2 text-center text-xs font-medium text-gray-500">{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {editRole && modules.map((module) => (
                <tr key={module} className="border-b border-[#E4E4E7] last:border-0">
                  <td className="py-2 text-sm font-medium text-[#18181B] ">{module}</td>
                  {actions.map((action) => (
                    <td key={action} className="py-2 px-2 text-center">
                      <Checkbox
                        checked={permissions[editRole]?.[module]?.[action] || false}
                        onChange={() => togglePermission(editRole, module, action)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={savePermissions}>Save Permissions</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-[#EF4444]" />
          <h3 className="mt-3 text-lg font-semibold text-[#18181B] ">Delete Admin</h3>
          <p className="mt-2 text-sm text-gray-500">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
          </p>
          <p className="text-xs text-gray-400 mt-1">This action cannot be undone.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!createdAdmin} onClose={() => setCreatedAdmin(null)}>
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#16A34A]/10">
            <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#18181B] ">Admin Created</h3>
          <p className="mt-2 text-sm text-gray-500">
            {createdAdmin?.email
              ? <>
                  <Mail className="mr-1 inline h-4 w-4 text-gray-400" />
                  Login credentials sent to <strong>{createdAdmin.email}</strong>
                </>
              : "Copy the login credentials below and share them with the admin."}
          </p>
          {createdAdmin && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[#FAFAFA] px-4 py-3 ">
                <div className="text-left">
                  <p className="text-xs text-gray-400">Admin ID</p>
                  <code className="text-sm text-gray-700 ">{createdAdmin.loginId}</code>
                </div>
                <button onClick={() => navigator.clipboard.writeText(createdAdmin.loginId)}>
                  <Copy className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[#FAFAFA] px-4 py-3 ">
                <div className="text-left">
                  <p className="text-xs text-gray-400">Password</p>
                  <code className="text-sm text-gray-700 ">{createdAdmin.password}</code>
                </div>
                <button onClick={() => navigator.clipboard.writeText(createdAdmin.password || "")}>
                  <Copy className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>
          )}
          <Button className="mt-5 w-full" onClick={() => setCreatedAdmin(null)}>Done</Button>
        </div>
      </Dialog>
    </div>
  );
}
