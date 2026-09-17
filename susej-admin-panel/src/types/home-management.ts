export type TopSeller = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerLogo: string;
  totalSales: number;
  rating: number;
  reviewCount: number;
  position: number;
  isPinned: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

export type HotDeal = {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  startDate: string;
  endDate: string;
  priority: number;
  status: 'active' | 'inactive' | 'expired';
  createdAt: string;
  updatedAt: string;
};

export type FeaturedPost = {
  id: string;
  postId: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  position: number;
  isPinned: boolean;
  status: 'active' | 'inactive';
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
};

export type FeaturedPostRecord = {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  authorName?: string;
  publishedAt?: string;
};

export type StorefrontBanner = {
  id: string;
  sellerUsername: string;
  sellerName: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  imageUrl?: string;
  imageIndex?: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

export type HomeSection = {
  id: string;
  // Visibility rows for all 5 served rails. 'featured-posts' + 'spotlight' are
  // visibility-only (paid placements from the promo engine — the desk can hide
  // a wrong/fraudulent placement but manages items in Promotions, not here).
  name: 'top-sellers' | 'hot-deals' | 'storefront-banners' | 'featured-posts' | 'spotlight';
  title: string;
  isEnabled: boolean;
  position: number;
};

export type HomeLayout = HomeSection[];
