import { cn } from "@/lib/utils";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center gap-1.5 text-sm text-gray-500", className)}>
      <Link href="/dashboard" className="transition-colors hover:text-[#18181B] ">
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-[#18181B] ">
              {item.label}
            </Link>
          ) : (
            <span className="text-[#18181B] ">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
