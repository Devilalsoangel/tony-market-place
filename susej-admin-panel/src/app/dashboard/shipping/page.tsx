"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatDate } from "@/lib/utils";
import { Plus, Truck, PackageCheck, Trash2 } from "lucide-react";
import type { Shipment, Carrier, DeliveryZone } from "@/types";

const sColumn = createColumnHelper<Shipment>();

const makeShipmentColumns = (onDeliver: (s: Shipment) => void) => [
  sColumn.accessor("id", { header: "Shipment", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  sColumn.accessor("orderId", { header: "Order" }),
  sColumn.accessor("buyerName", { header: "Buyer" }),
  sColumn.accessor("destination", { header: "Destination" }),
  sColumn.accessor("carrier", { header: "Carrier" }),
  sColumn.accessor("trackingNumber", { header: "Tracking", cell: (info) => <span className="font-mono text-[13px]">{info.getValue()}</span> }),
  sColumn.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant={info.getValue() === "delivered" ? "success" : info.getValue() === "cancelled" ? "danger" : "info"} className="capitalize">
        {info.getValue().replace(/_/g, " ")}
      </Badge>
    ),
  }),
  sColumn.accessor("estimatedDelivery", { header: "ETA", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  sColumn.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const s = info.row.original;
      if (s.status === "delivered" || s.status === "cancelled" || s.status === "returned") return null;
      return (
        <Button variant="secondary" size="sm" onClick={() => onDeliver(s)}>
          <PackageCheck className="h-3.5 w-3.5 text-[#16A34A]" />
          Mark delivered
        </Button>
      );
    },
  }),
];

const cColumn = createColumnHelper<Carrier>();

const makeCarrierColumns = (onToggle: (c: Carrier) => void, onDelete: (c: Carrier) => void) => [
  cColumn.accessor("name", { header: "Carrier", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  cColumn.accessor("rate", { header: "Rate", cell: (info) => <span className="tabular-nums">₹{info.getValue().toFixed(2)}</span> }),
  cColumn.accessor("avgDeliveryDays", { header: "Avg days" }),
  cColumn.accessor("onTimeRate", {
    header: "On-time",
    cell: (info) => {
      const v = info.getValue();
      return v === null
        ? <span className="tabular-nums text-[#71717A]">—</span>
        : <span className="tabular-nums text-[#16A34A]">{v}%</span>;
    },
  }),
  cColumn.accessor("shipments", { header: "Shipments" }),
  cColumn.accessor("active", {
    header: "Status",
    cell: (info) => <Badge variant={info.getValue() ? "success" : "default"}>{info.getValue() ? "Active" : "Inactive"}</Badge>,
  }),
  cColumn.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const c = info.row.original;
      return (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onToggle(c)}>
            {c.active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(c)} className="text-[#EF4444] hover:bg-[#EF4444]/5">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  }),
];

const zColumn = createColumnHelper<DeliveryZone>();

const makeZoneColumns = (onToggle: (z: DeliveryZone) => void, onDelete: (z: DeliveryZone) => void) => [
  zColumn.accessor("name", { header: "Zone", cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  zColumn.accessor("region", { header: "Region", cell: (info) => <span className="text-[#71717A]">{info.getValue()}</span> }),
  zColumn.accessor("rate", { header: "Rate", cell: (info) => <span className="tabular-nums">₹{info.getValue().toFixed(2)}</span> }),
  zColumn.accessor("eta", { header: "ETA" }),
  zColumn.accessor("coverage", { header: "Coverage", cell: (info) => <span className="font-medium">{info.getValue()}%</span> }),
  zColumn.accessor("active", {
    header: "Status",
    cell: (info) => <Badge variant={info.getValue() ? "success" : "default"}>{info.getValue() ? "Active" : "Inactive"}</Badge>,
  }),
  zColumn.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const z = info.row.original;
      return (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onToggle(z)}>
            {z.active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(z)} className="text-[#EF4444] hover:bg-[#EF4444]/5">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  }),
];

export default function ShippingPage() {
  const { data: shipments, loading: shipmentsLoading, refresh: refreshShipments } = useDbResource<Shipment>("shipments");
  const { data: carriers, loading: carriersLoading, refresh: refreshCarriers } = useDbResource<Carrier>("carriers");
  const { data: zones, loading: zonesLoading, refresh: refreshZones } = useDbResource<DeliveryZone>("delivery-zones");
  const [carriersList, setCarriersList] = useState<Carrier[] | null>(carriers);
  const [zonesList, setZonesList] = useState<DeliveryZone[] | null>(zones);
  const [newCarrier, setNewCarrier] = useState(false);
  const [newZone, setNewZone] = useState(false);
  const [carrierForm, setCarrierForm] = useState({ name: "", rate: "", avgDeliveryDays: "" });
  const [zoneForm, setZoneForm] = useState({ name: "", region: "", rate: "", eta: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "carrier" | "zone"; id: string; name: string } | null>(null);

  useEffect(() => {
    setCarriersList(carriers ?? null);
  }, [carriers]);

  useEffect(() => {
    setZonesList(zones ?? null);
  }, [zones]);

  const delivered = (shipments ?? []).filter((s) => s.status === "delivered").length;
  const inTransit = (shipments ?? []).filter((s) => ["shipped", "out_for_delivery", "packed"].includes(s.status)).length;

  // All mutations below are ok-checked with revert + toast: raw
  // `.finally(refresh)` flashed refused rows, then snapped back silently.
  async function mutate(label: string, rollback: () => void, request: () => Promise<Response>, refresh: () => void, onOk?: () => void) {
    try {
      const res = await request();
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `${label} failed (${res.status})`);
      onOk?.();
      refresh();
    } catch (e: unknown) {
      rollback();
      const { toast } = await import("@/components/ui/toast");
      toast.error(e instanceof Error ? e.message : `${label} failed — reverted.`);
    }
  }

  function patch(resource: string, id: string, data: Record<string, unknown>, refresh: () => void, rollback: () => void, label: string) {
    void mutate(label, rollback, () =>
      fetch(`/api/data/${resource}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, data }),
      }), refresh);
  }

  function toggleCarrier(c: Carrier) {
    setCarriersList((prev) => (prev ?? []).map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    patch("carriers", c.id, { active: !c.active }, refreshCarriers, () => setCarriersList(carriers ?? null), "Carrier update");
  }

  function toggleZone(z: DeliveryZone) {
    setZonesList((prev) => (prev ?? []).map((x) => (x.id === z.id ? { ...x, active: !x.active } : x)));
    patch("delivery-zones", z.id, { active: !z.active }, refreshZones, () => setZonesList(zones ?? null), "Zone update");
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const resource = target.kind === "carrier" ? "carriers" : "delivery-zones";
    const refresh = target.kind === "carrier" ? refreshCarriers : refreshZones;
    if (target.kind === "carrier") {
      setCarriersList((prev) => (prev ?? []).filter((x) => x.id !== target.id));
    } else {
      setZonesList((prev) => (prev ?? []).filter((x) => x.id !== target.id));
    }
    setDeleteTarget(null);
    const rollback = target.kind === "carrier"
      ? () => setCarriersList(carriers ?? null)
      : () => setZonesList(zones ?? null);
    void mutate("Delete", rollback, () =>
      fetch(`/api/data/${resource}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: target.id }),
      }), refresh);
  }

  function createCarrier() {
    if (!carrierForm.name.trim()) return;
    const payload = {
      name: carrierForm.name,
      rate: Number(carrierForm.rate) || 0,
      avgDeliveryDays: Number(carrierForm.avgDeliveryDays) || 3,
      onTimeRate: null,
      shipments: 0,
      active: true,
    };
    const tempCarrierId = `car_${Date.now()}`;
    setCarriersList((prev) => [{ ...payload, id: tempCarrierId } as Carrier, ...(prev ?? [])]);
    // Form closes only on success — a refused create keeps the typed input.
    const closeCarrierForm = () => {
      setNewCarrier(false);
      setCarrierForm({ name: "", rate: "", avgDeliveryDays: "" });
    };
    void mutate("Create carrier", () => setCarriersList(carriers ?? null), () =>
      fetch("/api/data/carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }), refreshCarriers, closeCarrierForm);
  }

  function createZone() {
    if (!zoneForm.name.trim()) return;
    const payload = {
      name: zoneForm.name,
      region: zoneForm.region,
      rate: Number(zoneForm.rate) || 0,
      eta: zoneForm.eta,
      coverage: 100,
      active: true,
    };
    setZonesList((prev) => [{ ...payload, id: `zone_${Date.now()}` } as DeliveryZone, ...(prev ?? [])]);
    const closeZoneForm = () => {
      setNewZone(false);
      setZoneForm({ name: "", region: "", rate: "", eta: "" });
    };
    void mutate("Create zone", () => setZonesList(zones ?? null), () =>
      fetch("/api/data/delivery-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }), refreshZones, closeZoneForm);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Shipping</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Manage shipments, carriers and delivery zones.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total shipments" value={(shipments ?? []).length} />
        <StatTile label="In transit" value={inTransit} tone="purple" />
        <StatTile label="Delivered" value={delivered} tone="green" />
        <StatTile label="Carriers" value={(carriersList ?? []).length} />
      </div>

      <Tabs
        tabs={[
          { label: "Shipments", value: "shipments" },
          { label: "Carriers", value: "carriers" },
          { label: "Delivery Zones", value: "zones" },
        ]}
      >
        {(active) => (
          <>
            {active === "shipments" && (
              <Card>
                <CardHeader>
                  <CardTitle>Shipments</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable loading={shipmentsLoading} columns={makeShipmentColumns((s) => {
                      // POD evidence is mandatory server-side (400): prompt
                      // for the tracking ID / receiver name, abort on empty.
                      const note = window.prompt("Delivery proof (courier tracking ID or receiver name):", "")?.trim() ?? "";
                      if (note.length < 4) {
                        alert("Delivery proof required — tracking ID or receiver name (min 4 chars).");
                        return;
                      }
                      patch("shipments", s.id, { status: "delivered", podNote: note }, refreshShipments, refreshShipments, "Shipment update");
                    })}
                    data={shipments ?? []}
                    searchable
                    searchKey="trackingNumber"
                    filename="shipments"
                    exportColumns={[
                      { key: "id", label: "Shipment" },
                      { key: "orderId", label: "Order" },
                      { key: "buyerName", label: "Buyer" },
                      { key: "destination", label: "Destination" },
                      { key: "carrier", label: "Carrier" },
                      { key: "trackingNumber", label: "Tracking" },
                      { key: "status", label: "Status" },
                    ]}
                  />
                </CardContent>
              </Card>
            )}

            {active === "carriers" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Carriers</CardTitle>
                    <Button size="sm" onClick={() => setNewCarrier(true)}>
                      <Plus className="h-4 w-4" />
                      New carrier
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <DataTable loading={carriersLoading} columns={makeCarrierColumns(toggleCarrier, (c) => setDeleteTarget({ kind: "carrier", id: c.id, name: c.name }))}
                    data={carriersList ?? []}
                    searchable
                    searchKey="name"
                    filename="carriers"
                  />
                </CardContent>
              </Card>
            )}

            {active === "zones" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Delivery Zones</CardTitle>
                    <Button size="sm" onClick={() => setNewZone(true)}>
                      <Plus className="h-4 w-4" />
                      New zone
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <DataTable loading={zonesLoading} columns={makeZoneColumns(toggleZone, (z) => setDeleteTarget({ kind: "zone", id: z.id, name: z.name }))}
                    data={zonesList ?? []}
                    searchable
                    searchKey="name"
                    filename="delivery-zones"
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>

      <Dialog open={newCarrier} onClose={() => setNewCarrier(false)} title="New carrier">
        <div className="space-y-4">
          {(
            [
              { key: "name", label: "Name", placeholder: "BlueDart Express" },
              { key: "rate", label: "Rate (₹)", placeholder: "4.5" },
              { key: "avgDeliveryDays", label: "Avg delivery (days)", placeholder: "3" },
            ] as const
          ).map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-sm font-medium text-[#18181B]">{f.label}</label>
              <input
                value={carrierForm[f.key]}
                onChange={(e) => setCarrierForm({ ...carrierForm, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="h-9 w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none placeholder:text-[#A1A1AA] focus:border-[#6C3BFF]"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setNewCarrier(false)}>Cancel</Button>
            <Button onClick={createCarrier} disabled={!carrierForm.name.trim()}>
              <Truck className="h-4 w-4" />
              Create carrier
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={newZone} onClose={() => setNewZone(false)} title="New delivery zone">
        <div className="space-y-4">
          {(
            [
              { key: "name", label: "Zone name", placeholder: "North Region" },
              { key: "region", label: "Region", placeholder: "Maharashtra, Gujarat..." },
              { key: "rate", label: "Rate (₹)", placeholder: "5.0" },
              { key: "eta", label: "ETA", placeholder: "2-3 days" },
            ] as const
          ).map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-sm font-medium text-[#18181B]">{f.label}</label>
              <input
                value={zoneForm[f.key]}
                onChange={(e) => setZoneForm({ ...zoneForm, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="h-9 w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none placeholder:text-[#A1A1AA] focus:border-[#6C3BFF]"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setNewZone(false)}>Cancel</Button>
            <Button onClick={createZone} disabled={!zoneForm.name.trim()}>
              <Plus className="h-4 w-4" />
              Create zone
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        {deleteTarget && (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EF4444]/10">
              <Trash2 className="h-6 w-6 text-[#EF4444]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#18181B]">Delete {deleteTarget.kind}</h3>
            <p className="mt-2 text-sm text-[#71717A]">
              Delete <span className="font-medium text-[#18181B]">{deleteTarget.name}</span>? This cannot be undone.
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