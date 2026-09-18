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

export type PromotionKind = 'topSeller' | 'hotDeal' | 'featuredPost' | 'spotlight';

/**
 * Publishing gate (single definition — every creation surface uses this).
 * Listing, reels, stories and live all require an APPROVED seller, matching
 * the server 403s. Local isSeller:true alone (set at application submit,
 * before any admin verdict) opens nothing. Logged-out users fail closed.
 */
export interface PublishIdentity {
  isSeller?: boolean | null;
  verification?: string | null;
}
export function isApprovedSeller(user: PublishIdentity | null | undefined): boolean {
  return !!user?.isSeller && user?.verification === 'approved';
}
/** Applied-for but not yet approved (or rejected): show status, not tools. */
export function sellerPendingReview(user: PublishIdentity | null | undefined): boolean {
  return !!user?.isSeller && user?.verification !== 'approved';
}

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
  {
    id: 'spotlight-24h',
    kind: 'spotlight',
    name: 'Feed Spotlight · 24 hours',
    desc: 'Your listing pinned at the very top of buyer feeds for 24 hours — the OLX Pin-to-Top.',
    price: 49,
    days: 1,
  },
];

export const PROMOTION_KIND_LABEL: Record<PromotionKind, string> = {
  topSeller: 'Top Seller Spotlight',
  hotDeal: 'Hot Deal',
  featuredPost: 'Boost Post',
  spotlight: 'Feed Spotlight',
};

export const PROMOTION_KIND_BLURB: Record<PromotionKind, string> = {
  topSeller: 'Sellers pay to be pinned in the Top Sellers rail buyers see on home.',
  hotDeal: 'Products pay to sit in the Hot Deals strip with an URGENT badge.',
  featuredPost: 'Posts pay to show as Sponsored in buyer feeds (IG boost model).',
  spotlight: 'Pin one listing to the very top of the buyer feed for a day — impulse-priced.',
};

const isPromoKind = (v: unknown): v is PromotionKind =>
  typeof v === 'string' && ['topSeller', 'hotDeal', 'featuredPost', 'spotlight'].includes(v);

/** Live catalog if the admin config arrived, else the local mirror. */
export const getPackages = (): PromoPackage[] => liveConfig?.packages ?? PROMO_PACKAGES;

export const getPackage = (packageId: string): PromoPackage | undefined =>
  getPackages().find((p) => p.id === packageId);

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
  /** Admin-managed promo catalog (prices editable on the admin Commission & Fees page). */
  packages: PromoPackage[] | null;
  /** Pinned-chat VAS pricing — also admin-editable. */
  chatPinPrice: number | null;
  chatPinDays: number | null;
}

let liveConfig: MarketplaceConfig | null = null;

function asRate(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value > 1 ? value / 100 : value;
}

export function getCommissionRate(): number {
  return liveConfig?.commissionRate ?? COMMISSION_RATE;
}

/** Seller net for delivered orders: sums the SETTLED per-line legs the server
 *  persisted at placement (netPrice + commission per line, category-aware).
 *  Falls back to base-rate math only for legacy rows predating settled legs.
 *  Refunded rows are EXCLUDED (clawed back — never earnings, exactly like the
 *  server payout guard). Dispute-frozen rows are EXCLUDED too (locked until
 *  ruling — the wallet discloses them separately; counting them as earned
 *  showed sellers frozen money as spendable on hub + seller-orders).
 *  SINGLE definition: every seller surface (hub, dashboard, seller-orders,
 *  wallet) must use this — three hardcoded variants previously disagreed on
 *  identical orders, and a re-derived flat rate disagreed with the server
 *  whenever admin category overrides exist. */
export function sellerNetForOrders(
  orders: {
    status: string;
    paymentStatus?: string;
    disputeFrozen?: boolean;
    items: {
      price: number;
      quantity: number;
      netPrice?: number;
      commission?: number;
    }[];
  }[],
  // Set for the wallet's frozen-bucket math (it partitions frozen OUT of the
  // headline itself — the shared exclusion would zero its frozen buckets).
  opts?: { includeFrozen?: boolean }
): number {
  const rate = getCommissionRate();
  const allowFrozen = opts?.includeFrozen === true;
  return orders
    .filter((o) => o.status === 'delivered' && o.paymentStatus !== 'refunded' && (allowFrozen || !o.disputeFrozen))
    .reduce((sum, o) => {
      const net = o.items.reduce((t, i) => {
        const qty = Math.max(1, Math.round(Number(i.quantity ?? 1)));
        const unitNet = Number(i.netPrice ?? i.price ?? 0);
        if (typeof i.commission === 'number' && Number.isFinite(i.commission)) {
          return t + Math.max(0, unitNet * qty - Math.max(0, Math.round(i.commission)));
        }
        return t + Math.round(unitNet * qty * (1 - rate));
      }, 0);
      return sum + Math.max(0, Math.round(net));
    }, 0);
}

/** Seller goods basis for delivered orders (pre-commission merchandise,
 *  price×qty per line). Single definition with sellerNetForOrders: the wallet
 *  used to re-filter/re-sum inline, so the next status-vocab or freeze-rule
 *  change had to land in two places. Refunded rows excluded, same as net. */
export function sellerGoodsForOrders(
  orders: {
    status: string;
    paymentStatus?: string;
    items: { price: number; quantity: number }[];
  }[]
): number {
  return orders
    .filter((o) => o.status === 'delivered' && o.paymentStatus !== 'refunded')
    .reduce((s, o) => s + o.items.reduce((t, i) => t + i.price * i.quantity, 0), 0);
}

export function getListingFee(): number {
  return liveConfig?.listingFee ?? 0;
}

export function getPayoutFee(): number {
  return liveConfig?.payoutFee ?? PAYOUT_FEE;
}

/** Chat-pin SKU price/days as configured by the admin (defaults: Rs79 / 7 days). */
export const DEFAULT_CHAT_PIN_PRICE = 79;
export const DEFAULT_CHAT_PIN_DAYS = 7;

export function getChatPinPrice(): number {
  return liveConfig?.chatPinPrice ?? DEFAULT_CHAT_PIN_PRICE;
}

export function getChatPinDays(): number {
  return liveConfig?.chatPinDays ?? DEFAULT_CHAT_PIN_DAYS;
}

/**
 * Pull the live Commission & Fees config from the admin panel once per
 * session; keep the local constants on failure so the app never blocks.
 * Subsequent calls return the cached (or default) config synchronously.
 */
export async function loadMarketplaceConfig(force = false): Promise<MarketplaceConfig> {
  if (liveConfig && !force) return liveConfig;
  const fallback: MarketplaceConfig = {
    commissionRate: COMMISSION_RATE,
    listingFee: 0,
    payoutFee: PAYOUT_FEE,
    categoryOverrides: [],
    packages: null,
    chatPinPrice: null,
    chatPinDays: null,
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
      let packages: PromoPackage[] | null = null;
      if (Array.isArray(data?.promotions)) {
        const parsed: PromoPackage[] = [];
        for (const raw of data.promotions as unknown[]) {
          const p = raw as Partial<PromoPackage> & { description?: string };
          if (typeof p?.id !== 'string' || !isPromoKind(p.kind) || typeof p.price !== 'number') continue;
          parsed.push({
            id: p.id,
            kind: p.kind,
            name: typeof p.name === 'string' ? p.name : p.id,
            desc:
              typeof p.desc === 'string'
                ? p.desc
                : typeof p.description === 'string'
                  ? p.description
                  : '',
            price: Math.max(0, Math.round(p.price)),
            days: typeof p.days === 'number' && p.days >= 1 ? Math.round(p.days) : 1,
          });
        }
        if (parsed.length > 0) packages = parsed;
      }
      const pinRaw = data?.chatPin as { price?: unknown; days?: unknown } | undefined;
      const chatPinPrice =
        typeof pinRaw?.price === 'number' && pinRaw.price >= 0 ? Math.round(pinRaw.price) : null;
      const chatPinDays = typeof pinRaw?.days === 'number' && pinRaw.days >= 1 ? Math.round(pinRaw.days) : null;
      if (c && typeof c.commissionRate === 'number') {
        liveConfig = {
          commissionRate: asRate(c.commissionRate, COMMISSION_RATE),
          listingFee: Number(c.listingFee) || 0,
          payoutFee: Number(c.payoutFee) || PAYOUT_FEE,
          categoryOverrides: Array.isArray(c.categoryOverrides) ? c.categoryOverrides : [],
          packages,
          chatPinPrice,
          chatPinDays,
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
