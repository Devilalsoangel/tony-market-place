"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface TabsProps {
  tabs: { label: string; value: string }[];
  defaultTab?: string;
  onChange?: (value: string) => void;
  children: (activeTab: string) => React.ReactNode;
}

export function Tabs({ tabs, defaultTab, onChange, children }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.value);

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-[#E4E4E7]">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActive(tab.value);
              onChange?.(tab.value);
            }}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              active === tab.value
                ? "text-[#6C3BFF]"
                : "text-gray-500 hover:text-[#18181B] "
            )}
          >
            {tab.label}
            {active === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6C3BFF]" />
            )}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}
