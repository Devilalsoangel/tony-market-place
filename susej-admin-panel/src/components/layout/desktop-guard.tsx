"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { DESKTOP_BREAKPOINT } from "@/lib/constants";

export function DesktopGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const isDesktop = useMediaQuery(`(min-width: ${DESKTOP_BREAKPOINT}px)`);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <>{children}</>;
  if (isDesktop) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#151A2D] p-8">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[#6C3BFF]/10">
          <Monitor className="h-12 w-12 text-[#6C3BFF]" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-white">
          SUSEJ Admin Panel
        </h1>
        <p className="mb-2 text-lg text-gray-300">
          Available only on Desktop devices
        </p>
        <p className="mb-8 text-sm text-gray-500">
          Please open this panel on a laptop or desktop computer (minimum 1024px width).
        </p>
        <a
          href="https://susej.com"
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#6C3BFF] px-8 text-sm font-medium text-white transition-colors hover:bg-[#5930E6]"
        >
          Return to Main Website
        </a>
      </div>
    </div>
  );
}
