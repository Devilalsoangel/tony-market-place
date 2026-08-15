import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-gray-600",
        success: "bg-[#16A34A]/10 text-[#15803D]",
        warning: "bg-[#F59E0B]/10 text-[#B45309]",
        danger: "bg-[#EF4444]/10 text-[#B91C1C]",
        info: "bg-[#2563EB]/10 text-[#1D4ED8]",
        primary: "bg-[#6C3BFF]/10 text-[#6C3BFF]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
