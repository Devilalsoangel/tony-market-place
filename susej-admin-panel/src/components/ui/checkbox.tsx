"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export function Checkbox({ checked = false, onChange, label, id }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
      <div className="relative flex h-5 w-5 items-center justify-center">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer absolute inset-0 cursor-pointer opacity-0"
        />
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors",
            checked
              ? "border-[#6C3BFF] bg-[#6C3BFF]"
              : "border-gray-300 bg-white  "
          )}
        >
          {checked && <Check className="h-3 w-3 text-white" />}
        </div>
      </div>
      {label && <span className="text-sm text-[#18181B] ">{label}</span>}
    </label>
  );
}
