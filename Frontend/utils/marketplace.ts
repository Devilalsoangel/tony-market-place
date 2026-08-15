// Shared marketplace monetization constants — MUST mirror susej-admin-panel:
//   - PROMO_PACKAGES matches src/lib/promotions/catalog.ts (PromotionPackage list)
//   - COMMISSION_RATE / PAYOUT_FEE match the admin Commission & Fees page
// Vocab: promotion kinds topSeller | hotDeal | featuredPost; statuses
// pending_payment | active | expired | refunded (same as PromotionPurchase).
//
// The admin panel is the source of truth: loadMarketplaceConfig() pulls the
// live Commission & Fees + promo catalog from /api/v1/config (x-app-key) and
// the getters below fall back to the local constants while offline.

import { getAdminUrl, getAppKey } from './adminSync';

export type PromotionKind = 'topSeller' | 'hotDeal' | 'featuredPost';

export interface PromoPackage {
  id: string;
  kind: PromotionKind;
  name: string;
  desc: string;
  price: number;
  days: number;
}

export const PROMO_PACKAGES: PromoPackage[] = [
  {
    id: 'top-seller-30',
    kind: 'topSeller',
    name: 'Top Seller Spotlight · 30 days',
    desc: 'Pinned in the home Top Sellers rail for 30 days — the OLX top-ad slot.',
    price: 1999,
    days: 30,
  },
  {
    id: 'top-seller-7',
    kind: 'topSeller',
    name: 'Top Seller Spotlight · 7 days',
    desc: 'Shown first in the home Top Sellers rail for 7 days.',
    price: 599,
    days: 7,
  },
  {
    id: 'hot-deal-30',
    kind: 'hotDeal',
    name: 'Hot Deal · 30 days',
    desc: 'Your product pinned in the Hot Deals section with an URGENT badge for 30 days.',
    price: 1499,
    days: 30,
  },
  {
    id: 'hot-deal-7',
    kind: 'hotDeal',
    name: 'Hot Deal · 7 days',
    desc: 'Listed in Hot Deals with an URGENT badge for 7 days — like an OLX urgent tag.',
    price: 499,
    days: 7,
  },
  {
    id: 'featured-post-30',
    kind: 'featuredPost',
    name: 'Boost Post · 30 days',
    desc: 'Your listing shown as Sponsored in buyer feeds for 30 days — the IG boost.',
    price: 999,
    days: 30,
  },
  {
    id: 'featured-post-7',
    kind: 'featuredPost',
    name: 'Boost Post · 7 days',
    desc: 'Sponsored placement in buyer feeds for 7 days.',
    price: 349,
    days: 7,
  },
];

export const PROMOTION_KIND_LABEL: Record<PromotionKind, string> = {
  topSeller: 'Top Seller Spotlight',
  hotDeal: 'Hot Deal',
  featuredPost: 'Boost Post',
};

export const PROMOTION_KIND_BLURB: Record<PromotionKind, string> = {
  topSeller: 'Sellers pay to be pinned in the Top Sellers rail buyers see on home.',
  hotDeal: 'Products pay to sit in the Hot Deals strip with an URGENT badge.',
  featuredPost: 'Posts pay to show as Sponsored in buyer feeds (IG boost model).',
};

export const getPackage = (packageId: string): PromoPackage | undefined =>
  PROMO_PACKAGES.find((p) => p.id === packageId);

/** Platform commission on every delivered order (mirrors admin Commission & Fees). */
export const COMMISSION_RATE = 0.08;

/** Flat fee per bank withdrawal (mirrors admin Commission & Fees). */
export const PAYOUT_FEE = 20;

// ─── Live config (admin panel is the source of truth) ─────────────────────

export interface MarketplaceConfig {
  commissionRate: number;
  listingFee: number;
  payoutFee: number;
  categoryOverrides: { category: string; rate: number }[];
}

let liveConfig: MarketplaceConfig | null = null;

export function getCommissionRate(): number {
  return liveConfig?.commissionRate ?? COMMISSION_RATE;
}

export function getListingFee(): number {
  return liveConfig?.listingFee ?? 0;
}

export function getPayoutFee(): number {
  return liveConfig?.payoutFee ?? PAYOUT_FEE;
}

/**
 * Pull the live Commission & Fees config from the admin panel once per
 * session; keep the local constants on failure so the app never blocks.
 * Subsequent calls return the cached (or default) config synchronously.
 */
export async function loadMarketplaceConfig(): Promise<MarketplaceConfig> {
  if (liveConfig) return liveConfig;
  const fallback: MarketplaceConfig = {
    commissionRate: COMMISSION_RATE,
    listingFee: 0,
    payoutFee: PAYOUT_FEE,
    categoryOverrides: [],
  };
  try {
    const [base, key] = await Promise.all([getAdminUrl(), getAppKey()]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${base}/api/v1/config`, {
      headers: { 'x-app-key': key },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const c = data?.commission;
      if (c && typeof c.commissionRate === 'number') {
        liveConfig = {
          commissionRate: c.commissionRate,
          listingFee: Number(c.listingFee) || 0,
          payoutFee: Number(c.payoutFee) || PAYOUT_FEE,
          categoryOverrides: Array.isArray(c.categoryOverrides) ? c.categoryOverrides : [],
        };
      }
    }
  } catch {
    // offline / server down — local constants win
  }
  return liveConfig ?? fallback;
}

/** Invalidate the cached config (e.g. after the admin URL changes). */
export function resetMarketplaceConfig() {
  liveConfig = null;
}
