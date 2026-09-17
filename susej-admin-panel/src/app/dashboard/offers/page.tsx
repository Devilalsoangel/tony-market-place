"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatDate } from "@/lib/utils";
import { Plus, TicketPercent, Trash2 } from "lucide-react";
import type { Coupon } from "@/types";

const column = createColumnHelper<Coupon>();

const makeColumns = (onToggle: (c: Coupon) => void, onDelete: (c: Coupon) => void) => [
  column.accessor("code", { header: "Code", cell: (info) => <span className="font-mono font-medium text-[#6C3BFF]">{info.getValue()}</span> }),
  column.accessor("type", {
    header: "Type",
    cell: (info) => <Badge variant={info.getValue() === "percent" || info.getValue() === "percentage" ? "primary" : "info"} className="capitalize">{info.getValue()}</Badge>,
  }),
  column.accessor("value", {
    header: "Value",
    cell: (info) => {
      const row = info.row.original;
      return <span className="font-medium tabular-nums">{row.type === "percent" || row.type === "percentage" ? `${row.value}%` : `₹${row.value}`}</span>;
    },
  }),
  column.accessor("usedCount", {
    header: "Usage",
    cell: (info) => {
      const row = info.row.original;
      return (
        <span className="tabular-nums text-[#71717A]">
          {row.usedCount} / {row.usageLimit}
        </span>
      );
    },
  }),
  column.accessor("expiresAt", { header: "Expires", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => {
      const c = info.row.original;
      // Compute effective status: expired if expiry date is in the past
      const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
      const effectiveStatus = isExpired ? "expired" : info.getValue();
      return (
        <Badge variant={effectiveStatus === "active" ? "success" : effectiveStatus === "expired" ? "default" : "warning"} className="capitalize">
          {effectiveStatus}
        </Badge>
      );
    },
  }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const c = info.row.original;
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onToggle(c)}
            disabled={c.status === "expired"}
          >
            {c.status === "active" ? "Disable" : "Enable"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(c)} className="text-[#EF4444] hover:bg-[#EF4444]/5">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  }),
];

interface NewCoupon {
  code: string;
  type: "percent" | "percentage" | "flat" | "fixed" | "free_delivery";
  value: string;
  usageLimit: string;
  expiresAt: string;
}

export default function OffersPage() {
  const { data: coupons, refresh } = useDbResource<Coupon>("coupons");
  const [list, setList] = useState<Coupon[] | null>(coupons);
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<NewCoupon>({ code: "", type: "percent", value: "", usageLimit: "", expiresAt: "" });

  useEffect(() => {
    setList(coupons ?? null);
  }, [coupons]);

  // Compute effective status considering expiry date — a coupon with status "active"
  // but a past expiry date is effectively expired (matches the column display logic).
  const effectiveStatus = (c: Coupon) => {
    const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
    return isExpired ? "expired" : c.status;
  };
  const active = (list ?? []).filter((c) => effectiveStatus(c) === "active");
  const redemptions = (list ?? []).reduce((s, c) => s + c.usedCount, 0);
  const expired = (list ?? []).filter((c) => effectiveStatus(c) === "expired").length;

  function handleToggle(coupon: Coupon) {
    const next = coupon.status === "active" ? "disabled" : "active";
    setList((prev) => (prev ?? []).map((c) => (c.id === coupon.id ? { ...c, status: next as Coupon["status"] } : c)));
    fetch("/api/data/coupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: coupon.id, data: { status: next } }),
    }).finally(refresh);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setList((prev) => (prev ?? []).filter((c) => c.id !== deleteTarget.id));
    fetch("/api/data/coupons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteTarget.id }),
    }).finally(() => {
      setDeleteTarget(null);
      refresh();
    });
  }

  function handleCreate() {
    if (!form.code.trim() || (!form.value && form.type !== "free_delivery")) return;
    // Client mirrors the server money validation (route.ts coupons branch):
    // percent/percentage 1–90, flat/fixed > 0, usageLimit >= 1. The server
    // 400s regardless; this keeps the desk from optimistically listing a row.
    const value = form.type === "free_delivery" ? 1 : Number(form.value);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Value must be greater than 0.");
      return;
    }
    if ((form.type === "percent" || form.type === "percentage") && value > 90) {
      setFormError("Percentage coupons are capped at 90%.");
      return;
    }
    const usageLimit = form.usageLimit.trim() === "" ? 100 : Number(form.usageLimit);
    if (!Number.isInteger(usageLimit) || usageLimit < 1) {
      setFormError("Usage limit must be a whole number of 1 or more.");
      return;
    }
    setFormError(null);
    const payload = {
      code: form.code.toUpperCase(),
      type: form.type,
      value,
      usageLimit,
      usedCount: 0,
      expiresAt: form.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(),
      status: "active",
      createdAt: new Date().toISOString(),
    };
    const ghostId = `c_${Date.now()}`;
    setList((prev) => [{ ...payload, id: ghostId } as Coupon, ...(prev ?? [])]);
    fetch("/api/data/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        // Revert the optimistic row — the coupon was NOT created.
        setList((prev) => (prev ?? []).filter((c) => c.id !== ghostId));
        setFormError((body as { error?: string } | null)?.error ?? "Could not create coupon. Nothing was saved.");
        return;
      }
      setNewOpen(false);
      setForm({ code: "", type: "percent", value: "", usageLimit: "", expiresAt: "" });
      refresh();
    }).catch(() => {
      setList((prev) => (prev ?? []).filter((c) => c.id !== ghostId));
      setFormError("Network error — coupon was not created.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Offers & Coupons</h1>
          <p className="mt-0.5 text-[13px] text-[#71717A]">Create and manage discount coupons.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" />
          New coupon
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total coupons" value={(list ?? []).length} />
        <StatTile label="Active" value={active.length} tone="green" />
        <StatTile label="Redemptions" value={redemptions} tone="purple" />
        <StatTile label="Expired" value={expired} tone="amber" />
      </div>
      {(list ?? []).filter((c) => effectiveStatus(c) === "disabled").length > 0 && (
        <div className="grid grid-cols-4 gap-4 -mt-2">
          <StatTile label="Disabled" value={(list ?? []).filter((c) => effectiveStatus(c) === "disabled").length} tone="default" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Coupons</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(handleToggle, setDeleteTarget)}
            data={list ?? []}
            searchable
            searchKey="code"
            filename="coupons"
            exportColumns={[
              { key: "code", label: "Code" },
              { key: "type", label: "Type" },
              { key: "value", label: "Value" },
              { key: "usedCount", label: "Used" },
              { key: "usageLimit", label: "Limit" },
              { key: "expiresAt", label: "Expires" },
              { key: "status", label: "Status" },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="New coupon">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#18181B]">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="SUMMER20"
              className="h-9 w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none placeholder:text-[#A1A1AA] focus:border-[#6C3BFF]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#18181B]">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as NewCoupon["type"] })}
                className="h-9 w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none focus:border-[#6C3BFF]"
              >
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed amount</option>
                <option value="free_delivery">Free delivery</option>
              </select>
              <p className="mt-1 text-[11px] text-[#71717A]">
                Aliases percentage (= percent) and flat (= fixed) are accepted by existing rows; new rows use the canonical three.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#18181B]">Value</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === "percent" ? "20" : "10"}
                className="h-9 w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none placeholder:text-[#A1A1AA] focus:border-[#6C3BFF]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#18181B]">Usage limit</label>
              <input
                type="number"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="100"
                className="h-9 w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none placeholder:text-[#A1A1AA] focus:border-[#6C3BFF]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#18181B]">Expires</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="h-9 w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none focus:border-[#6C3BFF] [color-scheme:light]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.code.trim() || (!form.value && form.type !== "free_delivery")}>
              <TicketPercent className="h-4 w-4" />
              Create coupon
            </Button>
          </div>
          {formError && (
            <p role="alert" className="pt-1 text-[13px] font-medium text-[#DC2626]">{formError}</p>
          )}
        </div>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        {deleteTarget && (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EF4444]/10">
              <Trash2 className="h-6 w-6 text-[#EF4444]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#18181B]">Delete coupon</h3>
            <p className="mt-2 text-sm text-[#71717A]">
              Delete coupon <span className="font-mono font-medium text-[#18181B]">{deleteTarget.code}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}