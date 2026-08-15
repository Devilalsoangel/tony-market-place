"use client";

import { Dialog } from "@/components/ui/dialog";
import { ItemFormPage } from "./item-form";
import type { SectionKind } from "./section-config";

interface ItemFormDialogProps {
  kind: SectionKind;
  editingId?: string;
  onClose: () => void;
}

export function ItemFormDialog({ kind, editingId, onClose }: ItemFormDialogProps) {
  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <ItemFormPage kind={kind} editingId={editingId} onClose={onClose} />
      </div>
    </Dialog>
  );
}