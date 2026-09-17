import {
  TrendingUp,
  Flame,
  Image as ImageIcon,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { HomeSection } from "@/types/home-management";
import type { HomeManagementState } from "@/home-management/context";

export type SectionKind = HomeSection["name"];

export const SECTION_CONFIG: Record<
  SectionKind,
  {
    title: string;
    singular: string;
    icon: LucideIcon;
    count: (s: HomeManagementState) => number;
    max?: number;
    maxMessage?: string;
    autoCompute?: boolean;
    /** When true, admin cannot manually add items — they sync from the seller app. */
    syncFromApp?: boolean;
    /** When true, the desk shows a visibility kill-switch only — paid items
     * are managed by the promo engine (Promotions desk), never here. */
    visibilityOnly?: boolean;
  }
> = {
  "top-sellers": {
    title: "Top Sellers",
    singular: "Top Seller",
    icon: TrendingUp,
    count: (s) => s.topSellers.length,
    max: 3,
    maxMessage: "The mobile app shows at most 3 top sellers.",
    autoCompute: true,
  },
  "hot-deals": {
    title: "Hot Deals",
    singular: "Hot Deal",
    icon: Flame,
    count: (s) => s.hotDeals.length,
    max: 3,
    maxMessage: "The mobile app shows at most 3 hot deals.",
    autoCompute: true,
  },
  // Marketing Banners - banner-image marketing synced FROM the seller dashboard
  // (seller uploads the image + picks the banner size). The app feed hero renders
  // these. Post marketing (featured-posts) was removed - posts are NOT banners.
  "storefront-banners": {
    title: "Marketing Banners",
    singular: "Marketing Banner",
    icon: ImageIcon,
    count: (s) => s.storefrontBanners.length,
    syncFromApp: true,
  },
  // Paid rails: items are written by the promo engine on purchase (Promotions
  // desk manages them). The home desk owns the visibility kill-switch so a
  // wrong/fraudulent paid placement can be hidden immediately.
  "featured-posts": {
    title: "Featured Posts",
    singular: "Featured Post",
    icon: Star,
    count: () => 0,
    visibilityOnly: true,
  },
  "spotlight": {
    title: "Spotlight",
    singular: "Spotlight",
    icon: Zap,
    count: () => 0,
    visibilityOnly: true,
  },
};
