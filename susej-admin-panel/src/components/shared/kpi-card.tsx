import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function KPICard({ title, value, icon: Icon, trend, variant = "default", className }: KPICardProps) {
  const variantColors = {
    default: "bg-[#F4F4F5] text-[#71717A]",
    primary: "bg-[#6C3BFF]/10 text-[#6C3BFF]",
    success: "bg-[#16A34A]/10 text-[#16A34A]",
    warning: "bg-[#F59E0B]/10 text-[#F59E0B]",
    danger: "bg-[#EF4444]/10 text-[#EF4444]",
    info: "bg-[#2563EB]/10 text-[#2563EB]",
  };

  return (
    <div
      className={cn("rounded-[6px] bg-white p-5", className)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-[#71717A]">{title}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-[#18181B]">{value}</p>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                trend.positive ? "text-[#16A34A]" : "text-[#EF4444]"
              )}
            >
              {trend.positive ? "▲" : "▼"} {trend.value}% from last month
            </span>
          )}
        </div>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-[8px]", variantColors[variant])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}
