"use client";

import { useEffect, useState } from "react";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";

/**
 * Server-side queue controls: debounced `q` search + skip-window pager that
 * ride `useDbResource` opts (?q=&skip=&take=). Client-side TanStack
 * search/sort/paging only ever see the loaded window — rows past it are
 * unfindable without this bar. The server counts `total`, so the caption is
 * exact ("showing X–Y of N").
 */
export function ServerTableBar({
  q,
  onQ,
  skip,
  onSkip,
  take = 100,
  total,
  loaded,
  searchPlaceholder = "Search all rows (server)…",
}: {
  q: string;
  onQ: (q: string) => void;
  skip: number;
  onSkip: (skip: number) => void;
  take?: number;
  total: number | null;
  loaded: number;
  searchPlaceholder?: string;
}) {
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== q) onQ(draft);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const totalN = typeof total === "number" ? total : null;
  const from = loaded === 0 ? 0 : skip + 1;
  const to = skip + loaded;
  const hasPrev = skip > 0;
  const hasNext = totalN !== null ? to < totalN : loaded >= take;
  // Caption clamps to reality: skip-beyond-total (shrank table between
  // pages) reads "Showing 0 of N", never "Showing 201–300 of 50".
  const caption =
    totalN !== null
      ? loaded === 0
        ? `Showing 0 of ${totalN}`
        : `Showing ${Math.min(from, totalN)}–${Math.min(to, totalN)} of ${totalN}`
      : `Showing ${loaded}`;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="min-w-[220px] flex-1">
        <SearchInput value={draft} onChange={setDraft} placeholder={searchPlaceholder} />
      </div>
      <span className="text-[12px] text-[#71717A]">
        {caption}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={!hasPrev} onClick={() => onSkip(Math.max(0, skip - take))}>
          Prev {take}
        </Button>
        <Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => onSkip(skip + take)}>
          Next {take}
        </Button>
      </div>
    </div>
  );
}
