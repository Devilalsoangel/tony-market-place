import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType =
  | "active" | "inactive" | "pending" | "approved" | "rejected"
  | "suspended" | "banned" | "verified" | "unverified"
  | "placed" | "confirmed" | "preparing"
  | "delivered" | "shipped" | "cancelled" | "refunded" | "disputed"
  | "requested" | "live" | "upcoming" | "ended"
  | "awaiting_shipment" | "packed" | "out_for_delivery" | "delivery_failed" | "returned"
  | "paid" | "failed"
  | "success"
  | "low" | "medium" | "high" | "urgent"
  | "open" | "resolved" | "closed";

const statusMap: Record<StatusType, "success" | "warning" | "danger" | "info" | "default" | "primary"> = {
  active: "success",
  inactive: "default",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  suspended: "warning",
  banned: "danger",
  verified: "success",
  unverified: "default",
  placed: "info",
  confirmed: "primary",
  preparing: "warning",
  delivered: "success",
  shipped: "info",
  cancelled: "danger",
  refunded: "warning",
  disputed: "danger",
  requested: "warning",
  live: "success",
  upcoming: "info",
  ended: "default",
  awaiting_shipment: "default",
  packed: "info",
  out_for_delivery: "warning",
  delivery_failed: "danger",
  returned: "warning",
  paid: "success",
  failed: "danger",
  success: "success",
  low: "default",
  medium: "warning",
  high: "danger",
  urgent: "danger",
  open: "info",
  resolved: "success",
  closed: "default",
};

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusMap[status as StatusType] || "default";

  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {formatStatusLabel(status)}
    </Badge>
  );
}
