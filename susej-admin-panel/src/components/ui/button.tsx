import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[8px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF]/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[#6C3BFF] text-white hover:bg-[#5930E6] active:bg-[#4D25CC]",
        secondary:
          "bg-white text-[#18181B] border border-[#E4E4E7] hover:bg-[#F4F4F5] hover:border-[#D4D4D8]",
        ghost: "text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]",
        danger: "bg-[#EF4444] text-white hover:bg-[#DC2626]",
        outline:
          "border border-[#6C3BFF]/30 bg-white text-[#5930E6] hover:bg-[#6C3BFF]/5 hover:border-[#6C3BFF]/50",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
