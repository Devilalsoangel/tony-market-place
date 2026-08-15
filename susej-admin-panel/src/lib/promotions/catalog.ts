export type PromotionKind = "topSeller" | "hotDeal" | "featuredPost";

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
];

export function getPackage(packageId: string): PromotionPackage | undefined {
  return PROMOTION_PACKAGES.find((p) => p.id === packageId);
}