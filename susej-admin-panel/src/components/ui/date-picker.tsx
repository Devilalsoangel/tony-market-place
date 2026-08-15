"use client";

import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  className?: string;
}

export function DatePicker({ value, onChange, label, className }: DatePickerProps) {
  return (
    <div className={cn("relative", className)}>
      {label && <label className="mb-1.5 block text-sm font-medium text-[#18181B] ">{label}</label>}
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-11 w-full rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] pl-10 pr-4 text-sm text-[#18181B] outline-none focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20   [color-scheme:light] "
        />
      </div>
    </div>
  );
}

interface DateTimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  className?: string;
}

export function DateTimePicker({ value, onChange, label, className }: DateTimePickerProps) {
  return (
    <div className={cn("relative", className)}>
      {label && <label className="mb-1.5 block text-sm font-medium text-[#18181B] ">{label}</label>}
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-11 w-full rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] pl-10 pr-4 text-sm text-[#18181B] outline-none focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20   [color-scheme:light] "
        />
      </div>
    </div>
  );
}
