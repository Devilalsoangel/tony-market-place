import {
  HeroBanner,
  FeaturedCategory,
  TopSeller,
  HotDeal,
  FeaturedPost,
  HomeSection,
  HomeLayout,
} from '@/types/home-management';

export const mockHeroBanners: HeroBanner[] = [
  {
    id: 'hb-1',
    title: 'Summer Sale Extravaganza',
    subtitle: 'Up to 50% off on your favorite items. Limited time only!',
    imageUrl:
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    buttonText: 'Shop Now',
    buttonAction: 'category',
    destinationId: 'cat-sale',
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    status: 'active',
    createdAt: '2026-06-20T10:00:00.000Z',
    updatedAt: '2026-06-20T10:00:00.000Z',
  },
  {
    id: 'hb-2',
    title: 'New Arrivals Weekly',
    subtitle: 'Fresh products added every Friday. Be the first to grab them!',
    imageUrl:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    buttonText: 'Explore',
    buttonAction: 'category',
    destinationId: 'cat-new',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: 'scheduled',
    createdAt: '2026-07-25T10:00:00.000Z',
    updatedAt: '2026-07-25T10:00:00.000Z',
  },
];

export const mockFeaturedCategories: FeaturedCategory[] = [
  {
    id: 'fc-1',
    categoryId: 'cat-electronics',
    categoryName: 'Electronics',
    imageUrl:
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    position: 1,
    status: 'active',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'fc-2',
    categoryId: 'cat-fashion',
    categoryName: 'Fashion',
    imageUrl:
      'https://images.unsplash.com/photo-1445205170230-053b83016050?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    position: 2,
    status: 'active',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'fc-3',
    categoryId: 'cat-home',
    categoryName: 'Home & Living',
    imageUrl:
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    position: 3,
    status: 'active',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-05T10:00:00.000Z',
  },
];

export const mockTopSellers: TopSeller[] = [
  {
    id: 'ts-1',
    sellerId: 'sel-001',
    sellerName: 'Tech Haven PH',
    sellerLogo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
    totalSales: 12540,
    rating: 4.8,
    reviewCount: 2310,
    position: 1,
    isPinned: true,
    status: 'active',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-07-30T10:00:00.000Z',
  },
  {
    id: 'ts-2',
    sellerId: 'sel-002',
    sellerName: 'Urban Threads',
    sellerLogo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
    totalSales: 9840,
    rating: 4.6,
    reviewCount: 1875,
    position: 2,
    isPinned: false,
    status: 'active',
    createdAt: '2026-05-10T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
  },
  {
    id: 'ts-3',
    sellerId: 'sel-003',
    sellerName: 'Gadget Galaxy',
    sellerLogo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
    totalSales: 7650,
    rating: 4.9,
    reviewCount: 1420,
    position: 3,
    isPinned: false,
    status: 'active',
    createdAt: '2026-05-15T10:00:00.000Z',
    updatedAt: '2026-07-25T10:00:00.000Z',
  },
];

export const mockHotDeals: HotDeal[] = [
  {
    id: 'hd-1',
    productId: 'prod-101',
    productName: 'Wireless Noise-Cancelling Headphones',
    productImage:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    originalPrice: 249.99,
    discountedPrice: 179.99,
    discountPercentage: 28,
    startDate: '2026-08-01',
    endDate: '2026-08-15',
    priority: 1,
    status: 'active',
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'hd-2',
    productId: 'prod-102',
    productName: 'Smart Fitness Watch Pro',
    productImage:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    originalPrice: 199.0,
    discountedPrice: 149.0,
    discountPercentage: 25,
    startDate: '2026-08-05',
    endDate: '2026-08-20',
    priority: 2,
    status: 'active',
    createdAt: '2026-07-22T10:00:00.000Z',
    updatedAt: '2026-07-22T10:00:00.000Z',
  },
];

export const mockFeaturedPosts: FeaturedPost[] = [
  {
    id: 'fp-1',
    postId: 'post-201',
    title: '10 Tips for Smart Online Shopping',
    excerpt: 'Learn how to find the best deals and avoid common pitfalls when shopping online.',
    imageUrl:
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    position: 1,
    isPinned: true,
    status: 'active',
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    createdAt: '2026-07-10T10:00:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
  },
  {
    id: 'fp-2',
    postId: 'post-202',
    title: 'Behind the Scenes: Our New Seller Program',
    excerpt: 'We are expanding our seller community. Here is what is coming next.',
    imageUrl:
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    position: 2,
    isPinned: false,
    status: 'active',
    startDate: '',
    endDate: '',
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
  },
];

export const mockLayout: HomeSection[] = [
  {
    id: 'sec-1',
    name: 'hero-banners',
    title: 'Hero Banners',
    isEnabled: true,
    position: 1,
  },
  {
    id: 'sec-2',
    name: 'featured-categories',
    title: 'Featured Categories',
    isEnabled: true,
    position: 2,
  },
  {
    id: 'sec-3',
    name: 'top-sellers',
    title: 'Top Sellers',
    isEnabled: true,
    position: 3,
  },
  {
    id: 'sec-4',
    name: 'hot-deals',
    title: 'Hot Deals',
    isEnabled: true,
    position: 4,
  },
  {
    id: 'sec-5',
    name: 'featured-posts',
    title: 'Featured Posts',
    isEnabled: false,
    position: 5,
  },
];

export const mockHomeData: {
  heroBanners: HeroBanner[];
  featuredCategories: FeaturedCategory[];
  topSellers: TopSeller[];
  hotDeals: HotDeal[];
  featuredPosts: FeaturedPost[];
  layout: HomeLayout;
} = {
  heroBanners: mockHeroBanners,
  featuredCategories: mockFeaturedCategories,
  topSellers: mockTopSellers,
  hotDeals: mockHotDeals,
  featuredPosts: mockFeaturedPosts,
  layout: mockLayout,
};
