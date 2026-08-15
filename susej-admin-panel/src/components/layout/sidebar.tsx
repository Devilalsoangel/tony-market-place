"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/sidebar-store";
import { useAuthStore } from "@/store/auth-store";
import { MODULES, type NavItem, type NavModule } from "@/lib/nav-data";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle, setCollapsed, openModules, toggleModule } = useSidebarStore();
  const logout = useAuthStore((s) => s.logout);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const isItemActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const activeModule = MODULES.find((m) => m.items.some((i) => isItemActive(i.href)));

  const handleModuleClick = (module: NavModule) => {
    if (collapsed) {
      setCollapsed(false);
      toggleModule(module.id);
      return;
    }
    toggleModule(module.id);
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col bg-white transition-all duration-200",
        collapsed ? "w-[64px]" : "w-[240px]"
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#E4E4E7] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#6C3BFF] text-[13px] font-bold text-white">
            S
          </span>
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[#18181B]">SUSEJ</span>
          )}
        </div>
        <button
          onClick={toggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[#A1A1AA] transition-colors hover:bg-[#F4F4F5] hover:text-[#18181B]"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {MODULES.map((module) => {
          const isModuleActive = activeModule?.id === module.id;
          const isOverview = module.id === "overview";
          const isOpen = isOverview || openModules.includes(module.id) || isModuleActive;
          const ModuleIcon = module.icon;

          return (
            <div key={module.id} className="mb-2">
              {isOverview ? (
                <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.04em] text-[#A1A1AA]">
                  {module.label}
                </p>
              ) : (
                <button
                  onClick={() => handleModuleClick(module)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.04em] transition-colors",
                    isModuleActive ? "text-[#6C3BFF]" : "text-[#A1A1AA] hover:bg-[#F4F4F5] hover:text-[#18181B]",
                    collapsed && "justify-center px-0"
                  )}
                  title={collapsed ? module.label : undefined}
                >
                  <ModuleIcon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-left">{module.label}</span>
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-180")} />
                    </>
                  )}
                </button>
              )}

              {isOpen && (
                <ul className="mt-0.5 space-y-px">
                  {module.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isItemActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "relative flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-[13px] font-medium transition-colors",
                            isActive
                              ? "bg-[#F5F3FF] text-[#6C3BFF]"
                              : "text-[#3F3F46] hover:bg-[#F4F4F5] hover:text-[#18181B]",
                            collapsed && "justify-center px-0"
                          )}
                          title={collapsed ? item.label : undefined}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.badge ? (
                                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-[#F4F4F5] px-1 text-[10px] font-medium text-[#71717A]">
                                  {item.badge}
                                </span>
                              ) : null}
                            </>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[#E4E4E7] p-2">
        <button
          onClick={() => setLogoutOpen(true)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-[13px] font-medium text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#18181B]",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
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
            <Button
              variant="danger"
              onClick={() => { setLogoutOpen(false); logout(); fetch("/api/logout", { method: "POST" }).finally(() => { router.push("/login"); router.refresh(); }); }}
            >
              Logout
            </Button>
          </div>
        </div>
      </Dialog>
    </aside>
  );
}
