"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface AccordionItem {
  title: string;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  className?: string;
}

export function Accordion({ items, className }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className={cn("space-y-1", className)}>
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-[#E4E4E7] ">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[#18181B] "
          >
            {item.title}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform",
                openIndex === i && "rotate-180"
              )}
            />
          </button>
          {openIndex === i && (
            <div className="border-t border-[#E4E4E7] px-4 py-3 text-sm text-gray-500 ">
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
