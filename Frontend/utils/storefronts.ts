import {} from './screenImages';

// ─── STOREFRONT PROFILE BUILDER ───────────────────────────────────────────
// Storefronts are generated from REAL data only: the seller's category
// (archetype selection), their actual posts (catalog items) and any real
// stats passed in by the caller (followers / rating / reviews / verified).
// No hand-seeded shops, no vanity numbers, no invented attributes.

export type StorefrontArchetype = 'goods' | 'food' | 'service' | 'job' | 'realestate' | 'b2b' | 'empty';

export interface StorefrontChip {
  id: string;
  label: string;
}

export interface StorefrontDeal {
  id: string;
  title: string;
  price: number;
  oldPrice?: number;
  tag?: string;
  image: any;
}

export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  /** Derived from the item's own text; undefined = unknown, no veg mark shown. */
  veg?: boolean;
  tag?: string;
  image?: any;
}

export interface ServiceItem {
  id: string;
  name: string;
  duration: string;
  price: number;
  rating?: string;
}

export interface JobItem {
  id: string;
  role: string;
  type: string;
  location: string;
  exp: string;
  salary: string;
  tags: string[];
}

export interface ListingItem {
  id: string;
  title: string;
  price: number;
  suffix: string;
  locality: string;
  beds: number;
  baths: number;
  sqft: number;
  tag?: string;
  image: any;
}

export interface BulkProduct {
  id: string;
  name: string;
  desc: string;
  price: number;
  unit: string;
  moq: string;
  tag?: string;
  image?: any;
}

export interface ShopProfileRealStats {
  followers?: number;
  followersLabel?: string;
  rating?: number;
  reviewsCount?: number;
  verified?: boolean;
}

export interface ShopProfile {
  username: string;
  name: string;
  tagline: string;
  bio: string;
  verified: boolean;
  rating: number;
  reviews: string;
  archetype: StorefrontArchetype;
  stats: { label: string; value: string }[];
  chips: StorefrontChip[];
  tabLabels: string[];
  /** Marketing banner strip shown between the profile header and tabs. */
  banners?: { id: string; title: string; sub?: string; image?: any; cta?: string }[];
  actionRow: { primary: string; secondary: string };
  deals?: StorefrontDeal[];
  menu?: MenuItem[];
  services?: ServiceItem[];
  serviceCategories?: StorefrontChip[];
  trendingServices?: ServiceItem[];
  jobs?: JobItem[];
  jobFilters?: StorefrontChip[];
  listings?: ListingItem[];
  listingTypes?: StorefrontChip[];
  bulkProducts?: BulkProduct[];
  bulkDeals?: StorefrontDeal[];
  categoryFilter?: StorefrontChip[];
  infoChips?: string[];
  statusBadge?: string;
  statusLine?: string;
  avatar?: any;
}

// ─── CATEGORY → ARCHETYPE ───────────────────────────────────────────────────
// Every main category (utils/categories.ts, 17 industries) maps to a storefront
// archetype so ANY seller gets the right store UI/UX for their category.
// Unknown categories default to goods.
export const CATEGORY_ARCHETYPE: Record<string, StorefrontArchetype> = {
  fashion: 'goods',
  electronics: 'goods',
  realEstate: 'realestate',
  automobiles: 'realestate',
  food: 'food',
  beauty: 'service',
  fitness: 'service',
  education: 'service',
  homeServices: 'service',
  art: 'goods',
  pets: 'goods',
  agriculture: 'goods',
  kids: 'goods',
  services: 'service',
  b2b: 'b2b',
  job: 'job',
  medical: 'service',
};

/** Category accent color per category id (matches theme.ts CATEGORIES). */
const CATEGORY_COLORS: Record<string, string> = {
  fashion: '#9b6dff',
  electronics: '#4a7dff',
  realEstate: '#6b5fef',
  automobiles: '#5d5fef',
  food: '#43d5a5',
  beauty: '#d56bf0',
  fitness: '#ef5d6b',
  education: '#5fa8ef',
  homeServices: '#a08060',
  art: '#9b6dcc',
  pets: '#d5a060',
  agriculture: '#43b56b',
  kids: '#efb043',
  services: '#50b5a0',
  b2b: '#708090',
  job: '#5080c0',
  medical: '#40c0a0',
};

/**
 * Honest veg/non-veg mark derived from the item's own name + description.
 * Non-veg keywords win (checked first, since "non-veg" itself contains "veg").
 * Unknown text returns undefined — the UI omits the mark entirely instead of
 * stamping every item (including meat/seafood) as veg.
 */
const VEG_KEYWORDS = ['veg', 'paneer', 'dal', 'rice', 'dessert', 'sweet', 'bakery', 'fruit'];
const NONVEG_KEYWORDS = ['non-veg', 'nonveg', 'chicken', 'mutton', 'fish', 'meat', 'seafood', 'egg', 'prawn'];

function deriveVeg(text: string): boolean | undefined {
  const t = text.toLowerCase();
  if (NONVEG_KEYWORDS.some((k) => t.includes(k))) return false;
  if (VEG_KEYWORDS.some((k) => t.includes(k))) return true;
  return undefined;
}

/**
 * Build a truthful storefront profile for ANY seller from their category +
 * their own posts. Stats render only what the caller passes in as realStats —
 * anything unknown shows an honest dash or zero. Posts map into the
 * archetype's catalog lists WITHOUT invented attributes (no fake ratings,
 * certifications, MOQs, salaries or "Verified" tags).
 */
export function generateShopProfile(
  username: string,
  category: string,
  name: string,
  posts: { id: string; description?: string; price?: number; image?: string; salaryRange?: string; jobType?: string; experience?: string; location?: string }[],
  categoryLabel?: string,
  realStats?: ShopProfileRealStats
): ShopProfile {
  const archetype = CATEGORY_ARCHETYPE[category] ?? 'goods';
  const accent = CATEGORY_COLORS[category] ?? '#5d5fef';
  const label = categoryLabel ?? category;

  const statValue = (n?: number, dash = '\u2014') =>
    typeof n === 'number' && Number.isFinite(n) ? String(n) : dash;

  // Zero-post sellers get an honest EMPTY storefront.
  if (posts.length === 0) {
    return {
      username,
      name: name || username,
      tagline: `${label} storefront`,
      bio: `${label} storefront on susej - browse the catalog below or message the seller.`,
      verified: realStats?.verified === true,
      rating: typeof realStats?.rating === 'number' ? realStats.rating : 0,
      reviews: `${realStats?.reviewsCount ?? 0} Reviews`,
      archetype: 'empty',
      stats: [
        { label: 'Products', value: '0' },
        { label: 'Followers', value: realStats?.followersLabel ?? statValue(realStats?.followers, '0') },
        { label: 'Rating', value: typeof realStats?.rating === 'number' ? String(realStats.rating) : '\u2014' },
      ],
      chips: [],
      tabLabels: ['Products', 'About'],
      banners: [],
      actionRow: { primary: 'Follow', secondary: 'Message' },
      deals: [],
      avatar: undefined,
    };
  }

  const deals = posts.slice(0, 4).map((p) => ({
    id: p.id,
    title: (p.description || '').split('\n')[0] || 'New arrival',
    price: p.price || 0,
    tag: undefined,
    image: p.image ? { uri: p.image } : undefined,
  }));

  // The seller's OWN posts become the archetype catalog — nothing invented.
  const titleOf = (p: (typeof posts)[number]) => (p.description || '').split('\n')[0] || 'New listing';
  const menu = posts.slice(0, 8).map((p) => ({
    id: p.id,
    name: titleOf(p),
    desc: (p.description || '').split('\n').slice(1).join(' ').slice(0, 60),
    price: p.price || 0,
    veg: deriveVeg(p.description || ''),
    tag: undefined,
    image: p.image ? { uri: p.image } : undefined,
  }));
  const services = posts.slice(0, 8).map((p) => ({
    id: p.id,
    name: titleOf(p),
    duration: '',
    price: p.price || 0,
    rating: undefined,
  }));
  const jobs = posts.slice(0, 8).map((p) => ({
    id: p.id,
    role: titleOf(p),
    type: p.jobType || '',
    location: p.location || '',
    exp: p.experience || '',
    salary: p.salaryRange || '',
    tags: [] as string[],
  }));
  const listings = posts.slice(0, 6).map((p) => ({
    id: p.id,
    title: titleOf(p),
    price: p.price || 0,
    suffix: '',
    locality: p.location || '',
    beds: 0,
    baths: 0,
    sqft: 0,
    tag: undefined,
    image: p.image ? { uri: p.image } : undefined,
  }));
  const bulkProducts = posts.slice(0, 8).map((p) => ({
    id: p.id,
    name: titleOf(p),
    desc: (p.description || '').split('\n').slice(1).join(' ').slice(0, 60),
    price: p.price || 0,
    unit: '/pc',
    moq: '',
    tag: undefined,
    image: p.image ? { uri: p.image } : undefined,
  }));

  const isService = archetype === 'service';
  const isFood = archetype === 'food';
  const isJob = archetype === 'job';
  const isRealEstate = archetype === 'realestate';
  const isB2B = archetype === 'b2b';

  return {
    username,
    name: name || username,
    tagline: `${label} storefront`,
    bio: `${name || username} sells in ${label} on susej. Tap below to browse the full catalog, or message the seller for details.`,
    verified: realStats?.verified === true,
    rating: typeof realStats?.rating === 'number' ? realStats.rating : 0,
    reviews: `${realStats?.reviewsCount ?? 0} Reviews`,
    archetype,
    stats: [
      {
        label: isJob ? 'Openings' : isService ? 'Services' : 'Products',
        value: String(posts.length),
      },
      { label: 'Followers', value: realStats?.followersLabel ?? statValue(realStats?.followers, '0') },
      { label: 'Rating', value: typeof realStats?.rating === 'number' ? String(realStats.rating) : '\u2014' },
    ],
    chips: [],
    tabLabels: isService
      ? ['Services', 'Reviews', 'About']
      : isFood
        ? ['Menu', 'Reviews']
        : isJob
          ? ['Jobs', 'About']
          : isRealEstate
            ? ['Listings', 'Reviews', 'About']
            : isB2B
              ? ['Products', 'Reviews', 'About']
              : ['Products', 'Reviews'],
    banners: [],
    actionRow: { primary: 'Follow', secondary: 'Message' },
    deals,
    menu: isFood ? menu : undefined,
    services: isService ? services : undefined,
    serviceCategories: isService
      ? [
          { id: 'all', label: 'All' },
          { id: 'new', label: 'New' },
        ]
      : undefined,
    trendingServices: undefined,
    jobs: isJob ? jobs : undefined,
    jobFilters: isJob
      ? [
          { id: 'all', label: 'All' },
          { id: 'fulltime', label: 'Full-time' },
          { id: 'remote', label: 'Remote' },
        ]
      : undefined,
    listings: isRealEstate ? listings : undefined,
    listingTypes: isRealEstate
      ? [
          { id: 'buy', label: 'Buy' },
          { id: 'rent', label: 'Rent' },
        ]
      : undefined,
    bulkProducts: isB2B ? bulkProducts : undefined,
    bulkDeals: isB2B ? deals : undefined,
    categoryFilter: isB2B
      ? [
          { id: 'all', label: 'All' },
          { id: 'new', label: 'New' },
        ]
      : undefined,
    avatar: undefined,
  };
}
