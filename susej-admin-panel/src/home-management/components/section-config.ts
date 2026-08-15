import {
  Image,
  Grid2x2,
  TrendingUp,
  Flame,
  MessageSquare,
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
  }
> = {
  "hero-banners": {
    title: "Hero Banners",
    singular: "Hero Banner",
    icon: Image,
    count: (s) => s.heroBanners.length,
  },
  "featured-categories": {
    title: "Featured Categories",
    singular: "Featured Category",
    icon: Grid2x2,
    count: (s) => s.featuredCategories.length,
    max: 4,
    maxMessage: "The mobile app shows at most 4 featured categories.",
  },
  "top-sellers": {
    title: "Top Sellers",
    singular: "Top Seller",
    icon: TrendingUp,
    count: (s) => s.topSellers.length,
    max: 3,
    maxMessage: "The mobile app shows at most 3 top sellers.",
  },
  "hot-deals": {
    title: "Hot Deals",
    singular: "Hot Deal",
    icon: Flame,
    count: (s) => s.hotDeals.length,
    max: 3,
    maxMessage: "The mobile app shows at most 3 hot deals.",
  },
  "featured-posts": {
    title: "Featured Posts",
    singular: "Featured Post",
    icon: MessageSquare,
    count: (s) => s.featuredPosts.length,
    max: 2,
    maxMessage: "The mobile app shows 1–2 featured posts.",
  },
};
