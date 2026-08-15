"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, FileText } from "lucide-react";
import type { SellerDocument } from "@/types";

interface DocumentViewerProps {
  document: SellerDocument | null;
  open: boolean;
  onClose: () => void;
}

export function DocumentViewer({ document: doc, open, onClose }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100);

  if (!doc) return null;

  return (
    <Dialog open={open} onClose={onClose} className="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#18181B] ">{doc.label}</h3>
            <p className="text-sm text-gray-500">{doc.fileName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{zoom}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(50, zoom - 25))} disabled={zoom <= 50}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(200, zoom + 25))} disabled={zoom >= 200}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 " style={{ minHeight: 400 }}>
          <div
            className="flex items-center justify-center"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}
          >
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <FileText className="h-16 w-16" />
              <span className="text-sm">{doc.fileName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[#FAFAFA] px-4 py-3 text-sm ">
          <span className="text-gray-500">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
          <span className={doc.verified ? "text-[#16A34A]" : "text-[#F59E0B]"}>
            {doc.verified ? "Verified" : "Pending Verification"}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
