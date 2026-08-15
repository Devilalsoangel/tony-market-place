"use client";
import { useParams } from "next/navigation";
import { ItemFormPage } from "./item-form";
import { SECTION_CONFIG, type SectionKind } from "./section-config";

export function ItemFormRoute({ mode }: { mode: "new" | "edit" }) {
  const params = useParams();
  const kind = String(params.kind);
  if (!(kind in SECTION_CONFIG)) {
    return (
      <div className="mx-auto max-w-2xl rounded-[20px] border border-[#E4E4E7] bg-white p-8 text-center ">
        <h1 className="text-lg font-bold text-[#18181B] ">Section not found</h1>
        <p className="mt-1 text-sm text-gray-500">That section does not exist.</p>
      </div>
    );
  }
  const editingId = mode === "edit" ? String(params.id) : undefined;
  return <ItemFormPage kind={kind as SectionKind} editingId={editingId} />;
}