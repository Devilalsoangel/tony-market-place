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
  // Files uploaded to local disk die with the next server redeploy (only
  // Cloudinary URLs survive). A dead URL must say so plainly — with the fix
  // (Request Documents on the seller page) — never a broken-image icon.
  const [loadFailed, setLoadFailed] = useState(false);

  if (!doc) return null;

  const handleDownload = async () => {
    if (!doc.url) return;
    try {
      const res = await fetch(doc.url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const a = window.document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = doc.fileName || "document";
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      // Direct fetch failed (cross-origin etc.) - fall back to opening the file.
      window.open(doc.url, "_blank");
    }
  };

  const hasFile = Boolean(doc.url);
  // Preview the actual file (industry: reviewers verify pixels, not
  // filenames). Images render inline; PDFs embed; anything else keeps the
  // neutral placeholder with download/open fallbacks.
  const src = String(doc.url ?? "");
  const isImage = /\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(src);
  const isPdf = /\.pdf(\?|#|$)/i.test(src);

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
            <Button variant="ghost" size="sm" onClick={handleDownload} disabled={!hasFile} title={hasFile ? "Download document" : "No file attached"}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center overflow-auto rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 " style={{ minHeight: 400, maxHeight: 560 }}>
          {isImage && !loadFailed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={src}
              alt={doc.label}
              onError={() => setLoadFailed(true)}
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center", maxWidth: "100%" }}
              className="rounded-lg object-contain"
            />
          ) : loadFailed ? (
            <div className="flex max-w-md flex-col items-center gap-2 py-10 text-center">
              <FileText className="h-12 w-12 text-gray-300" />
              <p className="text-sm font-medium text-[#18181B] ">File unavailable</p>
              <p className="text-xs text-gray-500">
                {doc.fileName} can no longer be loaded — files stored on the server disk are lost on redeploy.
                Close this and use Request Documents to ask the seller to re-upload.
              </p>
            </div>
          ) : isPdf ? (
            <iframe src={src} title={doc.label} className="h-[520px] w-full rounded-lg bg-white" />
          ) : (
            <div
              className="flex items-center justify-center"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}
            >
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <FileText className="h-16 w-16" />
                <span className="text-sm">{doc.fileName}</span>
                {hasFile && (
                  <a href={src} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#6C3BFF] hover:underline">
                    Open original
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[#FAFAFA] px-4 py-3 text-sm ">
          <span className="text-gray-500">Uploaded {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Unknown'}</span>
          <span className={doc.verified ? "text-[#16A34A]" : "text-[#F59E0B]"}>
            {doc.verified ? "Verified" : "Pending Verification"}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
