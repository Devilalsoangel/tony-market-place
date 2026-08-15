"use client";

import { Search, Bell, LogOut, BellRing } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDbResource } from "@/hooks/use-db-resource";
import { useAuthStore } from "@/store/auth-store";

interface NotificationRow {
  id: string;
  channel: string;
  title: string;
  audience: string;
  status: string;
  sentAt?: string;
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface NavbarProps {
  onOpenSearch?: () => void;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  moderator: "Moderator",
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function Navbar({ onOpenSearch }: NavbarProps) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { data: notifications } = useDbResource<NotificationRow>("notification-history");
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const initials = user ? getInitials(user.name) : "AD";
  const displayName = user?.name || "Admin";
  const roleLabel = user ? (roleLabels[user.role] || user.role) : "Admin";
  const recent = (notifications ?? []).slice(0, 5);

  function handleLogout() {
    logout();
    setLogoutOpen(false);
    fetch("/api/logout", { method: "POST" }).finally(() => {
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between bg-white px-4">
      <div className="flex items-center">
        <span className="text-[13px] font-medium text-[#71717A]">Admin Panel</span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenSearch}
          className="flex h-7 items-center gap-2 rounded-[6px] border border-[#E4E4E7] bg-white px-2.5 text-xs text-[#A1A1AA] transition-colors hover:border-[#D4D4D8] hover:text-[#71717A]"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="rounded-[4px] border border-[#E4E4E7] bg-[#FAFAFA] px-1 text-[10px] font-medium text-[#A1A1AA]">
            ⌘K
          </kbd>
        </button>

        <DropdownMenu
          trigger={
            <button className="relative flex h-7 w-7 items-center justify-center rounded-[6px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#18181B]">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#6C3BFF]" />
            </button>
          }
          align="end"
          className="min-w-[300px]"
        >
          <div className="flex items-center justify-between border-b border-[#E4E4E7] px-3 py-2">
            <p className="text-sm font-semibold text-[#18181B]">Notifications</p>
            <Badge variant="primary">{recent.length}</Badge>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {recent.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[#A1A1AA]">No notifications yet</p>
            ) : (
              recent.map((n) => (
                <div key={n.id} className="border-b border-[#F4F4F5] px-3 py-2.5 last:border-0">
                  <div className="flex items-center gap-2">
                    <BellRing className="h-3.5 w-3.5 shrink-0 text-[#6C3BFF]" />
                    <p className="truncate text-[13px] font-medium text-[#18181B]">{n.title}</p>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between pl-5">
                    <p className="text-[11px] text-[#A1A1AA] capitalize">{n.audience} · {n.status}</p>
                    <p className="text-[11px] text-[#A1A1AA]">{timeAgo(n.sentAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-[#E4E4E7] p-1.5">
            <DropdownMenuItem onClick={() => router.push("/dashboard/notifications")}>
              <BellRing className="mr-2 h-4 w-4" />
              View all notifications
            </DropdownMenuItem>
          </div>
        </DropdownMenu>

        <DropdownMenu
          trigger={
            <button className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#6C3BFF] text-xs font-semibold text-white transition-opacity hover:opacity-90">
              {initials}
            </button>
          }
          align="end"
          className="min-w-[220px]"
        >
          <div className="border-b border-[#E4E4E7] px-3 py-2">
            <p className="text-sm font-medium text-[#18181B]">{displayName}</p>
            <p className="text-xs text-[#A1A1AA]">{user?.email}</p>
            <div className="mt-1.5">
              <Badge variant="primary">{roleLabel}</Badge>
            </div>
          </div>
          <DropdownMenuItem onClick={() => setLogoutOpen(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)}>
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EF4444]/10">
            <LogOut className="h-6 w-6 text-[#EF4444]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#18181B]">Logout</h3>
          <p className="mt-2 text-sm text-[#71717A]">Are you sure you want to log out of the admin panel?</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setLogoutOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </Dialog>
    </header>
  );
}
