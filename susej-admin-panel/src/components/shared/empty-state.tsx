import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No data found",
  description = "There is nothing here yet.",
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 ">
        {icon || <Inbox className="h-8 w-8 text-gray-400" />}
      </div>
      <h3 className="mb-1 text-base font-semibold text-[#18181B] ">{title}</h3>
      <p className="mb-6 max-w-xs text-sm text-gray-500">{description}</p>
      {action}
    </div>
  );
}
