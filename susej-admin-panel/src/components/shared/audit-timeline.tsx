"use client";

import { CheckCircle, XCircle, FileQuestion, ShieldCheck, MessageSquare } from "lucide-react";
import type { SellerAuditLog } from "@/types";
import { formatDate } from "@/lib/utils";

interface AuditTimelineProps {
  logs: SellerAuditLog[];
}

const actionConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  approved: { icon: CheckCircle, color: "text-[#16A34A]", bg: "bg-[#16A34A]/10" },
  rejected: { icon: XCircle, color: "text-[#EF4444]", bg: "bg-[#EF4444]/10" },
  requested_documents: { icon: FileQuestion, color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
  document_verified: { icon: ShieldCheck, color: "text-[#6C3BFF]", bg: "bg-[#6C3BFF]/10" },
  note_added: { icon: MessageSquare, color: "text-[#2563EB]", bg: "bg-[#2563EB]/10" },
};

export function AuditTimeline({ logs }: AuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-gray-500">No audit history available.</p>
      </div>
    );
  }

  const sorted = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-0">
      {sorted.map((log, i) => {
        const config = actionConfig[log.action] || actionConfig.note_added;
        const Icon = config.icon;
        const isLast = i === sorted.length - 1;

        return (
          <div key={log.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.bg}`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              {!isLast && <div className="mt-1 w-px flex-1 bg-[#E4E4E7] " />}
            </div>
            <div className="flex-1 pb-6">
              <p className="text-sm font-medium text-[#18181B] ">
                {log.action === "approved" && "Seller Approved"}
                {log.action === "rejected" && "Seller Rejected"}
                {log.action === "requested_documents" && "Documents Requested"}
                {log.action === "document_verified" && "Document Verified"}
                {log.action === "note_added" && "Note Added"}
              </p>
              {log.note && <p className="mt-0.5 text-sm text-gray-500">{log.note}</p>}
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                <span>{log.adminName}</span>
                <span>Â·</span>
                <span>{formatDate(log.timestamp)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
