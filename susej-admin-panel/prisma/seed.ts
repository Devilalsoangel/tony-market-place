/**
 * SUSEJ admin database seeder - CONFIG ONLY.
 *
 * This seeder intentionally creates NO demo people, products, orders,
 * reviews, messages or activity. All user-owned data is produced by real
 * flows (mobile app APIs + admin UI actions) and lives in PostgreSQL.
 *
 * What it provisions on a fresh deployment (idempotent - safe to re-run):
 *   - Admin accounts (panel login)
 *   - Categories (marketplace taxonomy)
 *   - Shipping carriers + delivery zones (operational config)
 *   - Coupons (shared with the mobile app cart)
 *   - App settings (site identity + platform rate)
 *   - Global commission settings (marketplace take-rate)
 *
 * It NEVER deletes existing rows - running it against a live database is safe.
 */

import { randomBytes, scryptSync } from "node:crypto";
import type { Prisma } from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/db";
import {
  mockAdmins,
  mockCategories,
  mockCoupons,
  mockCarriers,
  mockDeliveryZones,
  mockCommissionSettings,
} from "../src/services/mock-data";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function toDate(value: string): Date {
  const t = Date.parse(value);
  return Number.isNaN(t) ? new Date() : new Date(t);
}

function jx<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

async function main() {
  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error("Database unavailable - cannot seed.");
  }

  console.log("Seeding config (no demo data)...");

  // ---- Admin accounts ----

  for (const a of mockAdmins) {
    const twoFactorEnabled = a.loginId === "alexrivera";
    await prisma.admin.upsert({
      where: { loginId: a.loginId },
      update: {},
      create: {
        id: a.id,
        name: a.name,
        loginId: a.loginId,
        email: a.email,
        passwordHash: hashPassword(a.password ?? "Admin@123"),
        role: a.role,
        status: a.status,
        twoFactorEnabled,
        twoFactorCode: twoFactorEnabled ? hashPassword("123456") : null,
        createdAt: toDate("2024-01-01"),
      },
    });
  }
  console.log(`admins: ${mockAdmins.length}`);

  // ---- Marketplace taxonomy ----

  let categoryCount = 0;
  for (const c of mockCategories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        parentId: c.parentId,
        sortOrder: c.sortOrder,
        icon: c.icon,
        bannerImage: c.bannerImage,
        status: c.status,
        featured: c.featured,
        productCount: 0,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
        createdAt: toDate(c.createdAt),
      },
    });
    categoryCount += 1;
  }
  console.log(`categories: ${categoryCount}`);

  // ---- Shipping configuration ----

  for (const c of mockCarriers) {
    await prisma.carrier.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }
  console.log(`carriers: ${mockCarriers.length}`);

  for (const z of mockDeliveryZones) {
    await prisma.deliveryZone.upsert({
      where: { id: z.id },
      update: {},
      create: z,
    });
  }
  console.log(`delivery zones: ${mockDeliveryZones.length}`);

  // ---- Coupons (codes shared with the mobile app cart) ----

  for (const c of mockCoupons) {
    await prisma.coupon.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        code: c.code,
        type: c.type,
        value: c.value,
        usageLimit: c.usageLimit,
        usedCount: c.usedCount,
        expiresAt: toDate(c.expiresAt),
        status: c.status,
        createdAt: toDate(c.createdAt),
      },
    });
  }
  console.log(`coupons: ${mockCoupons.length}`);

  // ---- Site settings (identity + economics only - no fabricated metrics) ----

  const settingKeys = ["siteName", "defaultLanguage", "currency", "timezone", "supportEmail", "platformRatePercent"];
  const existingSettings = await prisma.appSetting.findMany({ where: { key: { in: settingKeys } } });
  const present = new Set(existingSettings.map((s) => s.key));
  const missing: { key: string; value: string | number }[] = [];
  const add = (key: string, value: string | number) => {
    if (!present.has(key)) missing.push({ key, value });
  };
  add("siteName", "SUSEJ Marketplace");
  add("defaultLanguage", "en");
  add("currency", "inr");
  add("timezone", "utc");
  add("supportEmail", "support@susej.com");
  add("platformRatePercent", 2.9);
  if (missing.length > 0) {
    await prisma.appSetting.createMany({ data: missing });
  }
  console.log(`app settings: ${present.size + missing.length} (core keys)`);

  // ---- Global commission ----

  await prisma.commissionSetting.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      commissionRate: mockCommissionSettings.commissionRate,
      listingFee: mockCommissionSettings.listingFee,
      payoutFee: mockCommissionSettings.payoutFee,
      categoryOverrides: jx(mockCommissionSettings.categoryOverrides),
    },
  });
  console.log("commission settings: 1");

  console.log("Config seed complete. All other data comes from real app/admin flows.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = await getPrisma();
    if (prisma) await prisma.$disconnect();
  });
