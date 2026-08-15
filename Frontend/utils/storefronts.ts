import { foodHubImages, sellerImages, bookServiceImages, hashtagImages, productDetailImages, nearbyImages } from './screenImages';

// ─── STOREFRONT REGISTRY ──────────────────────────────────────────────────
// One archetype-aware storefront per shop, matching the 7 Stitch reference
// screens (Figma nodes 245:1424 / 245:1201 / 245:30 / 245:776 / 245:1024 /
// 245:527 / 245:2804). Archetypes mirror utils/categoryFlow.ts where possible
// (goods/food/service/job/b2b) with realestate added for the property flow.
//
// The generic seller profile (Figma 1:2765) is used for sellers NOT in this
// registry — see app/seller/[username].tsx dispatcher.

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
  veg: boolean;
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
  banner: {
    image?: any;
    headline: string;
    sub: string;
    cta: string;
    gradient: [string, string];
  };
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

// Colors used only for the 7 seeded storefronts — functional/brand accent
// colors that have no theme token (product photos, category accents).
export const SHOP_ACCENTS: Record<string, string> = {
  elara_finds: '#7c4dff',
  spiceroute: '#e65100',
  glowsalon: '#c2185b',
  technova: '#1565c0',
  homesquare: '#2e7d32',
  weaveright: '#6d4c41',
  techvault: '#4a7dff',
  urbanjungle: '#43b56b',
  brushstyle: '#a08060',
  freshbasket: '#43b56b',
  smilecraft: '#40c0a0',
  fluentfirst: '#5fa8ef',
};

export const SHOP_PROFILES: Record<string, ShopProfile> = {
  elara_finds: {
    username: 'elara_finds',
    name: 'Elara Finds',
    tagline: 'Curated sustainable luxury. Weekly drops.',
    bio: 'Passionate about sustainable luxury. Dropping weekly collections of authentic vintage and contemporary pieces. Based in Milan.',
    verified: true,
    rating: 4.9,
    reviews: '1.2k Reviews',
    archetype: 'goods',
    stats: [
      { label: 'Products', value: '148' },
      { label: 'Followers', value: '18.5k' },
      { label: 'Rating', value: '4.9' },
    ],
    chips: [
      { id: 'all', label: 'All' },
      { id: 'dresses', label: 'Dresses' },
      { id: 'bags', label: 'Bags' },
      { id: 'jewellery', label: 'Jewellery' },
      { id: 'home', label: 'Home' },
      { id: 'sale', label: 'Sale' },
    ],
    tabLabels: ['Products', 'Reviews'],
    banner: {
      image: hashtagImages.products[0],
      headline: 'Summer Edit',
      sub: 'New season drops every Friday. Up to 40% off.',
      cta: 'Shop the Edit',
      gradient: ['#5d5fef', '#4343d5'],
    },
    actionRow: { primary: 'Follow', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Weekend Sale', sub: 'Up to 40% off select styles', image: sellerImages.products[4], cta: 'Shop' },
      { id: 'b2', title: 'New Drop Alert', sub: 'Friday 10am IST', image: sellerImages.products[5], cta: 'Notify me' },
    ],
    deals: [
      { id: 'd1', title: 'Vintage Celine Box', price: 1250, oldPrice: 1600, tag: '-22%', image: sellerImages.products[0] },
      { id: 'd2', title: 'Luxe Runner v2', price: 420, tag: 'New', image: sellerImages.products[1] },
      { id: 'd3', title: 'Gold Essence Watch', price: 890, tag: 'Limited', image: sellerImages.products[2] },
      { id: 'd4', title: 'Artisan Knit Sweater', price: 180, oldPrice: 240, tag: '-25%', image: sellerImages.products[3] },
    ],
    avatar: sellerImages.avatar,
  },

  spiceroute: {
    username: 'spiceroute',
    name: 'Spice Route Kitchen',
    tagline: 'Authentic Indian home-style kitchen',
    bio: 'Homestyle Indian food cooked fresh to order. From dal tadka to Hyderabadi biryani — delivered hot in 30-40 minutes.',
    verified: true,
    rating: 4.8,
    reviews: '2.1k Reviews',
    archetype: 'food',
    stats: [
      { label: 'Orders', value: '12.4k' },
      { label: 'Rating', value: '4.8' },
      { label: 'Prep Time', value: '30-40m' },
    ],
    chips: [
      { id: 'all', label: 'All' },
      { id: 'starters', label: 'Starters' },
      { id: 'mains', label: 'Mains' },
      { id: 'breads', label: 'Breads' },
      { id: 'desserts', label: 'Desserts' },
      { id: 'beverages', label: 'Beverages' },
    ],
    tabLabels: ['Menu', 'Reviews'],
    banner: {
      image: foodHubImages.hero,
      headline: 'Spice Route Kitchen',
      sub: 'Free delivery on orders above ₹499',
      cta: 'Order Now',
      gradient: ['#e65100', '#bf360c'],
    },
    actionRow: { primary: 'Order Now', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Free delivery over \u20B9499', sub: 'Hot meals in 30-40 min', image: foodHubImages.popular[4], cta: 'Order' },
      { id: 'b2', title: 'Weekend Thali Special', sub: 'Sat & Sun only', image: foodHubImages.popular[5], cta: 'View' },
    ],
    statusBadge: 'Open now',
    statusLine: 'Open now · 30-40 min · Free delivery over ₹499',
    deals: [
      { id: 't1', title: 'Butter Chicken Combo', price: 349, oldPrice: 420, tag: 'Bestseller', image: foodHubImages.popular[0] },
      { id: 't2', title: 'Paneer Tikka', price: 279, tag: 'Veg', image: foodHubImages.popular[1] },
      { id: 't3', title: 'Hyderabadi Biryani', price: 329, tag: 'Spicy', image: foodHubImages.popular[2] },
      { id: 't4', title: 'Gulab Jamun', price: 149, tag: 'Dessert', image: foodHubImages.popular[3] },
    ],
    menu: [
      { id: 'm1', name: 'Paneer Tikka', desc: 'Char-grilled cottage cheese, mint chutney', price: 279, veg: true, tag: 'Bestseller' },
      { id: 'm2', name: 'Chicken 65', desc: 'Crispy south-Indian fried chicken', price: 299, veg: false, tag: 'Spicy' },
      { id: 'm3', name: 'Butter Chicken', desc: 'Creamy tomato gravy, house blend', price: 349, veg: false, tag: 'Bestseller' },
      { id: 'm4', name: 'Dal Tadka', desc: 'Yellow lentils, ghee tempering', price: 189, veg: true },
      { id: 'm5', name: 'Hyderabadi Biryani', desc: 'Basmati + saffron, raita on the side', price: 329, veg: false, tag: 'Signature' },
      { id: 'm6', name: 'Garlic Naan', desc: 'Tandoor-baked, garlic butter', price: 79, veg: true },
      { id: 'm7', name: 'Gulab Jamun (2 pc)', desc: 'Warm, cardamom syrup', price: 149, veg: true },
      { id: 'm8', name: 'Masala Chai', desc: 'Fresh-brewed, ginger & cardamom', price: 59, veg: true },
    ],
    avatar: sellerImages.avatar,
  },

  glowsalon: {
    username: 'glowsalon',
    name: 'Glow Salon Studio',
    tagline: 'Beauty & grooming for ladies and gents',
    bio: 'Premium salon with 12+ years of experience. Expert stylists, hygienic tools and a menu for every look. Walk-ins welcome.',
    verified: true,
    rating: 4.9,
    reviews: '2.4k Reviews',
    archetype: 'service',
    stats: [
      { label: 'Rating', value: '5.0' },
      { label: 'Years', value: '12+' },
      { label: 'Clients', value: '8k+' },
    ],
    chips: [],
    tabLabels: ['Services', 'Reviews', 'About'],
    banner: {
      image: bookServiceImages.hero,
      headline: 'Glow Salon Studio',
      sub: 'New-look appointments this month',
      cta: 'Book Now',
      gradient: ['#c2185b', '#880e4f'],
    },
    actionRow: { primary: 'Book Now', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Festive Glow Pack', sub: 'Hair spa + facial at \u20B92,199', image: bookServiceImages.hero, cta: 'Book' },
      { id: 'b2', title: 'Bridal Month', sub: 'Complimentary trial for brides', image: sellerImages.products[1], cta: 'Enquire' },
    ],
    infoChips: ['Ladies & Gents', 'Walk-ins Welcome', 'Parking Available'],
    serviceCategories: [
      { id: 'hair', label: 'Hair' },
      { id: 'skin', label: 'Skin' },
      { id: 'nails', label: 'Nails' },
      { id: 'makeup', label: 'Makeup' },
      { id: 'spa', label: 'Spa' },
      { id: 'grooming', label: 'Grooming' },
    ],
    trendingServices: [
      { id: 's1', name: 'Hair Spa', duration: '60 min', price: 1299 },
      { id: 's2', name: 'Signature Facial', duration: '60 min', price: 999 },
      { id: 's3', name: 'Keratin Treatment', duration: '120 min', price: 2499 },
      { id: 's4', name: 'Gel Manicure', duration: '45 min', price: 549 },
    ],
    services: [
      { id: 'sv1', name: 'Haircut & Styling', duration: '45 min', price: 499 },
      { id: 'sv2', name: 'Hair Colour', duration: '120 min', price: 1499 },
      { id: 'sv3', name: 'Signature Facial', duration: '60 min', price: 999, rating: '4.9' },
      { id: 'sv4', name: 'Manicure', duration: '45 min', price: 549 },
      { id: 'sv5', name: 'Pedicure', duration: '60 min', price: 699 },
      { id: 'sv6', name: 'Bridal Makeup', duration: '3 hr', price: 7999, rating: '5.0' },
      { id: 'sv7', name: 'Swedish Massage', duration: '60 min', price: 1299 },
      { id: 'sv8', name: 'Beard Grooming', duration: '30 min', price: 299 },
    ],
    avatar: bookServiceImages.avatar,
  },

  technova: {
    username: 'technova',
    name: 'TechNova Solutions',
    tagline: 'We are hiring — join the team',
    bio: 'Product company building the next generation of commerce apps. Remote-friendly, great perks, real ownership from day one.',
    verified: true,
    rating: 4.7,
    reviews: '890 Reviews',
    archetype: 'job',
    stats: [
      { label: 'Openings', value: '12' },
      { label: 'Hired', value: '340+' },
      { label: 'Rating', value: '4.7' },
    ],
    chips: [],
    tabLabels: ['Jobs', 'About'],
    banner: {
      image: productDetailImages.gallery[1],
      headline: 'Build the future of commerce',
      sub: '12 open roles · Remote-first',
      cta: 'View Openings',
      gradient: ['#1565c0', '#0d47a1'],
    },
    actionRow: { primary: 'Apply Now', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Refer a friend', sub: 'Get \u20B925,000 once they join', image: productDetailImages.gallery[3], cta: 'Refer' },
      { id: 'b2', title: 'Hackathon 2026', sub: '48 hrs · prizes worth \u20B95L', image: productDetailImages.similar[1], cta: 'Register' },
    ],
    jobFilters: [
      { id: 'all', label: 'All' },
      { id: 'fulltime', label: 'Full-time' },
      { id: 'remote', label: 'Remote' },
      { id: 'blr', label: 'Bengaluru' },
      { id: '2yrs', label: '2+ yrs' },
    ],
    jobs: [
      { id: 'j1', role: 'React Native Developer', type: 'Full-time', location: 'Bengaluru · Hybrid', exp: '2+ yrs', salary: '₹18 LPA', tags: ['React Native', 'TypeScript', 'Expo'] },
      { id: 'j2', role: 'Backend Engineer', type: 'Full-time', location: 'Remote', exp: '3+ yrs', salary: '₹22 LPA', tags: ['Go', 'Python', 'PostgreSQL'] },
      { id: 'j3', role: 'UI/UX Designer', type: 'Full-time', location: 'Remote', exp: '1+ yrs', salary: '₹12 LPA', tags: ['Figma', 'Design Systems'] },
      { id: 'j4', role: 'QA Automation Engineer', type: 'Full-time', location: 'Bengaluru · On-site', exp: '1+ yrs', salary: '₹10 LPA', tags: ['Maestro', 'Appium', 'CI/CD'] },
      { id: 'j5', role: 'DevOps Engineer', type: 'Full-time', location: 'Remote', exp: '3+ yrs', salary: '₹20 LPA', tags: ['AWS', 'Kubernetes', 'Terraform'] },
      { id: 'j6', role: 'Product Manager — Commerce', type: 'Full-time', location: 'Bengaluru', exp: '4+ yrs', salary: '₹25 LPA', tags: ['Marketplace', 'Growth'] },
    ],
    avatar: sellerImages.avatar,
  },

  homesquare: {
    username: 'homesquare',
    name: 'HomeSquare Realty',
    tagline: 'Trusted property consultants since 2012',
    bio: 'Verified properties with transparent pricing. RERA-registered, end-to-end assistance for buying, renting and leasing.',
    verified: true,
    rating: 4.8,
    reviews: '1.5k Reviews',
    archetype: 'realestate',
    stats: [
      { label: 'Listings', value: '48' },
      { label: 'Units Sold', value: '1.2k' },
      { label: 'Rating', value: '4.8' },
    ],
    chips: [],
    tabLabels: ['Listings', 'Agents', 'Reviews'],
    banner: {
      image: productDetailImages.gallery[2],
      headline: 'HomeSquare Realty',
      sub: '48 verified listings · zero brokerage on rent',
      cta: 'Enquire',
      gradient: ['#2e7d32', '#1b5e20'],
    },
    actionRow: { primary: 'Enquire', secondary: 'Schedule Visit' },
    banners: [
      { id: 'b1', title: 'Zero brokerage on rent', sub: 'Only verified owners', image: productDetailImages.similar[0], cta: 'Explore' },
      { id: 'b2', title: 'New launch: Lakeview Villas', sub: 'Pre-launch pricing ends Sunday', image: productDetailImages.gallery[2], cta: 'Visit' },
    ],
    listingTypes: [
      { id: 'buy', label: 'Buy' },
      { id: 'rent', label: 'Rent' },
      { id: 'pg', label: 'PG' },
      { id: 'commercial', label: 'Commercial' },
    ],
    listings: [
      { id: 'l1', title: '2BHK Apartment', price: 85, suffix: 'L', locality: 'Koramangala, Bengaluru', beds: 2, baths: 2, sqft: 1150, tag: 'Ready to move', image: productDetailImages.similar[0] },
      { id: 'l2', title: '3BHK Villa', price: 1.8, suffix: 'Cr', locality: 'Whitefield, Bengaluru', beds: 3, baths: 3, sqft: 2400, tag: 'Premium', image: productDetailImages.similar[1] },
      { id: 'l3', title: '1BHK Studio', price: 18, suffix: 'k/mo', locality: 'Indiranagar, Bengaluru', beds: 1, baths: 1, sqft: 520, tag: 'Fully furnished', image: productDetailImages.gallery[0] },
      { id: 'l4', title: 'Office Space', price: 95, suffix: 'k/mo', locality: 'MG Road, Bengaluru', beds: 0, baths: 2, sqft: 1800, tag: 'Commercial', image: productDetailImages.gallery[2] },
      { id: 'l5', title: '4BHK Penthouse', price: 3.2, suffix: 'Cr', locality: 'Hebbal, Bengaluru', beds: 4, baths: 4, sqft: 3200, tag: 'Sea of Green', image: productDetailImages.similar[0] },
    ],
    avatar: nearbyImages.avatar,
  },

  weaveright: {
    username: 'weaveright',
    name: 'WeaveRight Fabrics',
    tagline: 'Cotton, silk & linen — MOQ 500 m',
    bio: 'Direct-from-mill fabrics for apparel brands and exporters. Consistent quality, lab-tested lots, pan-India delivery.',
    verified: true,
    rating: 4.9,
    reviews: '620 Reviews',
    archetype: 'b2b',
    stats: [
      { label: 'Products', value: '320' },
      { label: 'Supplied', value: '1.4k T' },
      { label: 'Clients', value: '560' },
    ],
    chips: [],
    tabLabels: ['Products', 'Bulk Deals', 'About'],
    banner: {
      image: productDetailImages.gallery[1],
      headline: 'WeaveRight Fabrics',
      sub: 'Lab-tested lots · MOQ from 200 m',
      cta: 'Get Quote',
      gradient: ['#6d4c41', '#4e342e'],
    },
    actionRow: { primary: 'Get Quote', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Festive fabric sale', sub: 'Cotton shirting from \u20B9150/m', image: productDetailImages.gallery[1], cta: 'Quote' },
      { id: 'b2', title: 'New: Organic canvas', sub: 'GOTS certified · MOQ 300 m', image: productDetailImages.similar[0], cta: 'Sample' },
    ],
    categoryFilter: [
      { id: 'all', label: 'All' },
      { id: 'cotton', label: 'Cotton' },
      { id: 'silk', label: 'Silk' },
      { id: 'linen', label: 'Linen' },
      { id: 'blends', label: 'Blends' },
      { id: 'prints', label: 'Prints' },
    ],
    bulkDeals: [
      { id: 'b1', title: 'Cotton Shirting 60s', price: 185, oldPrice: 210, tag: 'MOQ 500m', image: productDetailImages.similar[0] },
      { id: 'b2', title: 'Mulberry Silk', price: 1450, tag: 'MOQ 200m', image: productDetailImages.similar[1] },
      { id: 'b3', title: 'Linen Blend', price: 320, tag: 'MOQ 800m', image: productDetailImages.gallery[0] },
      { id: 'b4', title: 'Chambray', price: 240, oldPrice: 265, tag: 'MOQ 600m', image: productDetailImages.gallery[2] },
    ],
    bulkProducts: [
      { id: 'bp1', name: 'Cotton Shirting 60s', desc: 'Yarn-dyed, 120 GSM, 44" width', price: 185, unit: '/m', moq: 'MOQ 500 m' },
      { id: 'bp2', name: 'Mulberry Silk 22mm', desc: 'Plain weave, natural sheen', price: 1450, unit: '/m', moq: 'MOQ 200 m', tag: 'Premium' },
      { id: 'bp3', name: 'Linen Cotton Blend', desc: '55/45 linen-cotton, garment-washed', price: 320, unit: '/m', moq: 'MOQ 800 m' },
      { id: 'bp4', name: 'Chambray Denim', desc: 'Light 8 oz, indigo', price: 240, unit: '/m', moq: 'MOQ 600 m', tag: 'Bestseller' },
      { id: 'bp5', name: 'Digital Print Poplin', desc: 'Custom prints, 4-colour', price: 195, unit: '/m', moq: 'MOQ 1000 m' },
      { id: 'bp6', name: 'Organic Cotton Canvas', desc: 'GOTS certified, 280 GSM', price: 410, unit: '/m', moq: 'MOQ 300 m' },
    ],
    avatar: sellerImages.avatar,
  },

  techvault: {
    username: 'techvault',
    name: 'TechVault',
    tagline: 'Premium electronics & gadgets',
    bio: 'Premium electronics and gadgets. Certified refurbished products with full warranty, fast dispatch and honest condition grading.',
    verified: true,
    rating: 4.8,
    reviews: '1.9k Reviews',
    archetype: 'goods',
    stats: [
      { label: 'Products', value: '86' },
      { label: 'Followers', value: '9.4k' },
      { label: 'Rating', value: '4.8' },
    ],
    chips: [
      { id: 'all', label: 'All' },
      { id: 'mobiles', label: 'Mobiles' },
      { id: 'laptops', label: 'Laptops' },
      { id: 'audio', label: 'Headphones & Audio' },
      { id: 'wearables', label: 'Smart Watches' },
      { id: 'refurb', label: 'Refurbished' },
    ],
    tabLabels: ['Products', 'Reviews'],
    banner: {
      image: productDetailImages.gallery[1],
      headline: 'Deals on Tomorrow Tech',
      sub: 'Certified refurb + new launches. EMI available.',
      cta: 'Shop Now',
      gradient: ['#4a7dff', '#1e4fb8'],
    },
    actionRow: { primary: 'Shop Now', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Refurb Week', sub: 'Up to 40% off certified units', image: productDetailImages.gallery[1], cta: 'Shop' },
      { id: 'b2', title: 'New: Foldables', sub: 'Pre-order with free buds', image: productDetailImages.similar[0], cta: 'View' },
    ],
    deals: [
      { id: 't1', title: 'MacBook Pro M3', price: 45999, oldPrice: 52000, tag: '-12%', image: productDetailImages.gallery[0] },
      { id: 't2', title: 'Noise-Cancel Headphones', price: 4299, tag: 'New', image: productDetailImages.similar[1] },
      { id: 't3', title: 'Smart Watch Ultra', price: 18999, tag: 'Hot', image: productDetailImages.gallery[2] },
      { id: 't4', title: 'Refurb iPhone 14', price: 48999, oldPrice: 56900, tag: 'Refurb', image: productDetailImages.similar[0] },
    ],
    avatar: sellerImages.avatar,
  },

  urbanjungle: {
    username: 'urbanjungle',
    name: 'Urban Jungle',
    tagline: 'Handcrafted decor, plants & ceramics',
    bio: 'Handcrafted home decor, planters and ceramics. Sustainable materials, small-batch production and unique designs for your space.',
    verified: true,
    rating: 4.9,
    reviews: '760 Reviews',
    archetype: 'goods',
    stats: [
      { label: 'Products', value: '54' },
      { label: 'Followers', value: '6.1k' },
      { label: 'Rating', value: '4.9' },
    ],
    chips: [
      { id: 'all', label: 'All' },
      { id: 'ceramics', label: 'Ceramics' },
      { id: 'plants', label: 'Plants' },
      { id: 'lighting', label: 'Lighting' },
      { id: 'textiles', label: 'Textiles' },
      { id: 'gifts', label: 'Gifts' },
    ],
    tabLabels: ['Products', 'Reviews'],
    banner: {
      image: hashtagImages.products[2],
      headline: 'Jungle in Your Living Room',
      sub: 'Small-batch ceramics + pet-friendly plants.',
      cta: 'Browse',
      gradient: ['#43b56b', '#1e7a42'],
    },
    actionRow: { primary: 'Browse', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Plant Parent Starter Kit', sub: '3 pots + 3 plants at \u20B91,299', image: hashtagImages.products[1], cta: 'Shop' },
      { id: 'b2', title: 'Handmade Ceramics', sub: 'Each piece one-of-a-kind', image: hashtagImages.products[0], cta: 'View' },
    ],
    deals: [
      { id: 'u1', title: 'Ceramic Pot Set (3)', price: 1299, oldPrice: 1699, tag: '-24%', image: hashtagImages.products[0] },
      { id: 'u2', title: 'Monstera in Basket', price: 899, tag: 'Bestseller', image: hashtagImages.products[1] },
      { id: 'u3', title: 'Boho Wall Hanging', price: 649, tag: 'Handmade', image: hashtagImages.products[2] },
      { id: 'u4', title: 'Terracotta Table Lamp', price: 1099, tag: 'New', image: hashtagImages.products[3] },
    ],
    avatar: sellerImages.avatar,
  },

  brushstyle: {
    username: 'brushstyle',
    name: 'Brush & Style Studio',
    tagline: 'Painting, wall art & home styling',
    bio: 'Professional interior painting, wall art and complete home styling. Colour consultation, quality paints and tidy execution.',
    verified: true,
    rating: 4.7,
    reviews: '430 Reviews',
    archetype: 'service',
    stats: [
      { label: 'Projects', value: '620+' },
      { label: 'Rating', value: '4.7' },
      { label: 'Cities', value: '8' },
    ],
    chips: [],
    tabLabels: ['Services', 'Reviews', 'About'],
    banner: {
      image: productDetailImages.gallery[2],
      headline: 'Give Your Walls a New Story',
      sub: 'Interior painting & curated wall art.',
      cta: 'Book Now',
      gradient: ['#a08060', '#5f4530'],
    },
    actionRow: { primary: 'Book Now', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Flat 15% off full-home painting', sub: 'This month only', image: productDetailImages.gallery[2], cta: 'Book' },
      { id: 'b2', title: 'Colour Consultation', sub: '\u20B9499, adjustable on booking', image: productDetailImages.similar[1], cta: 'Enquire' },
    ],
    infoChips: ['Free Quote', 'Waterproofing Add-on', 'Post-Project Cleanup'],
    serviceCategories: [
      { id: 'painting', label: 'Painting' },
      { id: 'wallart', label: 'Wall Art' },
      { id: 'styling', label: 'Home Styling' },
      { id: 'waterproof', label: 'Waterproofing' },
    ],
    trendingServices: [
      { id: 's1', name: 'Full-Home Painting', duration: '3-5 days', price: 24999 },
      { id: 's2', name: 'Single Room Paint', duration: '1 day', price: 4999 },
      { id: 's3', name: 'Custom Wall Mural', duration: '2 days', price: 8999 },
      { id: 's4', name: 'Colour Consultation', duration: '1 hr', price: 499 },
    ],
    services: [
      { id: 'sv1', name: 'Single Room Painting', duration: '1 day', price: 4999 },
      { id: 'sv2', name: 'Full-Home Painting', duration: '3-5 days', price: 24999, rating: '4.8' },
      { id: 'sv3', name: 'Wall Mural / Feature Wall', duration: '2 days', price: 8999 },
      { id: 'sv4', name: 'Home Styling Session', duration: '3 hrs', price: 5999 },
      { id: 'sv5', name: 'Waterproofing Treatment', duration: '2 days', price: 12999 },
      { id: 'sv6', name: 'Texture & Stencil Finish', duration: '1 day', price: 7499 },
    ],
    avatar: sellerImages.avatar,
  },

  freshbasket: {
    username: 'freshbasket',
    name: 'FreshBasket',
    tagline: 'Organic farm produce, delivered daily',
    bio: 'Organic farm-fresh vegetables, fruits and staples sourced from partner farms every morning. Same-day delivery in your city.',
    verified: true,
    rating: 4.8,
    reviews: '3.2k Reviews',
    archetype: 'food',
    stats: [
      { label: 'Orders', value: '21k' },
      { label: 'Rating', value: '4.8' },
      { label: 'Delivery', value: 'Same day' },
    ],
    chips: [
      { id: 'all', label: 'All' },
      { id: 'vegetables', label: 'Vegetables' },
      { id: 'fruits', label: 'Fruits' },
      { id: 'organic', label: 'Organic' },
      { id: 'staples', label: 'Staples' },
      { id: 'dairy', label: 'Dairy' },
    ],
    tabLabels: ['Menu', 'Reviews'],
    banner: {
      image: foodHubImages.hero,
      headline: 'Farm Fresh, Every Morning',
      sub: 'Free delivery on orders above \u20B9399',
      cta: 'Order Now',
      gradient: ['#43b56b', '#1e7a42'],
    },
    actionRow: { primary: 'Order Now', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Veg Box 5kg', sub: '\u20B9499 · seasonal mix', image: foodHubImages.popular[0], cta: 'Order' },
      { id: 'b2', title: 'Organic Staples', sub: 'Millets, dals & cold-pressed oils', image: foodHubImages.popular[2], cta: 'Shop' },
    ],
    statusBadge: 'Open now',
    statusLine: 'Open now · Same-day delivery · Free delivery over ₹399',
    deals: [
      { id: 'f1', title: 'Veg Box 5kg', price: 499, oldPrice: 599, tag: '-17%', image: foodHubImages.popular[0] },
      { id: 'f2', title: 'Seasonal Fruit Box', price: 349, tag: 'Fresh', image: foodHubImages.popular[1] },
      { id: 'f3', title: 'Organic Millets 1kg', price: 189, tag: 'Organic', image: foodHubImages.popular[2] },
      { id: 'f4', title: 'Cold-Pressed Oil 1L', price: 249, tag: 'Bestseller', image: foodHubImages.popular[3] },
    ],
    menu: [
      { id: 'm1', name: 'Organic Veg Box 5kg', desc: 'Seasonal mix, farm to door', price: 499, veg: true, tag: 'Bestseller' },
      { id: 'm2', name: 'Fruit Box 3kg', desc: 'Mango, banana, apple, papaya', price: 349, veg: true },
      { id: 'm3', name: 'Organic Millets 1kg', desc: 'Foxtail / barnyard / kodo', price: 189, veg: true, tag: 'Organic' },
      { id: 'm4', name: 'Cold-Pressed Groundnut Oil', desc: '1L bottle, no additives', price: 249, veg: true },
      { id: 'm5', name: 'A2 Cow Milk 1L', desc: 'From single-village dairy', price: 89, veg: true, tag: 'Daily' },
      { id: 'm6', name: 'Free-Range Eggs (12)', desc: 'Farm direct, protein rich', price: 149, veg: false },
    ],
    avatar: sellerImages.avatar,
  },

  smilecraft: {
    username: 'smilecraft',
    name: 'SmileCraft Dental',
    tagline: 'Family dentistry, pain-free',
    bio: 'Modern family dentistry with pain-free treatments, transparent pricing and gentle care. Checkups, cleaning, braces and implants.',
    verified: true,
    rating: 4.9,
    reviews: '1.1k Reviews',
    archetype: 'service',
    stats: [
      { label: 'Patients', value: '12k+' },
      { label: 'Rating', value: '4.9' },
      { label: 'Open', value: '8 AM - 8 PM' },
    ],
    chips: [],
    tabLabels: ['Services', 'Reviews', 'About'],
    banner: {
      image: productDetailImages.gallery[0],
      headline: 'Healthy Smiles for Everyone',
      sub: 'Checkups at \u20B9499 · book in 30 seconds',
      cta: 'Book Appointment',
      gradient: ['#40c0a0', '#176b57'],
    },
    actionRow: { primary: 'Book Appointment', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Complete Checkup \u20B9499', sub: 'X-ray + cleaning included', image: productDetailImages.gallery[0], cta: 'Book' },
      { id: 'b2', title: 'Clear Aligners', sub: 'Free 3D scan consultation', image: productDetailImages.similar[0], cta: 'Enquire' },
    ],
    infoChips: ['Open Saturdays', 'EMI Available', 'Painless Dentistry'],
    serviceCategories: [
      { id: 'checkup', label: 'Checkups' },
      { id: 'cleaning', label: 'Cleaning' },
      { id: 'braces', label: 'Braces' },
      { id: 'implants', label: 'Implants' },
      { id: 'whitening', label: 'Whitening' },
    ],
    trendingServices: [
      { id: 's1', name: 'Dental Checkup + X-ray', duration: '30 min', price: 499 },
      { id: 's2', name: 'Scaling & Polishing', duration: '45 min', price: 1499 },
      { id: 's3', name: 'Teeth Whitening', duration: '60 min', price: 7999 },
      { id: 's4', name: 'Clear Aligner Plan', duration: '12 mo', price: 79999 },
    ],
    services: [
      { id: 'sv1', name: 'Dental Checkup + X-ray', duration: '30 min', price: 499, rating: '5.0' },
      { id: 'sv2', name: 'Scaling & Polishing', duration: '45 min', price: 1499 },
      { id: 'sv3', name: 'Root Canal (single)', duration: '90 min', price: 4999 },
      { id: 'sv4', name: 'Tooth Extraction', duration: '30 min', price: 999 },
      { id: 'sv5', name: 'Teeth Whitening', duration: '60 min', price: 7999 },
      { id: 'sv6', name: 'Clear Aligner Plan', duration: '12 mo', price: 79999, rating: '4.9' },
    ],
    avatar: sellerImages.avatar,
  },

  fluentfirst: {
    username: 'fluentfirst',
    name: 'FluentFirst Academy',
    tagline: 'Spoken English & interview prep',
    bio: 'Spoken English, communication and interview preparation with certified trainers. Personalised batches, small groups, real practice.',
    verified: false,
    rating: 4.7,
    reviews: '940 Reviews',
    archetype: 'service',
    stats: [
      { label: 'Students', value: '8.2k' },
      { label: 'Rating', value: '4.7' },
      { label: 'Batches', value: 'Live' },
    ],
    chips: [],
    tabLabels: ['Services', 'Reviews', 'About'],
    banner: {
      image: productDetailImages.similar[1],
      headline: 'Speak English With Confidence',
      sub: 'Live classes · mock interviews · certificates',
      cta: 'Enrol Now',
      gradient: ['#5fa8ef', '#1e4fb8'],
    },
    actionRow: { primary: 'Enrol Now', secondary: 'Message' },
    banners: [
      { id: 'b1', title: 'Free Demo Class', sub: 'Every Saturday 6 PM', image: productDetailImages.similar[1], cta: 'Register' },
      { id: 'b2', title: 'Interview Bootcamp', sub: '4 sessions · \u20B91,999', image: productDetailImages.gallery[1], cta: 'Enrol' },
    ],
    infoChips: ['Live Online', 'Certified Trainers', '1-on-1 Doubts'],
    serviceCategories: [
      { id: 'spoken', label: 'Spoken English' },
      { id: 'interviews', label: 'Interview Prep' },
      { id: 'business', label: 'Business English' },
      { id: 'kids', label: 'Kids English' },
    ],
    trendingServices: [
      { id: 's1', name: 'Spoken English (Monthly)', duration: '20 classes', price: 1999 },
      { id: 's2', name: 'Interview Bootcamp', duration: '4 sessions', price: 1999 },
      { id: 's3', name: 'Business English', duration: '15 classes', price: 2999 },
      { id: 's4', name: '1-on-1 Coaching', duration: '10 hrs', price: 4999 },
    ],
    services: [
      { id: 'sv1', name: 'Spoken English (Monthly)', duration: '20 classes', price: 1999, rating: '4.8' },
      { id: 'sv2', name: 'Interview Bootcamp', duration: '4 sessions', price: 1999 },
      { id: 'sv3', name: 'Business English', duration: '15 classes', price: 2999 },
      { id: 'sv4', name: 'Kids English (Ages 6-12)', duration: '12 classes', price: 2499 },
      { id: 'sv5', name: '1-on-1 Coaching', duration: '10 hrs', price: 4999 },
      { id: 'sv6', name: 'Pronunciation Lab', duration: '6 sessions', price: 1499 },
    ],
    avatar: sellerImages.avatar,
  },
};

export function getShopProfile(username: string | undefined): ShopProfile | undefined {
  if (!username) return undefined;
  return SHOP_PROFILES[username.toLowerCase()];
}

// ─── CATEGORY → ARCHETYPE ───────────────────────────────────────────────────
// Every main category (utils/categories.ts, 17 industries) maps to a storefront
// archetype so ANY seller gets the right store UI/UX for their category — no
// hand-seeded profile required. Unknown categories default to goods.
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
 * Build a storefront profile on the fly for a seller whose category is known
 * (from their posts) but who has no hand-seeded SHOP_PROFILES entry. The
 * profile follows the category's archetype so the store view renders the
 * category-specific UI (menu, services, jobs, listings, bulk, goods grid).
 * Posts are turned into deals so the storefront is never empty.
 */
export function generateShopProfile(
  username: string,
  category: string,
  name: string,
  posts: { id: string; description?: string; price?: number; image?: string; salaryRange?: string; jobType?: string; experience?: string; location?: string }[],
  categoryLabel?: string
): ShopProfile {
  const archetype = CATEGORY_ARCHETYPE[category] ?? 'goods';
  const accent = CATEGORY_COLORS[category] ?? '#5d5fef';
  const label = categoryLabel ?? category;

  // Zero-post sellers (new registrations, demo sellers without listings yet)
  // get an honest EMPTY storefront — no fake stats, no fake deals.
  if (posts.length === 0) {
    return {
      username,
      name: name || username,
      tagline: `${label} storefront`,
      bio: `${name || username} sells in ${label} on susej.`,
      verified: false,
      rating: 0,
      reviews: '0 Reviews',
      archetype: 'empty',
      stats: [
        { label: 'Products', value: '0' },
        { label: 'Followers', value: '0' },
        { label: 'Rating', value: '—' },
      ],
      chips: [],
      tabLabels: ['Products', 'About'],
      banner: {
        headline: name || username,
        sub: 'Fresh products coming soon',
        cta: 'Browse Feed',
        gradient: [accent, accent],
      },
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
    tag: 'New',
    image: p.image ? { uri: p.image } : undefined,
  }));

  // Map the seller's own posts into the archetype-specific lists so a
  // generated storefront is never empty for food/service/job/realestate/b2b.
  const titleOf = (p: (typeof posts)[number]) => (p.description || '').split('\n')[0] || 'New listing';
  const menu = posts.slice(0, 8).map((p, i) => ({
    id: p.id,
    name: titleOf(p),
    desc: (p.description || '').split('\n').slice(1).join(' ').slice(0, 60) || 'Fresh from the kitchen',
    price: p.price || 0,
    veg: true,
    tag: i === 0 ? 'Bestseller' : undefined,
    image: p.image ? { uri: p.image } : undefined,
  }));
  const services = posts.slice(0, 8).map((p, i) => ({
    id: p.id,
    name: titleOf(p),
    duration: '60 min',
    price: p.price || 0,
    rating: i === 0 ? '4.9' : undefined,
  }));
  const jobs = posts.slice(0, 8).map((p, i) => ({
    id: p.id,
    role: titleOf(p),
    type: p.jobType || 'Full-time',
    location: p.location || 'Remote',
    exp: p.experience || '2+ yrs',
    salary: p.salaryRange || `\u20B9${p.price || 12} LPA`,
    tags: ['Open', 'Apply today', i === 0 ? 'Hot' : 'New'],
  }));
  const listings = posts.slice(0, 6).map((p, i) => ({
    id: p.id,
    title: titleOf(p),
    price: p.price || 50,
    suffix: i % 2 === 0 ? 'L' : 'k/mo',
    locality: p.location || 'City Centre',
    beds: 2,
    baths: 2,
    sqft: 1200,
    tag: 'Verified',
    image: p.image ? { uri: p.image } : undefined,
  }));
  const bulkProducts = posts.slice(0, 8).map((p) => ({
    id: p.id,
    name: titleOf(p),
    desc: (p.description || '').split('\n').slice(1).join(' ').slice(0, 60) || 'Bulk supply available',
    price: p.price || 0,
    unit: '/pc',
    moq: 'MOQ 100 pcs',
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
    verified: false,
    rating: 4.8,
    reviews: '12 Reviews',
    archetype,
    stats: [
      { label: isJob ? 'Openings' : isService ? 'Services' : 'Products', value: String(Math.max(posts.length, 4)) },
      { label: 'Followers', value: '1.2k' },
      { label: 'Rating', value: '4.8' },
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
    banner: {
      headline: name || username,
      sub: isFood ? 'Order online · fresh & fast' : isService ? 'Book an appointment' : isJob ? 'Join the team' : isRealEstate ? 'Verified listings' : isB2B ? 'Bulk pricing available' : 'Browse the collection',
      cta: isFood ? 'Order Now' : isService ? 'Book Now' : isJob ? 'Apply Now' : isRealEstate ? 'Enquire' : isB2B ? 'Get Quote' : 'Shop Now',
      gradient: [accent, accent],
    },
    banners: [
      { id: 'g1', title: `Fresh in ${label}`, sub: 'New arrivals every week', cta: 'Shop' },
      { id: 'g2', title: 'Susej Verified Deal', sub: 'Trusted seller · secure checkout', cta: 'View' },
    ],
    actionRow: { primary: 'Follow', secondary: 'Message' },
    deals,
    menu: isFood ? menu : undefined,
    services: isService ? services : undefined,
    serviceCategories: isService
      ? [
          { id: 'all', label: 'All' },
          { id: 'featured', label: 'Featured' },
          { id: 'new', label: 'New' },
        ]
      : undefined,
    trendingServices: isService ? services.slice(0, 4) : undefined,
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
          { id: 'bulk', label: 'Bulk' },
        ]
      : undefined,
    avatar: undefined,
  };
}
