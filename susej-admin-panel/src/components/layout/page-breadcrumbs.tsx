"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { findNavItem } from "@/lib/nav-data";

function prettify(segment: string): string {
  // Detail routes carry raw ids (…/orders/cmtw7hbzm…, …/products/lst_cmtw71…):
  // unreadable in a crumb and unquotable on support calls. Collapse any
  // long id-like segment (with or without a lst_/ord_ style prefix) to a
  // short #REF like the tables show.
  // Strict shape only: optional lowercase prefix + underscore, then 13+
  // alphanumerics. Slugs ("out-for-delivery") keep their readable form.
  const idLike = segment.match(/^(?:[a-z]+\_)?([A-Za-z0-9]{13,})$/);
  if (idLike) return `#${idLike[1].slice(-6).toUpperCase()}`;
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
