"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function StatCard({ label, value, trend, className }: StatCardProps) {
  return (
    <div className={cn("rounded-[6px] bg-white p-4 ", className)}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#18181B] ">{value}</p>
      {trend && (
        <p className={cn("mt-1 text-xs font-medium", trend.positive ? "text-[#16A34A]" : "text-[#EF4444]")}>
          {trend.positive ? "+" : ""}{trend.value}%
        </p>
      )}
    </div>
  );
}
