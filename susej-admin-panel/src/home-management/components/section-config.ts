import {
  TrendingUp,
  Flame,
  Image as ImageIcon,
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
};
