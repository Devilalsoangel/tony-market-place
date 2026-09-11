"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Package, Truck, CheckCircle2, XCircle, MapPin, CreditCard,
  ShoppingBag, User, Store, Calendar, Hash, AlertTriangle, RotateCcw,
} from "lucide-react";
import Link from "next/link";
import type { Order } from "@/types";

const methodLabels: Record<string, string> = {
  card: "Card", mobile_money: "Mobile Money", bank_transfer: "Bank Transfer",
  cod: "Cash on Delivery", wallet: "Wallet", coupon: "Coupon",
};

// Mirrors the app pipeline: placed -> confirmed -> preparing -> out_for_delivery -> delivered / cancelled.
const FLOW: { status: Order["status"]; deliveryStatus: Order["deliveryStatus"]; label: string; icon: typeof Truck }[] = [
  { status: "placed", deliveryStatus: "awaiting_shipment", label: "Order Placed", icon: ShoppingBag },
  { status: "confirmed", deliveryStatus: "awaiting_shipment", label: "Confirmed by Seller", icon: CheckCircle2 },
  { status: "preparing", deliveryStatus: "packed", label: "Preparing / Packed", icon: Package },
  { status: "out_for_delivery", deliveryStatus: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { status: "delivered", deliveryStatus: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const REFUND_ACTIONS: Record<string, { label: string; next: Order["refundStatus"] }> = {
  requested: { label: "Approve Refund", next: "approved" },
  approved: { label: "Mark Refund Issued", next: "refunded" },
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: orders, refresh } = useDbResource<Order>("orders");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const fetched = useMemo(() => orders?.find((o) => o.id === id) ?? null, [orders, id]);

  useEffect(() => {
    if (fetched) setOrder(fetched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!order) {
    if (!orders) {
      return (
        <div className="space-y-6">
          <Breadcrumb items={[{ label: "Orders", href: "/dashboard/orders" }, { label: "Order" }]} />
          <div className="py-16 text-center text-sm text-[#A1A1AA]">Loading order…</div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Orders", href: "/dashboard/orders" }, { label: "Order" }]} />
        <EmptyState
          icon={<Package className="h-8 w-8 text-gray-300" />}
          title="Order not found"
          description={`No order exists with ID ${id}.`}
          action={
            <Link href="/dashboard/orders">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" /> Back to Orders
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const normalizedPayment = String(order.paymentMethod ?? "").trim().toLowerCase();
  const isCod = normalizedPayment === "cod" || normalizedPayment === "cash on delivery" || normalizedPayment.includes("cash on delivery");

  function patchOrder(patch: Partial<Order>) {
    const current = order;
    if (!current) return;
    setSaveError(null);
    setOrder({ ...current, ...patch });
    // Surface server refusals (settlement failures, invalid transitions):
    // the row snaps back via refresh, but silently lying "saved" is how
    // money-label bugs were born. No money moves on failure.
    void fetch("/api/data/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: current.id, data: patch }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setSaveError(
            String((body as { error?: unknown } | null)?.error || `Order update refused (HTTP ${res.status}). No money moved.`)
          );
        }
        refresh();
      })
      .catch(() => {
        setSaveError("Could not reach the server. No money moved.");
        refresh();
      });
  }

  const currentIdx = FLOW.findIndex((f) => f.status === order.status);
  const nextStep = currentIdx >= 0 && currentIdx < FLOW.length - 1 ? FLOW[currentIdx + 1] : null;
  const terminal = ["delivered", "cancelled"].includes(order.status);

  function rejectRefund() {
    patchOrder({ refundStatus: "rejected" });
  }

  const refundAction = order.refundStatus ? REFUND_ACTIONS[order.refundStatus] : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-[#18181B] ">{order.id}</h1>
            <StatusBadge status={order.status} />
            {order.deliveryStatus && order.deliveryStatus !== order.status && (
              <StatusBadge status={order.deliveryStatus} />
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Placed {formatDate(order.createdAt, "long")} &middot; {order.items} item{order.items > 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Order Total</p>
          <p className="text-2xl font-bold text-[#18181B] ">{formatCurrency(order.amount)}</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {saveError && (
          <div className="col-span-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[13px] text-[#B91C1C]">
            {saveError}
          </div>
        )}
        {/* Left: items + timeline */}
        <div className="col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.itemsList.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                        <Package className="h-5 w-5 text-[#6C3BFF]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#18181B] ">{item.name}</p>
                        <p className="text-xs text-gray-500">Qty {item.qty}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {order.status === "cancelled" ? (
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FEE2E2]">
                    <XCircle className="h-4 w-4 text-[#EF4444]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#18181B]">Cancelled</p>
                    <p className="mt-0.5 text-xs text-[#EF4444]">This order was cancelled.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  {FLOW.map((step, i) => {
                    const isDone = currentIdx >= i;
                    const isCurrent = currentIdx === i;
                    const Icon = step.icon;
                    return (
                      <div key={step.status} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            isDone ? "bg-[#6C3BFF]/10" : "bg-gray-100"
                          }`}>
                            <Icon className={`h-4 w-4 ${isDone ? "text-[#6C3BFF]" : "text-gray-400"}`} />
                          </div>
                          {i < FLOW.length - 1 && <div className={`mt-1 w-px flex-1 ${isDone ? "bg-[#6C3BFF]/30" : "bg-gray-200"}`} />}
                        </div>
                        <div className="flex-1 pb-6">
                          <p className={`text-sm font-medium ${isDone ? "text-[#18181B] " : "text-gray-400"}`}>
                            {step.label}
                            {isCurrent && <span className="ml-2 text-xs text-[#6C3BFF]">(current)</span>}
                          </p>
                          {isDone && !isCurrent && (
                            <p className="mt-0.5 text-xs text-green-600">Completed</p>
                          )}
                          {!isDone && (
                            <p className="mt-0.5 text-xs text-gray-400">Pending</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status transitions */}
          {!terminal && (
            <Card>
              <CardHeader>
                <CardTitle>Status Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  {nextStep && (
                    <Button
                      variant="primary"
                      onClick={() =>
                        patchOrder({ status: nextStep.status, deliveryStatus: nextStep.deliveryStatus })
                      }
                    >
                      <nextStep.icon className="h-4 w-4" />
                      Mark as {nextStep.label}
                    </Button>
                  )}
                  {(order.status === "placed" || order.status === "confirmed") && (
                    <Button variant="danger" onClick={() => setCancelOpen(true)}>
                      <XCircle className="h-4 w-4" /> Cancel Order
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Refund panel — mirrors the app refund lifecycle (requested -> approved/rejected -> refunded) */}
          {order.refundStatus && (
            <Card>
              <CardHeader>
                <CardTitle>Refund Request</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">{order.refundReason ?? "No reason given"}</p>
                    <p className="mt-0.5 text-xs text-gray-400">Refund status: {order.refundStatus}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {order.refundStatus === "requested" && (
                      <Button variant="danger" onClick={rejectRefund}>
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    )}
                    {refundAction && (
                      <Button
                        variant="primary"
                        onClick={() => patchOrder({ refundStatus: refundAction.next })}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {refundAction.label}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: details */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <User className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Buyer</p>
                    <p className="text-sm font-medium text-[#18181B] ">{order.buyerName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <Store className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Seller</p>
                    <p className="text-sm font-medium text-[#18181B] ">{order.sellerName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <CreditCard className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Payment</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium capitalize text-[#18181B] ">
                        {methodLabels[order.paymentMethod] ?? order.paymentMethod}
                      </p>
                      <StatusBadge status={order.paymentStatus} />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <Calendar className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Placed</p>
                    <p className="text-sm font-medium text-[#18181B] ">{formatDate(order.createdAt, "long")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <Truck className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Carrier</p>
                    <p className="text-sm font-medium text-[#18181B] ">{order.shippingCarrier}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <Hash className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tracking</p>
                    <p className="font-mono text-sm font-medium text-[#18181B] ">{order.trackingNumber}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#6C3BFF]/10">
                    <MapPin className="h-4 w-4 text-[#6C3BFF]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Shipping Address</p>
                    <p className="text-sm font-medium text-[#18181B] ">{order.shippingAddress}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-[#FAFAFA] px-4 py-3 text-sm">
                  <p className="text-gray-500">
                    Estimated delivery:{' '}
                    <span className="font-medium text-[#18181B] ">
                      {order.estimatedDelivery && !Number.isNaN(new Date(order.estimatedDelivery).getTime())
                        ? formatDate(order.estimatedDelivery, "long")
                        : "Not scheduled yet"}
                    </span>
                  </p>
                  {order.actualDelivery && (
                    <p className="mt-1 text-gray-500">
                      Actual delivery: <span className="font-medium text-[#18181B] ">{formatDate(order.actualDelivery, "long")}</span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}>
        <div className="p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-[#EF4444]" />
          <h3 className="mt-3 text-lg font-semibold text-[#18181B] ">Cancel Order {order.id}</h3>
          <p className="mt-2 text-sm text-gray-500">
            {isCod
              ? "Paid on delivery - no payment was collected, so there is nothing to refund. This cannot be undone."
              : `The buyer will be refunded via ${methodLabels[order.paymentMethod] ?? order.paymentMethod}. This cannot be undone.`}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep Order</Button>
            <Button
              variant="danger"
              onClick={() => {
                // Mirror /api/app/orders/[id]: only mark refunded when money actually moved.
                patchOrder({
                  status: "cancelled",
                  deliveryStatus: "cancelled",
                  ...(isCod ? {} : { paymentStatus: "refunded" }),
                });
                setCancelOpen(false);
              }}
            >
              Cancel Order
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}