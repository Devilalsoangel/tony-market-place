export type PromotionKind = "topSeller" | "hotDeal" | "featuredPost" | "spotlight";

export interface PromotionPackage {
  id: string;
  kind: PromotionKind;
  name: string;
  description: string;
  price: number;
  currency: string;
  durationDays: number;
  pinned: boolean;
  positionPreference: "auto" | "suggested";
}

export const PROMOTION_PACKAGES: PromotionPackage[] = [
  {
    id: "top-seller-30",
    kind: "topSeller",
    name: "Top Seller Spotlight - 30 days",
    description: "Featured in the Top Sellers section on the home page for 30 days.",
    price: 1999,
    currency: "INR",
    durationDays: 30,
    pinned: false,
    positionPreference: "auto",
  },
  {
    id: "top-seller-7",
    kind: "topSeller",
    name: "Top Seller Spotlight - 7 days",
    description: "Featured in the Top Sellers section for 7 days.",
    price: 599,
    currency: "INR",
    durationDays: 7,
    pinned: false,
    positionPreference: "auto",
  },
  {
    id: "hot-deal-30",
    kind: "hotDeal",
    name: "Hot Deal - 30 days",
    description: "Your product listed in the Hot Deals section for 30 days.",
    price: 1499,
    currency: "INR",
    durationDays: 30,
    pinned: true,
    positionPreference: "auto",
  },
  {
    id: "hot-deal-7",
    kind: "hotDeal",
    name: "Hot Deal - 7 days",
    description: "Your product listed in the Hot Deals section for 7 days.",
    price: 499,
    currency: "INR",
    durationDays: 7,
    pinned: true,
    positionPreference: "auto",
  },
  {
    id: "featured-post-30",
    kind: "featuredPost",
    name: "Featured Post - 30 days",
    description: "Your community post featured on the home page for 30 days.",
    price: 999,
    currency: "INR",
    durationDays: 30,
    pinned: false,
    positionPreference: "auto",
  },
  {
    id: "featured-post-7",
    kind: "featuredPost",
    name: "Featured Post - 7 days",
    description: "Your community post featured on the home page for 7 days.",
    price: 349,
    currency: "INR",
    durationDays: 7,
    pinned: false,
    positionPreference: "auto",
  },
  {
    id: "spotlight-24h",
    kind: "spotlight",
    name: "Feed Spotlight - 24 hours",
    description: "Your listing pinned at the very top of buyer feeds for 24 hours.",
    price: 49,
    currency: "INR",
    durationDays: 1,
    pinned: true,
    positionPreference: "auto",
  },
];

/** Pinned-chat VAS (OLX Elite pattern) - sold inside the app chat threads. */
export const DEFAULT_CHAT_PIN = { price: 79, days: 7 } as const;

/**
 * Admin-editable price overrides live in an AppSetting row (key "promoPrices")
 * as a flat JSON map: { "<packageId>": price, "chatPin": price }. Everything
 * not listed keeps its code default below, so new packages never break.
 */
export function applyPriceOverrides(
  overrides: Record<string, unknown> | null | undefined
): PromotionPackage[] {
  if (!overrides) return PROMOTION_PACKAGES;
  return PROMOTION_PACKAGES.map((p) => {
    const raw = overrides[p.id];
    const price = typeof raw === "number" && raw >= 0 && Number.isFinite(raw) ? Math.round(raw) : p.price;
    return price === p.price ? p : { ...p, price };
  });
}

export function getChatPinPrice(overrides: Record<string, unknown> | null | undefined): number {
  const raw = overrides?.chatPin;
  return typeof raw === "number" && raw >= 0 && Number.isFinite(raw) ? Math.round(raw) : DEFAULT_CHAT_PIN.price;
}

export function getPackage(packageId: string): PromotionPackage | undefined {
  return PROMOTION_PACKAGES.find((p) => p.id === packageId);
}