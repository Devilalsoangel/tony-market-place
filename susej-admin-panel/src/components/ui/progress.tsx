import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export function Progress({ value, className, variant = "default" }: ProgressProps) {
  const variantColors = {
    default: "bg-[#6C3BFF]",
    success: "bg-[#16A34A]",
    warning: "bg-[#F59E0B]",
    danger: "bg-[#EF4444]",
  };

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-gray-100 ", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", variantColors[variant])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
