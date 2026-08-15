import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          className={cn(
            "h-9 w-full rounded-[8px] border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none transition-colors placeholder:text-[#A1A1AA] hover:border-[#D4D4D8] focus:border-[#6C3BFF] focus:ring-2 focus:ring-[#6C3BFF]/15",
            icon && "pl-10",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
