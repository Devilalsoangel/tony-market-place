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
  // 'featured-posts' (post marketing) was REMOVED — banners are the only hero
  // source and they come from the seller dashboard (Marketing Banners).
  name: 'top-sellers' | 'hot-deals' | 'storefront-banners';
  title: string;
  isEnabled: boolean;
  position: number;
};

export type HomeLayout = HomeSection[];
