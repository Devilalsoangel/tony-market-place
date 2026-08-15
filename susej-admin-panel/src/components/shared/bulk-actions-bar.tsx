"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
}

interface BulkActionsBarProps {
  selectedCount: number;
  actions: BulkAction[];
  className?: string;
}

export function BulkActionsBar({ selectedCount, actions, className }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-[20px] border border-[#E4E4E7] bg-white px-6 py-3 shadow-lg ",
        className
      )}
    >
      <span className="text-sm font-medium text-[#18181B] ">
        {selectedCount} selected
      </span>
      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant || "secondary"}
            size="sm"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
