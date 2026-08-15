"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "@/components/ui/toast";
import { useHomeManagement } from "@/home-management/context";
import { SECTION_CONFIG, type SectionKind } from "./section-config";
import { Copy, Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import type {
  FeaturedCategory,
  FeaturedPost,
  HeroBanner,
  HotDeal,
  TopSeller,
} from "@/types/home-management";

type AnyItem = HeroBanner | FeaturedCategory | TopSeller | HotDeal | FeaturedPost;

const ID_PREFIX: Record<SectionKind, string> = {
  "hero-banners": "hb",
  "featured-categories": "fc",
  "top-sellers": "ts",
  "hot-deals": "hd",
  "featured-posts": "fp",
};

function itemTitle(kind: SectionKind, item: AnyItem): string {
  switch (kind) {
    case "hero-banners":
      return (item as HeroBanner).title;
    case "featured-categories":
      return (item as FeaturedCategory).categoryName;
    case "top-sellers":
      return (item as TopSeller).sellerName;
    case "hot-deals":
      return (item as HotDeal).productName;
    case "featured-posts":
      return (item as FeaturedPost).title;
  }
}

function itemSubtitle(kind: SectionKind, item: AnyItem): string {
  switch (kind) {
    case "hero-banners":
      return (item as HeroBanner).subtitle;
    case "featured-categories":
      return `Position ${(item as FeaturedCategory).position}`;
    case "top-sellers":
      return `â˜… ${(item as TopSeller).rating.toFixed(1)} Â· ${(item as TopSeller).totalSales.toLocaleString()} sales`;
    case "hot-deals":
      return `$${(item as HotDeal).discountedPrice.toFixed(2)} Â· ${(item as HotDeal).discountPercentage}% off`;
    case "featured-posts": {
      const post = item as FeaturedPost;
      const span =
        post.startDate || post.endDate
          ? ` Â· ${post.startDate || "anytime"} â†’ ${post.endDate || "open"}`
          : "";
      return `${post.excerpt}${span}`;
    }
  }
}

export function SectionTabCard({
  kind,
  onAdd,
  onEdit,
}: {
  kind: SectionKind;
  onAdd: (kind: SectionKind) => void;
  onEdit: (kind: SectionKind, id: string) => void;
}) {
  const { state, actions } = useHomeManagement();
  const config = SECTION_CONFIG[kind];
  const [confirm, setConfirm] = useState<{ action: "delete" | "duplicate"; item: AnyItem } | null>(null);

  const items: AnyItem[] =
    kind === "hero-banners"
      ? state.heroBanners
      : kind === "featured-categories"
        ? state.featuredCategories
        : kind === "top-sellers"
          ? state.topSellers
          : kind === "hot-deals"
            ? state.hotDeals
            : state.featuredPosts;

  const atLimit = config.max !== undefined && items.length >= config.max;
  const section = state.layout.find((s) => s.name === kind);
  const sectionEnabled = section?.isEnabled ?? true;

  const toggleVisibility = async (item: AnyItem) => {
    const status = (item as { status: string }).status;
    const next = status === "active" ? "inactive" : "active";
    switch (kind) {
      case "hero-banners":
        await actions.updateHeroBanner(item.id, { status: next as HeroBanner["status"] });
        break;
      case "featured-categories":
        await actions.updateFeaturedCategory(item.id, { status: next as FeaturedCategory["status"] });
        break;
      case "top-sellers":
        await actions.updateTopSeller(item.id, { status: next as TopSeller["status"] });
        break;
      case "hot-deals":
        await actions.updateHotDeal(item.id, { status: next as HotDeal["status"] });
        break;
      case "featured-posts":
        await actions.updateFeaturedPost(item.id, { status: next as FeaturedPost["status"] });
        break;
    }
  };

  const duplicateItem = async (item: AnyItem) => {
    if (atLimit) {
      toast.error(config.maxMessage ?? `Maximum ${config.max} reached.`);
      return;
    }
    const copy: AnyItem = {
      ...item,
      id: `${ID_PREFIX[kind]}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if ("title" in copy) {
      (copy as HeroBanner | FeaturedPost).title = `${(copy as HeroBanner | FeaturedPost).title} (Copy)`;
    } else if ("categoryName" in copy) {
      (copy as FeaturedCategory).categoryName = `${(copy as FeaturedCategory).categoryName} (Copy)`;
    } else if ("sellerName" in copy) {
      (copy as TopSeller).sellerName = `${(copy as TopSeller).sellerName} (Copy)`;
    } else if ("productName" in copy) {
      (copy as HotDeal).productName = `${(copy as HotDeal).productName} (Copy)`;
    }
    switch (kind) {
      case "hero-banners":
        await actions.addHeroBanner(copy as HeroBanner);
        break;
      case "featured-categories":
        await actions.addFeaturedCategory(copy as FeaturedCategory);
        break;
      case "top-sellers":
        await actions.addTopSeller(copy as TopSeller);
        break;
      case "hot-deals":
        await actions.addHotDeal(copy as HotDeal);
        break;
      case "featured-posts":
        await actions.addFeaturedPost(copy as FeaturedPost);
        break;
    }
  };

  const removeItem = async (id: string) => {
    switch (kind) {
      case "hero-banners":
        await actions.deleteHeroBanner(id);
        break;
      case "featured-categories":
        await actions.deleteFeaturedCategory(id);
        break;
      case "top-sellers":
        await actions.deleteTopSeller(id);
        break;
      case "hot-deals":
        await actions.deleteHotDeal(id);
        break;
      case "featured-posts":
        await actions.deleteFeaturedPost(id);
        break;
    }
    setConfirm(null);
  };

  return (
    <>
      <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>
          {config.title} ({items.length})
          {atLimit && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              Â· {config.maxMessage}
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Show on home page</span>
            <Switch
              checked={sectionEnabled}
              onChange={(v) => void actions.updateLayoutItem(section!.id, { isEnabled: v })}
            />
          </div>
          <Button
            onClick={() => onAdd(kind)}
            disabled={atLimit}
            className={atLimit ? "opacity-60" : ""}
            title={atLimit ? config.maxMessage : undefined}
          >
            <Plus className="h-4 w-4" />
            Add {config.singular}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-gray-500">No {config.title.toLowerCase()} yet.</p>
            <Button
              variant="outline"
              className="mt-3"
              disabled={atLimit}
              onClick={() => onAdd(kind)}
            >
              <Plus className="h-4 w-4" /> Add {config.singular}
            </Button>
            {atLimit && <p className="mt-2 text-xs text-gray-400">{config.maxMessage}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const status = (item as { status: string }).status;
              const visible = status === "active";
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-[#E4E4E7] px-5 py-4 transition-colors hover:bg-gray-50  "
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#6C3BFF]/10">
                      {"imageUrl" in item && (item as { imageUrl?: string }).imageUrl ? (
                        <img
                          src={String((item as { imageUrl?: string }).imageUrl)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : "productImage" in item && (item as HotDeal).productImage ? (
                        <img
                          src={(item as HotDeal).productImage}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : "sellerLogo" in item && (item as TopSeller).sellerLogo ? (
                        <img
                          src={(item as TopSeller).sellerLogo}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-[#6C3BFF]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#18181B] ">
                        {itemTitle(kind, item)}
                      </p>
                      <p className="truncate text-sm text-gray-500">{itemSubtitle(kind, item)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <StatusBadge status={status} />
                    <div className="flex items-center gap-2">
                      <span className="hidden text-xs text-gray-400 sm:inline">
                        {visible ? "Visible" : "Hidden"}
                      </span>
                      <Switch checked={visible} onChange={() => void toggleVisibility(item)} />
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setConfirm({ action: "duplicate", item })}
                        disabled={atLimit}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-[#6C3BFF] disabled:opacity-40 disabled:hover:text-gray-400"
                        title={atLimit ? "Maximum reached" : "Duplicate"}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirm({ action: "delete", item })}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => onEdit(kind, item.id)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      </Card>
      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.action === "duplicate" ? "Duplicate item?" : "Delete item?"}
      >
        <p className="text-sm text-gray-500">
          {confirm?.action === "duplicate" ? (
            <>
              Duplicate{" "}
              <span className="font-semibold text-[#18181B] ">
                {confirm ? itemTitle(kind, confirm.item) : ""}
              </span>{" "}
              and add it as a new copy?
            </>
          ) : (
            <>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-[#18181B] ">
                {confirm ? itemTitle(kind, confirm.item) : ""}
              </span>
              ? This action cannot be undone.
            </>
          )}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant={confirm?.action === "duplicate" ? "primary" : "danger"}
            onClick={() => {
              if (!confirm) return;
              setConfirm(null);
              if (confirm.action === "delete") void removeItem(confirm.item.id);
              else void duplicateItem(confirm.item);
            }}
          >
            {confirm?.action === "duplicate" ? "Duplicate" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}