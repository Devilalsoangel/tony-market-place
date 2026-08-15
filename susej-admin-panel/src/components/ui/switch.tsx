"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}

export function Switch({ checked: controlledChecked, onChange, label }: SwitchProps) {
  const [internalChecked, setInternalChecked] = useState(false);
  const isChecked = controlledChecked ?? internalChecked;

  return (
    <label className="flex items-center gap-3">
      {label && <span className="text-sm text-[#18181B] ">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        onClick={() => {
          const newVal = !isChecked;
          setInternalChecked(newVal);
          onChange?.(newVal);
        }}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          isChecked ? "bg-[#6C3BFF]" : "bg-gray-200 "
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            isChecked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </label>
  );
}
