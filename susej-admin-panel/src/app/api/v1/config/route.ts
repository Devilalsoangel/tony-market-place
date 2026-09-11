import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { getPrisma } from "@/lib/db";
import {
  PROMOTION_PACKAGES,
  applyPriceOverrides,
  getChatPinPrice,
  DEFAULT_CHAT_PIN,
} from "@/lib/promotions/catalog";

/**
 * Public marketplace config for the mobile app (x-app-key guarded).
 * The app pulls live commission / fees / promo catalog from the admin DB so
 * seller-facing numbers (wallet commission, payout fees) always match the
 * admin Commission & Fees page instead of hardcoded mirrors.
 */

const FALLBACK = {
  commissionRate: 0.08,
  listingFee: 0,
  payoutFee: 20,
  categoryOverrides: [] as { category: string; rate: number }[],
};

/** The DB stores rates as whole percents (8 = 8%); the app expects fractions (0.08). */
function asRate(n: number): number {
  return n >= 1 ? n / 100 : n;
}

export async function GET(request: NextRequest) {
  if (!checkAppKey(request)) return unauthorized();

  let commission = FALLBACK;
  let priceOverrides: Record<string, unknown> | null = null;
  const prisma = await getPrisma();
  if (prisma) {
    try {
      const row = await prisma.commissionSetting.findUnique({ where: { id: "global" } });
      if (row) {
        const overrides = Array.isArray(row.categoryOverrides)
          ? (row.categoryOverrides as { category?: string; rate?: number }[])
              .filter((o) => o && typeof o.category === "string")
              .map((o) => ({ category: o.category as string, rate: Number(o.rate) || 0 }))
          : [];
        commission = {
          commissionRate: asRate(Number(row.commissionRate) || FALLBACK.commissionRate),
          listingFee: Number(row.listingFee) || FALLBACK.listingFee,
          payoutFee: Number(row.payoutFee) || FALLBACK.payoutFee,
          categoryOverrides: overrides.map((o) => ({ category: o.category, rate: asRate(o.rate) })),
        };
      }
      // Admin-managed promo/chat-pin pricing (Commission & Fees page edits this).
      const setting = await prisma.appSetting.findUnique({ where: { key: "promoPrices" } });
      const value = setting?.value;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        priceOverrides = value as Record<string, unknown>;
      }
    } catch {
      // DB hiccup — fall back to defaults below
    }
  }

  const packages = applyPriceOverrides(priceOverrides);

  return NextResponse.json({
    commission,
    promotions: packages.map((p) => ({
      id: p.id,
      kind: p.kind,
      name: p.name,
      description: p.description,
      price: p.price,
      days: p.durationDays,
    })),
    chatPin: {
      price: getChatPinPrice(priceOverrides),
      days: DEFAULT_CHAT_PIN.days,
    },
  });
}