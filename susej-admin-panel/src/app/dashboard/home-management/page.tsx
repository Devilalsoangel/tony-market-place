"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";
import { SectionTabCard } from "@/home-management/components/section-tab-card";
import { ItemFormDialog } from "@/home-management/components/item-form-dialog";
import { SECTION_CONFIG, type SectionKind } from "@/home-management/components/section-config";

const tabs = Object.entries(SECTION_CONFIG).map(([value]) => ({
  label: SECTION_CONFIG[value as SectionKind].title,
  value,
}));

function HomeManagement() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("section") as SectionKind | null;
  const valid = requested && requested in SECTION_CONFIG ? requested : "hero-banners";
  const [editor, setEditor] = useState<{ kind: SectionKind; editingId?: string } | null>(null);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#18181B] ">Home Management</h1>
      <p className="mt-1 text-sm text-gray-500">
        Control what appears on your mobile app&apos;s home screen. Pick a section to add, edit, hide
        or delete items.
      </p>
      <div className="mt-6">
        <Tabs
          tabs={tabs}
          defaultTab={valid}
          onChange={(v) => router.replace(`/dashboard/home-management?section=${v}`, { scroll: false })}
        >
          {(active) => (
            <SectionTabCard
              kind={active as SectionKind}
              onAdd={(kind) => setEditor({ kind })}
              onEdit={(kind, editingId) => setEditor({ kind, editingId })}
            />
          )}
        </Tabs>
      </div>
      {editor && (
        <ItemFormDialog
          kind={editor.kind}
          editingId={editor.editingId}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

export default function HomeManagementPage() {
  return (
    <Suspense fallback={null}>
      <HomeManagement />
    </Suspense>
  );
}