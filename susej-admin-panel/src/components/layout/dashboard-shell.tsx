"use client";

import { useState } from "react";
import { DesktopGuard } from "@/components/layout/desktop-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { CommandPalette } from "@/components/layout/command-palette";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <DesktopGuard>
      <div className="flex h-screen overflow-hidden bg-[#FAFAFA]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Navbar onOpenSearch={() => setSearchOpen(true)} />
          <main className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mb-4">
              <PageBreadcrumbs />
            </div>
            {children}
          </main>
          <Footer />
        </div>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </DesktopGuard>
  );
}