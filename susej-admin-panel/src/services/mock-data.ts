/**
 * Seed configuration arrays ONLY.
 *
 * This file used to contain hundreds of fake users/products/orders/etc.
 * All of that demo data is gone: every entity now lives in PostgreSQL and is
 * created through real app + admin flows. What remains are the platform
 * configuration values prisma/seed.ts provisions on a fresh deployment
 * (admin accounts, taxonomy, shipping config, coupon codes, commission).
 */

import type { AdminUser, Carrier, Category, CommissionSettings, Coupon, DeliveryZone } from "@/types";

export const mockAdmins: AdminUser[] = [
  { id: "admin_1", name: "Alex Rivera", loginId: "alexrivera", email: "alex@admin.com", password: "Admin@123", role: "super_admin", status: "active", createdAt: "2024-01-01" },
  { id: "admin_2", name: "Jordan Chen", loginId: "jordanchen", email: "jordan@admin.com", password: "Admin@123", role: "super_admin", status: "active", createdAt: "2024-02-15" },
  { id: "admin_3", name: "Sam Patel", loginId: "sampatel", email: "sam@admin.com", password: "Admin@123", role: "manager", status: "active", createdAt: "2024-03-10" },
  { id: "admin_4", name: "Taylor Kim", loginId: "taylorkim", email: "taylor@admin.com", password: "Admin@123", role: "manager", status: "active", createdAt: "2024-04-20" },
  { id: "admin_5", name: "Morgan Lee", loginId: "morganlee", email: "morgan@admin.com", password: "Admin@123", role: "manager", status: "inactive", createdAt: "2024-05-05" },
  { id: "admin_6", name: "Casey Johnson", loginId: "caseyjohnson", email: "casey@admin.com", password: "Admin@123", role: "moderator", status: "active", createdAt: "2024-06-01" },
  { id: "admin_7", name: "Riley Thompson", loginId: "rileythompson", email: "riley@admin.com", password: "Admin@123", role: "moderator", status: "active", createdAt: "2024-07-12" },
  { id: "admin_8", name: "Avery Garcia", loginId: "averygarcia", email: "avery@admin.com", password: "Admin@123", role: "moderator", status: "inactive", createdAt: "2024-08-25" },
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const categoryNames = [
  { id: "cat_1", name: "Fashion", icon: "fashion", parentId: null as string | null },
  { id: "cat_2", name: "Electronics", icon: "electronics", parentId: null },
  { id: "cat_3", name: "Home & Living", icon: "home", parentId: null },
  { id: "cat_4", name: "Beauty & Health", icon: "beauty", parentId: null },
  { id: "cat_5", name: "Food & Grocery", icon: "food", parentId: null },
  { id: "cat_6", name: "Sports & Fitness", icon: "sports", parentId: null },
  { id: "cat_7", name: "Automotive", icon: "automotive", parentId: null },
  { id: "cat_8", name: "Books & Education", icon: "books", parentId: null },
  { id: "cat_9", name: "Men's Fashion", icon: "mens-fashion", parentId: "cat_1" },
  { id: "cat_10", name: "Women's Fashion", icon: "womens-fashion", parentId: "cat_1" },
  { id: "cat_11", name: "Kids Fashion", icon: "kids-fashion", parentId: "cat_1" },
  { id: "cat_12", name: "Mobile Phones", icon: "mobile", parentId: "cat_2" },
  { id: "cat_13", name: "Laptops & Computers", icon: "laptops", parentId: "cat_2" },
  { id: "cat_14", name: "Audio & Headphones", icon: "audio", parentId: "cat_2" },
  { id: "cat_15", name: "Cameras", icon: "cameras", parentId: "cat_2" },
  { id: "cat_16", name: "Furniture", icon: "furniture", parentId: "cat_3" },
  { id: "cat_17", name: "Kitchen & Dining", icon: "kitchen", parentId: "cat_3" },
  { id: "cat_18", name: "Home Decor", icon: "decor", parentId: "cat_3" },
  { id: "cat_19", name: "T-Shirts", icon: "tshirts", parentId: "cat_9" },
  { id: "cat_20", name: "Formal Wear", icon: "formal", parentId: "cat_9" },
  { id: "cat_21", name: "Smartphones", icon: "smartphones", parentId: "cat_12" },
  { id: "cat_22", name: "Accessories", icon: "accessories", parentId: "cat_12" },
];

const categoryBannerUrls = [
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1542838132-92c53300491e?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=80",
];

export const mockCategories: Category[] = categoryNames.map((c, i) => ({
  id: c.id,
  name: c.name,
  slug: slugify(c.name),
  description: `All ${c.name.toLowerCase()} products in one place.`,
  parentId: c.parentId,
  sortOrder: i + 1,
  icon: c.icon,
  bannerImage: categoryBannerUrls[i % categoryBannerUrls.length],
  status: i < 18 ? "active" : "hidden",
  featured: i < 6,
  productCount: 0,
  metaTitle: `Buy ${c.name} Online - SUSEJ Marketplace`,
  metaDescription: `Shop the latest ${c.name.toLowerCase()} collection at SUSEJ.`,
  createdAt: new Date(Date.now() - (90 + i * 10) * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString(),
}));

export const mockCarriers: Carrier[] = [
  { id: "car_1", name: "FedEx", rate: 12.5, avgDeliveryDays: 3, onTimeRate: null, shipments: 0, active: true },
  { id: "car_2", name: "UPS", rate: 10.75, avgDeliveryDays: 3, onTimeRate: null, shipments: 0, active: true },
  { id: "car_3", name: "DHL", rate: 14.9, avgDeliveryDays: 2, onTimeRate: null, shipments: 0, active: true },
  { id: "car_4", name: "USPS", rate: 7.25, avgDeliveryDays: 5, onTimeRate: null, shipments: 0, active: true },
  { id: "car_5", name: "BlueDart", rate: 8.9, avgDeliveryDays: 4, onTimeRate: null, shipments: 0, active: false },
];

export const mockDeliveryZones: DeliveryZone[] = [
  { id: "zone_1", name: "Zone 1 - City Center", region: "Downtown", rate: 3.5, eta: "Same day", coverage: 100, active: true },
  { id: "zone_2", name: "Zone 2 - Suburbs", region: "Residential areas", rate: 5.0, eta: "1-2 days", coverage: 92, active: true },
  { id: "zone_3", name: "Zone 3 - Rural", region: "Outlying towns", rate: 8.5, eta: "3-5 days", coverage: 74, active: true },
  { id: "zone_4", name: "Zone 4 - Remote", region: "Far districts", rate: 12.0, eta: "5-7 days", coverage: 51, active: false },
];

export const mockCommissionSettings: CommissionSettings = {
  commissionRate: 8,
  listingFee: 0,
  payoutFee: 20,
  categoryOverrides: [
    { category: "Fashion", rate: 8 },
    { category: "Electronics", rate: 10 },
    { category: "Automobiles", rate: 6 },
    { category: "Food & Groceries", rate: 5 },
    { category: "Beauty", rate: 8 },
    { category: "Home Services", rate: 12 },
  ],
};

export const mockCoupons: Coupon[] = [
  { id: "c_1", code: "WELCOME20", type: "percentage", value: 20, usageLimit: 500, usedCount: 0, expiresAt: "2027-06-30", status: "active", createdAt: "2024-01-01" },
  { id: "c_2", code: "SELLER50", type: "fixed", value: 50, usageLimit: 200, usedCount: 0, expiresAt: "2027-03-15", status: "active", createdAt: "2024-03-01" },
  { id: "c_3", code: "PREMIUM25", type: "percentage", value: 25, usageLimit: 100, usedCount: 0, expiresAt: "2024-12-31", status: "expired", createdAt: "2024-06-01" },
  { id: "c_4", code: "FLASH30", type: "percentage", value: 30, usageLimit: 300, usedCount: 0, expiresAt: "2027-02-28", status: "active", createdAt: "2024-09-01" },
  { id: "c_5", code: "YEARLY100", type: "fixed", value: 100, usageLimit: 50, usedCount: 0, expiresAt: "2027-12-31", status: "active", createdAt: "2024-11-01" },
  { id: "c_6", code: "OLD10", type: "percentage", value: 10, usageLimit: 1000, usedCount: 0, expiresAt: "2024-06-30", status: "disabled", createdAt: "2023-06-01" },
];
