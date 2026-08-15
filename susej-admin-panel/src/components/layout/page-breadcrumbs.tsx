"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { findNavItem } from "@/lib/nav-data";

function prettify(segment: string): string {
  if (segment.includes("_")) return segment;
  return segment
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function PageBreadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;

  const segments = pathname.split("/").filter(Boolean).slice(1);
  const items: { label: string; href?: string }[] = [];
  let acc = "/dashboard";
  let lastHref: string | undefined;

  for (const seg of segments) {
    acc += "/" + seg;
    const navItem = findNavItem(acc);
    if (navItem && navItem.href !== lastHref) {
      items.push({ label: navItem.label, href: navItem.href });
      lastHref = navItem.href;
      continue;
    }
    if (seg === "sections") continue;
    items.push({ label: prettify(seg) });
  }

  if (items.length === 0) return null;
  return <Breadcrumb items={items} />;
}
