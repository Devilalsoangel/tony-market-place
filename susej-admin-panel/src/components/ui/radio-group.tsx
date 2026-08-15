"use client";

import { cn } from "@/lib/utils";

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
}

export function RadioGroup({ options, value, onChange, name }: RadioGroupProps) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
          <div className="relative flex h-5 w-5 items-center justify-center">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange?.(opt.value)}
              className="peer absolute inset-0 cursor-pointer opacity-0"
            />
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                value === opt.value
                  ? "border-[#6C3BFF]"
                  : "border-gray-300 "
              )}
            >
              {value === opt.value && <div className="h-2.5 w-2.5 rounded-full bg-[#6C3BFF]" />}
            </div>
          </div>
          <span className="text-sm text-[#18181B] ">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
