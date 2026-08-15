export type HeroBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  buttonText: string;
  buttonAction: 'product' | 'category' | 'seller' | 'external';
  destinationId?: string;
  destinationUrl?: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive' | 'scheduled';
  createdAt: string;
  updatedAt: string;
};

export type FeaturedCategory = {
  id: string;
  categoryId: string;
  categoryName: string;
  imageUrl: string;
  position: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

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
  authorName: string;
  publishedAt: string;
};

export type HomeSection = {
  id: string;
  name: 'hero-banners' | 'featured-categories' | 'top-sellers' | 'hot-deals' | 'featured-posts';
  title: string;
  isEnabled: boolean;
  position: number;
};

export type HomeLayout = HomeSection[];
