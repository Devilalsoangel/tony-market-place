"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  label: string;
  value: string;
  image?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  fallbackLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyText = "No matches found",
  fallbackLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return matches.slice(0, 50);
  }, [options, query]);

  const pick = (opt: SearchableOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) setQuery("");
          setOpen((o) => !o);
        }}
        className={`flex h-11 w-full items-center gap-2 rounded-2xl border px-4 text-left text-sm outline-none transition-colors ${
          open
            ? "border-[#6C3BFF] ring-1 ring-[#6C3BFF]/20"
            : "border-[#E4E4E7] bg-[#FAFAFA] "
        } ${value ? "text-[#18181B] " : "text-gray-400"}`}
      >
        {selected?.image ? (
          <Avatar src={selected.image} name={selected.label} size="sm" />
        ) : value ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6C3BFF]/10 text-xs font-semibold text-[#6C3BFF]">
            {selected?.label.charAt(0).toUpperCase() ?? "?"}
          </span>
        ) : null}
        <span className="flex-1 truncate">{selected?.label ?? fallbackLabel ?? (value || placeholder)}</span>
        {value ? (
          <span
            role="button"
            aria-label="Clear selection"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange("");
              }
            }}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white shadow-lg ">
          <div className="relative border-b border-[#E4E4E7] p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const first = filtered[0];
                  if (first) pick(first);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder="Search..."
              className="h-9 w-full rounded-xl border border-transparent bg-[#FAFAFA] pl-9 pr-3 text-sm text-[#18181B] outline-none placeholder:text-gray-400 focus:border-[#6C3BFF]  "
            />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-gray-400">{emptyText}</li>
            )}
            {filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => pick(opt)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[#18181B] hover:bg-[#FAFAFA]  "
                >
                  {opt.image ? (
                    <Avatar src={opt.image} name={opt.label} size="sm" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6C3BFF]/10 text-xs font-semibold text-[#6C3BFF]">
                      {opt.label.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {opt.value === value && <Check className="h-4 w-4 text-[#6C3BFF]" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}