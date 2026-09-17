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
  // Paid rails are visibility-only: items are promo-engine-owned (Promotions
  // desk). A direct URL here must not render a stub form that toasts success
  // while saving nothing.
  if (SECTION_CONFIG[kind as SectionKind]?.visibilityOnly) {
    return (
      <div className="mx-auto max-w-2xl rounded-[20px] border border-[#E4E4E7] bg-white p-8 text-center ">
        <h1 className="text-lg font-bold text-[#18181B] ">Managed in Promotions</h1>
        <p className="mt-1 text-sm text-gray-500">Paid placements are created by the promotions engine — this rail only has a visibility switch.</p>
      </div>
    );
  }
  return <ItemFormPage kind={kind as SectionKind} editingId={editingId} />;
}