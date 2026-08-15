"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload, X, ImageIcon } from "lucide-react";
import type { Category } from "@/types";

interface CategoryFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Category>) => void;
  editCategory?: Category | null;
  categories: Category[];
}

export function CategoryForm({ open, onClose, onSave, editCategory, categories }: CategoryFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [bannerMode, setBannerMode] = useState<"upload" | "url" | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerFile, setBannerFile] = useState<string>("");
  const [bannerPreviewFailed, setBannerPreviewFailed] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [active, setActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name);
      setDescription(editCategory.description);
      setParentId(editCategory.parentId || "");
      setActive(editCategory.status === "active");
      setFeatured(editCategory.featured);
      if (editCategory.bannerImage) {
        setBannerMode(editCategory.bannerImage.startsWith("http") ? "url" : "upload");
        if (editCategory.bannerImage.startsWith("http")) {
          setBannerUrl(editCategory.bannerImage);
        } else {
          setBannerFile(editCategory.bannerImage);
        }
      } else {
        setBannerMode(null);
      }
    } else {
      setName("");
      setDescription("");
      setParentId("");
      setBannerMode(null);
      setBannerUrl("");
      setBannerFile("");
      setBannerPreviewFailed(false);
      setActive(true);
      setFeatured(false);
    }
  }, [editCategory, open]);

  const parentOptions = categories
    .filter((c) => c.id !== editCategory?.id)
    .map((c) => ({ label: c.name, value: c.id }));

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setBannerError(`Image is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is 10 MB.`);
      return;
    }
    setBannerError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const probe = new Image();
          probe.onload = () => resolve(probe);
          probe.onerror = () => reject(new Error("decode"));
          probe.src = dataUrl;
        });
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = scale === 1 ? img.width : Math.round(img.width * scale);
        canvas.height = scale === 1 ? img.height : Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (!blob) {
              setBannerError("This file couldn't be processed as an image.");
              return;
            }
            const resized = new FileReader();
            resized.onload = () => {
              setBannerError("");
              setBannerFile(String(resized.result));
              setBannerMode("upload");
            };
            resized.readAsDataURL(blob);
          }, file.type === "image/png" ? "image/png" : "image/jpeg", 0.85);
        } else {
          setBannerFile(dataUrl);
          setBannerMode("upload");
        }
      } catch {
        setBannerError("This file couldn't be processed as an image. Try a JPG, PNG or WebP file.");
      }
    };
    reader.readAsDataURL(file);
  }

  function removeBanner() {
    setBannerMode(null);
    setBannerUrl("");
    setBannerFile("");
    setBannerError("");
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  }

  function getBannerValue(): string {
    if (!bannerMode) return "";
    if (bannerMode === "url") return bannerUrl;
    return bannerFile;
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      description,
      parentId: parentId || null,
      icon: "ðŸ“",
      bannerImage: getBannerValue(),
      status: active ? "active" : "hidden",
      featured,
    });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editCategory ? "Edit Category" : "Create Category"} className="max-w-lg">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <div>
          <Label>Category Name <span className="text-[#EF4444]">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electronics" />
        </div>

        <div>
          <Label>Description</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-20 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-4 text-sm outline-none focus:border-[#6C3BFF]  "
            placeholder="Describe this category..."
          />
        </div>

        <div>
          <Label>Parent Category</Label>
          <Select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            options={[{ label: "None (Top Level)", value: "" }, ...parentOptions]}
          />
        </div>

        <div className="border-t border-[#E4E4E7] pt-4 ">
          <p className="mb-3 text-sm font-medium text-[#18181B] ">Banner</p>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${bannerMode === "upload" ? "bg-[#6C3BFF] text-white" : "border border-[#E4E4E7] text-gray-500 hover:bg-gray-50 "}`}
              onClick={() => bannerInputRef.current?.click()}
            >
              Upload Image
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${bannerMode === "url" ? "bg-[#6C3BFF] text-white" : "border border-[#E4E4E7] text-gray-500 hover:bg-gray-50 "}`}
              onClick={() => setBannerMode("url")}
            >
              Paste URL
            </button>
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
          </div>

          {bannerError && <p className="mb-3 text-xs text-[#EF4444]">{bannerError}</p>}

          {bannerMode === "url" && (
            <>
              <Input
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value.trim())}
                placeholder="https://example.com/banner.jpg"
              />
              {bannerUrl && !/^(https?:\/\/|data:image\/)/i.test(bannerUrl) && (
                <p className="mt-1 text-xs text-[#EF4444]">URL must start with http(s):// or be a data: image.</p>
              )}
            </>
          )}

          {bannerMode && (bannerFile || bannerUrl) && (
            <div className="relative mt-3">
              <img
                src={bannerMode === "url" ? bannerUrl : bannerFile}
                alt="banner preview"
                className="h-24 w-full rounded-xl border border-[#E4E4E7] object-cover"
                onError={() => setBannerPreviewFailed(true)}
                onLoad={() => setBannerPreviewFailed(false)}
              />
              {bannerPreviewFailed && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#FAFAFA] ">
                  <p className="px-4 text-center text-sm text-gray-500">
                    Couldn&apos;t load this image. The URL may be invalid or blocked.
                  </p>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => bannerMode === "url" ? bannerInputRef.current?.click() : setBannerUrl("")}>
                  <Upload className="h-3.5 w-3.5" /> Replace
                </Button>
                <Button variant="ghost" size="sm" onClick={removeBanner}>
                  <X className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </div>
          )}

          {!bannerMode && (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#FAFAFA] ">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <ImageIcon className="h-4 w-4" />
                No banner selected
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-[#E4E4E7] pt-4 ">
          <div className="flex items-center justify-between rounded-xl border border-[#E4E4E7] px-4 py-3 ">
            <div>
              <p className="text-sm font-medium text-[#18181B] ">Active</p>
              <p className="text-xs text-gray-500">Category is visible on the marketplace</p>
            </div>
            <Switch checked={active} onChange={setActive} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#E4E4E7] px-4 py-3 ">
            <div>
              <p className="text-sm font-medium text-[#18181B] ">Featured</p>
              <p className="text-xs text-gray-500">Show on homepage and featured sections</p>
            </div>
            <Switch checked={featured} onChange={setFeatured} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {editCategory ? "Save Changes" : "Create Category"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
