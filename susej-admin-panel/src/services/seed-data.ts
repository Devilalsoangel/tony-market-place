/**
 * SUSEJ config seed data — PRISMA SEED USE ONLY (`prisma/seed.ts`).
 *
 * Config-only rows for a fresh deployment (admins, taxonomy, carriers,
 * coupons, commission). NO demo people/products/orders/reviews/messages —
 * all user-owned data comes from real app/admin flows.
 *
 * Never import this file into client bundles or request-time server code:
 * it exists solely so `prisma db seed` is reproducible. Previously named
 * `mock-data.ts`; renamed because nothing here is mock — every row is
 * production configuration.
 */

export interface SeedAdmin {
  id: string;
  name: string;
  loginId: string;
  email: string;
  /** Plaintext seed secret ONLY — hashed by seed.ts before insert. Omit to
   *  use the documented default rotation flow (change on first login). */
  password?: string;
  role: string;
  status: string;
}

export const seedAdmins: SeedAdmin[] = [
  {
    id: "adm_alexrivera",
    name: "Alex Rivera",
    loginId: "alexrivera",
    email: "alexrivera@susej.com",
    role: "super_admin",
    status: "active",
  },
  {
    id: "adm_manager",
    name: "Shop Manager",
    loginId: "manager",
    email: "manager@susej.com",
    role: "manager",
    status: "active",
  },
];

export interface SeedCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  sortOrder: number;
  icon: string;
  bannerImage: string;
  status: string;
  featured: boolean;
  metaTitle: string;
  metaDescription: string;
  createdAt: string;
}

const CATS: Array<[string, string, string]> = [
  ["Fashion", "fashion", "Clothing, footwear and accessories"],
  ["Electronics", "electronics", "Phones, gadgets and appliances"],
  ["Home & Living", "home-living", "Furniture, decor and kitchen"],
  ["Beauty", "beauty", "Skincare, makeup and grooming"],
  ["Grocery", "grocery", "Food staples and daily needs"],
  ["Sports", "sports", "Fitness and outdoor gear"],
  ["Toys", "toys", "Toys, games and kids essentials"],
  ["Books", "books", "Books, stationery and study material"],
  ["Automotive", "automotive", "Vehicle parts and accessories"],
  ["Health", "health", "Wellness and personal care"],
  ["Jewellery", "jewellery", "Fashion and fine jewellery"],
  ["Footwear", "footwear", "Shoes for every occasion"],
  ["Furniture", "furniture", "Home and office furniture"],
  ["Garden", "garden", "Plants and gardening supplies"],
  ["Pet Supplies", "pet-supplies", "Food and care for pets"],
  ["Services", "services", "Local professional services"],
  ["Medical", "medical", "Pharmacy and medical supplies"],
];

export const seedCategories: SeedCategory[] = CATS.map(([name, slug, description], i) => ({
  id: `cat_${slug}`,
  name,
  slug,
  description,
  parentId: null,
  sortOrder: i + 1,
  icon: slug,
  // Real banners are uploaded from the admin desk — never hotlinked.
  bannerImage: "",
  status: "active",
  featured: i < 6,
  metaTitle: `${name} — susej Marketplace`,
  metaDescription: description,
  createdAt: "2024-01-01",
}));

export interface SeedCarrier {
  id: string;
  name: string;
  rate: number;
  avgDeliveryDays: number;
  onTimeRate: number | null;
  shipments: number;
  active: boolean;
}

export const seedCarriers: SeedCarrier[] = [
  { id: "car_delhivery", name: "Delhivery", rate: 49, avgDeliveryDays: 4, onTimeRate: null, shipments: 0, active: true },
  { id: "car_ecom", name: "Ecom Express", rate: 45, avgDeliveryDays: 5, onTimeRate: null, shipments: 0, active: true },
  { id: "car_bluedart", name: "BlueDart", rate: 79, avgDeliveryDays: 3, onTimeRate: null, shipments: 0, active: true },
  { id: "car_indiapost", name: "India Post", rate: 35, avgDeliveryDays: 7, onTimeRate: null, shipments: 0, active: true },
  { id: "car_xpressbees", name: "XpressBees", rate: 42, avgDeliveryDays: 4, onTimeRate: null, shipments: 0, active: true },
];

export interface SeedDeliveryZone {
  id: string;
  name: string;
  region: string;
  rate: number;
  eta: string;
  coverage: number;
  active: boolean;
}

export const seedDeliveryZones: SeedDeliveryZone[] = [
  { id: "zone_metro", name: "Metro Cities", region: "Delhi NCR, Mumbai, Bengaluru, Chennai, Hyderabad, Kolkata", rate: 29, eta: "2-3 days", coverage: 6, active: true },
  { id: "zone_tier1", name: "Tier-1 Cities", region: "Ahmedabad, Pune, Jaipur, Surat, Lucknow + 40 more", rate: 39, eta: "3-4 days", coverage: 46, active: true },
  { id: "zone_rest", name: "Rest of India", region: "All remaining serviceable pincodes", rate: 49, eta: "4-7 days", coverage: 19000, active: true },
];

export interface SeedCoupon {
  id: string;
  code: string;
  type: string;
  value: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  status: string;
  createdAt: string;
}

export const seedCoupons: SeedCoupon[] = [
  {
    id: "cpn_welcome10",
    code: "WELCOME10",
    type: "percent",
    value: 10,
    usageLimit: 10000,
    usedCount: 0,
    expiresAt: "2030-01-01",
    status: "active",
    createdAt: "2024-01-01",
  },
  {
    id: "cpn_flat50",
    code: "FLAT50",
    type: "flat",
    value: 50,
    usageLimit: 5000,
    usedCount: 0,
    expiresAt: "2030-01-01",
    status: "active",
    createdAt: "2024-01-01",
  },
];

export interface SeedCommissionSettings {
  commissionRate: number;
  listingFee: number;
  payoutFee: number;
  categoryOverrides: Array<{ category: string; rate: number }>;
}

export const seedCommissionSettings: SeedCommissionSettings = {
  commissionRate: 8,
  listingFee: 0,
  payoutFee: 20,
  categoryOverrides: [],
};
