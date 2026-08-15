"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { AlertTriangle, ImageIcon, Link2, Upload, X } from "lucide-react";

const MAX_SIZE_MB = 10;
const URL_PATTERN = /^(https?:\/\/|data:image\/)/i;

const modeButton = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
    on
      ? "bg-[#6C3BFF] text-white"
      : "border border-[#E4E4E7] text-gray-500 hover:bg-gray-50 "
  }`;

interface ImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function ImageUpload({ value, onChange, label }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "url" | null>(() =>
    value ? (value.startsWith("data:") ? "upload" : "url") : null
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    setLoadFailed(false);
    setUrlError("");
  }, [value]);

  const decodeCheck = (dataUrl: string) => {
    const probe = new Image();
    return new Promise<boolean>((resolve) => {
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = dataUrl;
    });
  };

  const resizeImage = async (dataUrl: string, mime: string): Promise<string> => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => resolve(probe);
      probe.onerror = () => reject(new Error("decode"));
      probe.src = dataUrl;
    });
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale === 1 && mime === "image/png") return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(mime === "image/png" ? "image/png" : "image/jpeg", 0.85);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(
        `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is ${MAX_SIZE_MB} MB.`
      );
      return;
    }
    setFileError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result);
        if (!(await decodeCheck(dataUrl))) {
          setFileError("This file couldn't be processed as an image. Try a JPG, PNG or WebP file.");
          return;
        }
        const resized = await resizeImage(dataUrl, file.type || "image/jpeg");
        setFileError("");
        onChange(resized);
        setMode("upload");
      } catch {
        setFileError("This file couldn't be processed as an image. Try a JPG, PNG or WebP file.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed && !URL_PATTERN.test(trimmed)) {
      setUrlError("URL must start with http(s):// or be a data: image.");
    } else {
      setUrlError("");
    }
    onChange(trimmed);
  };

  const remove = () => {
    setConfirmOpen(false);
    onChange("");
    setMode(null);
  };

  return (
    <div>
      <div className="flex gap-2">
        <button type="button" className={modeButton(mode === "upload")} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Upload image
        </button>
        <button type="button" className={modeButton(mode === "url")} onClick={() => setMode("url")}>
          <Link2 className="h-4 w-4" /> Paste URL
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFile(e)} />
      </div>

      {fileError && <p className="mt-1.5 text-xs text-[#EF4444]">{fileError}</p>}

      {mode === "url" && (
        <>
          <Input
            className="mt-2"
            value={value.startsWith("data:") ? "" : value}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
          {urlError && <p className="mt-1 text-xs text-[#EF4444]">{urlError}</p>}
        </>
      )}

      {value ? (
        <div className="mt-3">
          <div className="relative overflow-hidden rounded-2xl border border-[#E4E4E7]">
            <img
              src={value}
              alt={label ?? "image preview"}
              onError={() => setLoadFailed(true)}
              className="h-48 w-full object-cover"
            />
            {loadFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#FAFAFA] ">
                <AlertTriangle className="h-6 w-6 text-[#EF4444]" />
                <p className="px-4 text-center text-sm text-gray-500">
                  Couldn&apos;t load this image. The URL may be invalid or blocked â€” upload the file instead.
                </p>
              </div>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
              <X className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex h-40 items-center justify-center rounded-2xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] ">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <ImageIcon className="h-4 w-4" /> No image selected
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Remove image?">
        <p className="text-sm text-gray-500">
          This {label ?? "image"} will be removed from the item. You can upload another one anytime.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove}>
            Remove
          </Button>
        </div>
      </Dialog>
    </div>
  );
}