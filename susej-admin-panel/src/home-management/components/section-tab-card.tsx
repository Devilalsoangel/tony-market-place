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
import { Copy, Image as ImageIcon, Pencil, Plus, Trash2, Bot } from "lucide-react";
import type {
  HotDeal,
  StorefrontBanner,
  TopSeller,
} from "@/types/home-management";

type AnyItem = TopSeller | HotDeal | StorefrontBanner;

const ID_PREFIX: Record<SectionKind, string> = {
  "top-sellers": "ts",
  "hot-deals": "hd",
  "storefront-banners": "sb",
  "featured-posts": "fp",
  "spotlight": "sl",
};

function itemTitle(kind: SectionKind, item: AnyItem): string {
  switch (kind) {
    case "top-sellers":
      return (item as TopSeller).sellerName;
    case "hot-deals":
      return (item as HotDeal).productName;
    case "storefront-banners":
      return (item as StorefrontBanner).title;
    default:
      return "";
  }
}

function itemSubtitle(kind: SectionKind, item: AnyItem): string {
  switch (kind) {
    case "top-sellers":
      return `\u2605 ${(item as TopSeller).rating.toFixed(1)} \u00b7 ${(item as TopSeller).totalSales.toLocaleString()} sales`;
    case "hot-deals": {
      // Expiry honesty: a past endDate with status still active means the
      // serve guard hides the rail while the desk claims Active — surface it.
      const deal = item as HotDeal;
      const base = `\u20b9${deal.discountedPrice.toFixed(2)} \u00b7 ${deal.discountPercentage}% off`;
      const t = Date.parse(deal.endDate ?? "");
      if (!deal.endDate || Number.isNaN(t)) return base;
      const left = Math.ceil((t - Date.now()) / 86400000);
      return left < 0 ? `${base} \u00b7 expired` : `${base} \u00b7 ends in ${left}d`;
    }
    case "storefront-banners": {
      const banner = item as StorefrontBanner;
      return `by @${banner.sellerUsername}${banner.subtitle ? ` \u00b7 ${banner.subtitle}` : ""}`;
    }
    default:
      return "";
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
  if (!config) return null;
  const [confirm, setConfirm] = useState<{ action: "delete" | "duplicate"; item: AnyItem } | null>(null);

  const isAutoComputed = config.autoCompute === true;
  const isSyncFromApp = config.syncFromApp === true;
  const isVisibilityOnly = config.visibilityOnly === true;

  const items: AnyItem[] =
    kind === "top-sellers"
      ? state.topSellers
      : kind === "hot-deals"
        ? state.hotDeals
        : kind === "storefront-banners"
          ? state.storefrontBanners
          : [];

  const atLimit = config.max !== undefined && items.length >= config.max;
  const section = state.layout.find((s) => s.name === kind);
  // Missing row means ON (fresh prod renders every rail) — the toggle always
  // works: flipping a missing section CREATES the row in the chosen state.
  const sectionEnabled = section?.isEnabled ?? true;
  const sectionMissing = !section;
  // A failed initial fetch is NOT an empty section: show Retry, never a
  // lying "No items yet" (cold serverless drops parallel fetches).
  // Spotlight is layout-driven (no item resource) — its load flag is home-sections.
  const failedResource = kind === "spotlight" ? "home-sections" : kind;
  const loadFailed = state.loadFailed.includes(failedResource);

  // Paid rails (promo-engine items): visibility kill-switch only. Item
  // management lives in Promotions — this desk hides/shows the rail.
  if (isVisibilityOnly) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{config.title}</CardTitle>
          <div
            className={`flex items-center gap-2 ${sectionMissing ? "opacity-70" : ""}`}
            title={sectionMissing ? "Missing section renders ON — flipping creates it" : undefined}
          >
            <span className="text-xs text-gray-400">Show on home page</span>
            <Switch
              checked={sectionEnabled}
              onChange={(v) => {
                if (!section) {
                  void actions.createLayoutItem(kind, config.title, v).then((created) => {
                    if (!created) toast.error("Could not create section — check connection.");
                  });
                  return;
                }
                void actions.updateLayoutItem(section.id, { isEnabled: v });
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Paid placements from the promotions engine render on the home screen while this is on.
            Items are managed in Promotions — this switch is the kill-switch for wrong or fraudulent placements.
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleVisibility = async (item: AnyItem) => {
    const status = (item as { status: string }).status;
    const next = status === "active" ? "inactive" : "active";
    switch (kind) {
      case "top-sellers":
        await actions.updateTopSeller(item.id, { status: next as TopSeller["status"] });
        break;
      case "hot-deals":
        await actions.updateHotDeal(item.id, { status: next as HotDeal["status"] });
        break;
      case "storefront-banners":
        await actions.updateStorefrontBanner(item.id, { status: next as StorefrontBanner["status"] });
        break;
    }
  };

  const duplicateItem = async (item: AnyItem) => {
    // Auto-computed rails (top-sellers, hot-deals) are server-resolved by
    // sellerId/productId — cloning one mints a fake "X (Copy)" identity that
    // serves REAL stats under a fabricated name (intelligence-guard
    // violation). Refuse; admin edits the original or re-ranks instead.
    if (config.autoCompute) {
      toast.error("This rail is auto-computed — edit the original instead of duplicating.");
      return;
    }
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
    if ("sellerName" in copy) {
      (copy as TopSeller).sellerName = `${(copy as TopSeller).sellerName} (Copy)`;
    } else if ("productName" in copy) {
      (copy as HotDeal).productName = `${(copy as HotDeal).productName} (Copy)`;
    } else if ("title" in copy) {
      (copy as StorefrontBanner).title = `${(copy as StorefrontBanner).title} (Copy)`;
    }
    switch (kind) {
      case "top-sellers":
        await actions.addTopSeller(copy as TopSeller);
        break;
      case "hot-deals":
        await actions.addHotDeal(copy as HotDeal);
        break;
      default:
        // Sync-from-app sections (banners) have no add path by design — the
        // Duplicate button is already hidden for them, but never silent-noop
        // if a future caller reaches here.
        toast.error("Duplicating isn't available for this section.");
        return;
    }
  };

  const removeItem = async (id: string) => {
    switch (kind) {
      case "top-sellers":
        await actions.deleteTopSeller(id);
        break;
      case "hot-deals":
        await actions.deleteHotDeal(id);
        break;
      case "storefront-banners":
        await actions.deleteStorefrontBanner(id);
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
              \u00b7 {config.maxMessage}
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 ${sectionMissing ? "opacity-70" : ""}`}
            title={sectionMissing ? "Missing section renders ON — flipping creates it in the chosen state" : undefined}
          >
            <span className="text-xs text-gray-400">Show on home page</span>
            <Switch
              checked={sectionEnabled}
              onChange={(v) => {
                if (!section) {
                  void actions.createLayoutItem(kind, config.title, v).then((created) => {
                    if (!created) toast.error("Could not create section — check connection.");
                  });
                  return;
                }
                void actions.updateLayoutItem(section.id, { isEnabled: v });
              }}
            />
          </div>
          {!isAutoComputed && !isSyncFromApp && (
            <Button
              onClick={() => onAdd(kind)}
              disabled={atLimit}
              className={atLimit ? "opacity-60" : ""}
              title={atLimit ? config.maxMessage : undefined}
            >
              <Plus className="h-4 w-4" />
              Add {config.singular}
            </Button>
          )}
          {isAutoComputed && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Bot className="h-3.5 w-3.5" />
              Auto-computed from real data
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loadFailed ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm font-medium text-[#18181B]">Couldn&apos;t load {config.title.toLowerCase()}</p>
            <p className="mt-1 text-sm text-gray-500">The server didn&apos;t answer. Your items are safe — try again.</p>
            <Button variant="outline" className="mt-3" onClick={() => void actions.retrySection(failedResource as "top-sellers" | "hot-deals" | "featured-posts" | "storefront-banners" | "home-sections")}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-gray-500">
              {isAutoComputed
                ? `No ${config.title.toLowerCase()} yet. Items appear here automatically when sellers have real orders or active promotions.`
                : isSyncFromApp
                  ? `No ${config.title.toLowerCase()} yet. Banners are created by sellers in their storefront editor.`
                  : `No ${config.title.toLowerCase()} yet.`
              }
            </p>
            {!isAutoComputed && !isSyncFromApp && (
              <Button
                variant="outline"
                className="mt-3"
                disabled={atLimit}
                onClick={() => onAdd(kind)}
              >
                <Plus className="h-4 w-4" /> Add {config.singular}
              </Button>
            )}
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
                      {"productImage" in item && (item as HotDeal).productImage ? (
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
                      ) : "imageUrl" in item && (item as { imageUrl?: string }).imageUrl ? (
                        <img
                          src={String((item as { imageUrl?: string }).imageUrl)}
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
                    {!isAutoComputed && !isSyncFromApp && (
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
                    )}
                    {!isAutoComputed && (
                      <Button variant="primary" size="sm" onClick={() => onEdit(kind, item.id)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      </Card>
      {!isAutoComputed && (
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
      )}
    </>
  );
}
