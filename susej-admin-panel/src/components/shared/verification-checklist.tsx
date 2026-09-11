"use client";

import { CheckCircle2, XCircle, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Seller, SellerDocument } from "@/types";

interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  uploaded: boolean;
  verified: boolean;
}

interface VerificationChecklistProps {
  documents: SellerDocument[];
  seller?: Pick<Seller, "taxId" | "logo" | "idType"> | null;
}

// Industry pattern (Meesho/Amazon seller onboarding): required evidence
// depends on seller TYPE. Individuals verify with Govt ID (front+back) +
// selfie; GST certificate + store logo apply to business sellers only.
// The old static 5-row list (incl. Business License, which the app never
// sends) left every individual seller permanently "0/5 — Not Uploaded".
export function VerificationChecklist({ documents, seller }: VerificationChecklistProps) {
  const taxId = String(seller?.taxId ?? "").trim();
  const isBusiness =
    documents.some((d) => d.type === "gst_certificate") || (taxId !== "" && taxId !== "PENDING-KYC");
  const front = documents.find((d) => d.type === "government_id") ?? null;
  const back = documents.find((d) => d.type === "government_id_back") ?? null;
  // No standalone address file when the seller used Aadhaar as address (the
  // wizard reuses the Aadhaar scans) — front+back then covers this row.
  const addrDoc = documents.find((d) => d.type === "address_proof") ?? null;
  const selfie = documents.find((d) => d.type === "additional" && /selfie/i.test(d.label)) ?? null;
  const gst = documents.find((d) => d.type === "gst_certificate") ?? null;
  const hasLogo = String(seller?.logo ?? "").trim() !== "";

  const items: ChecklistItem[] = [
    { key: "govt", label: "Government ID", hint: "Front scan", uploaded: !!front, verified: front?.verified ?? false },
    { key: "govt-back", label: "ID Back", hint: "Back scan", uploaded: !!back, verified: back?.verified ?? false },
    {
      key: "address",
      label: "Address Proof",
      hint: addrDoc ? "Separate file" : "Covered by Aadhaar scans",
      uploaded: !!addrDoc || (!!front && !!back),
      verified: addrDoc ? (addrDoc.verified ?? false) : ((front?.verified && back?.verified) ?? false),
    },
    { key: "selfie", label: "Selfie with ID", hint: "Face match", uploaded: !!selfie, verified: selfie?.verified ?? false },
  ];
  if (isBusiness) {
    items.push({
      key: "gst",
      label: "GST Certificate",
      hint: "Business sellers",
      uploaded: !!gst,
      verified: gst?.verified ?? false,
    });
    // A logo is branding, not KYC — complete on upload, no verification step.
    items.push({
      key: "logo",
      label: "Store Logo",
      hint: "Business sellers",
      uploaded: hasLogo,
      verified: hasLogo,
    });
  }

  const completed = items.filter((i) => i.verified).length;
  const total = items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#18181B] ">Verification Checklist</span>
        <span className="text-sm text-gray-500">{completed}/{total} Complete</span>
      </div>
      <Progress value={progress} variant={progress === 100 ? "success" : "warning"} />
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3 rounded-xl bg-[#FAFAFA] px-4 py-3 ">
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
                {item.verified ? "Verified" : item.uploaded ? "Pending Verification" : `Not Uploaded · ${item.hint}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
