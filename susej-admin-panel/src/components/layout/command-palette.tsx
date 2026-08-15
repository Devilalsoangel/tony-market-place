"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Package, ShoppingCart, UsersRound, CreditCard, Settings, BarChart3, Headphones, MessageSquare } from "lucide-react";

const searchItems = [
  { label: "Users", href: "/dashboard/users", icon: Users, keywords: "users people customers" },
  { label: "Sellers", href: "/dashboard/sellers", icon: Users, keywords: "sellers vendors merchants verification" },
  { label: "Products", href: "/dashboard/products", icon: Package, keywords: "products listings items moderation" },
  { label: "Categories", href: "/dashboard/categories", icon: Package, keywords: "categories tags" },
  { label: "Communities", href: "/dashboard/communities", icon: UsersRound, keywords: "communities groups" },
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart, keywords: "orders purchases transactions" },
  { label: "Support", href: "/dashboard/support", icon: Headphones, keywords: "support tickets help" },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, keywords: "analytics charts metrics" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, keywords: "settings configuration" },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = query
    ? searchItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.keywords.toLowerCase().includes(query.toLowerCase())
      )
    : searchItems;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    },
    [open, onOpenChange]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const navigate = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
    if (e.key === "Enter" && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].href);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl rounded-[20px] border border-[#E4E4E7] bg-white shadow-2xl "
        onKeyDown={handleKeyDownList}
      >
        <div className="flex items-center border-b border-[#E4E4E7] px-4">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search anything..."
            className="h-14 flex-1 bg-transparent px-3 text-sm text-[#18181B] outline-none placeholder:text-gray-400 "
          />
          <kbd className="hidden rounded-md border border-[#E4E4E7] px-2 py-0.5 text-xs text-gray-400 sm:inline-block">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">No results found</p>
          )}
          {filtered.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  i === selectedIndex
                    ? "bg-[#6C3BFF]/10 text-[#6C3BFF]"
                    : "text-[#18181B] hover:bg-gray-50  "
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
