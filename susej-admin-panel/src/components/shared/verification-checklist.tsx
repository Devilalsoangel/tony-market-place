"use client";

import { CheckCircle2, XCircle, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { SellerDocument } from "@/types";

interface ChecklistItem {
  label: string;
  type: SellerDocument["type"];
  uploaded: boolean;
  verified: boolean;
}

interface VerificationChecklistProps {
  documents: SellerDocument[];
}

const REQUIRED_DOCS: { label: string; type: SellerDocument["type"] }[] = [
  { label: "Government ID", type: "government_id" },
  { label: "Business License", type: "business_license" },
  { label: "Address Proof", type: "address_proof" },
  { label: "GST Certificate", type: "gst_certificate" },
  { label: "Store Logo", type: "store_logo" },
];

export function VerificationChecklist({ documents }: VerificationChecklistProps) {
  const items: ChecklistItem[] = REQUIRED_DOCS.map((req) => {
    const doc = documents.find((d) => d.type === req.type);
    return {
      label: req.label,
      type: req.type,
      uploaded: !!doc,
      verified: doc?.verified ?? false,
    };
  });

  const completed = items.filter((i) => i.verified).length;
  const total = items.length;
  const progress = Math.round((completed / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#18181B] ">Verification Checklist</span>
        <span className="text-sm text-gray-500">{completed}/{total} Complete</span>
      </div>
      <Progress value={progress} variant={progress === 100 ? "success" : "warning"} />
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.type} className="flex items-center gap-3 rounded-xl bg-[#FAFAFA] px-4 py-3 ">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ">
              {item.verified ? (
                <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
              ) : item.uploaded ? (
                <FileText className="h-5 w-5 text-[#F59E0B]" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#18181B] ">{item.label}</p>
              <p className="text-xs text-gray-500">
                {item.verified ? "Verified" : item.uploaded ? "Pending Verification" : "Not Uploaded"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
