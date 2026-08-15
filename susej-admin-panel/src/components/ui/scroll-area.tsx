import { cn } from "@/lib/utils";

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export function ScrollArea({ children, className, maxHeight }: ScrollAreaProps) {
  return (
    <div
      className={cn("overflow-y-auto", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </div>
  );
}
