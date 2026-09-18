// Redeemed loyalty coupons — the real bridge between app/loyalty.tsx redemption
// and cart/checkout acceptance. A redeemed coupon is usable exactly once: it is
// removed from storage only after the order that used it is placed successfully.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const REDEEMED_COUPONS_KEY = '@susej_redeemed_coupons';
export const REDEEMED_COUPONS_KEY_BASE = REDEEMED_COUPONS_KEY;
export const APPLIED_PROMO_KEY = '@susej_applied_promo';
export const APPLIED_PROMO_KEY_BASE = APPLIED_PROMO_KEY;

async function getPerUserKey(base: string): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('app_user');
    if (raw) {
      const u = JSON.parse(raw) as { username?: string };
      const name = typeof u?.username === 'string' ? u.username.trim() : '';
      if (name) return `${base}:${name}`;
    }
  } catch {}
  return base;
}

async function readWithMigration(base: string): Promise<string | null> {
  const per = await getPerUserKey(base);
  try {
    const v = await AsyncStorage.getItem(per);
    if (v !== null) return v;
    if (per !== base) {
      const legacy = await AsyncStorage.getItem(base);
      if (legacy !== null) {
        try { await AsyncStorage.setItem(per, legacy); } catch {}
        return legacy;
      }
    }
  } catch {}
  return null;
}

export interface RedeemedCoupon {
  code: string;
  rewardTitle: string;
  /** Rupees off the subtotal — mirrors the reward tier that was paid in points. */
  discountFlat?: number;
  /** Reward grants free delivery instead of a rupee amount. */
  freeDelivery?: boolean;
  redeemedAt: number;
}

/** Snapshot handed from cart to checkout so both screens total identically. */
export interface AppliedPromo {
  code: string;
  amount: number;
  freeDelivery?: boolean;
  /** Coupon face type/value (percent|flat|fixed|free_delivery) for server-mirror previews. */
  kind?: string;
  value?: number;
  /** true when the code came from @susej_redeemed_coupons (consumed on use). */
  redeemed?: boolean;
}

/**
 * Server-mirror discount preview (orders route): percent applies to
 * subtotal+delivery, flat/fixed is rupees off, free_delivery zeroes the fee.
 * Capped at base−1 like the server (totals stay > 0). The server remains
 * truth at placement — this is the buyer's pre-Pay estimate, computed by the
 * SAME formula on both cart and checkout so the two screens never disagree.
 */
export function previewDiscount(
  subtotal: number,
  delivery: number,
  promo: AppliedPromo | null,
  offerMode = false
): number {
  if (!promo || offerMode) return 0;
  const base = Math.round(subtotal) + Math.round(delivery);
  if (!(base > 1)) return 0;
  let discount = 0;
  if (promo.freeDelivery || promo.kind === 'free_delivery') {
    discount = Math.round(delivery);
  } else if ((promo.kind === 'percent' || promo.kind === 'percentage') && typeof promo.value === 'number') {
    // Desk parity: the server clamps effective percent at 90 — mirror it or
    // a 100%-off coupon previews ₹1 and charges 10% of base.
    discount = Math.round((base * Math.min(promo.value, 90)) / 100);
  } else if ((promo.kind === 'flat' || promo.kind === 'fixed') && typeof promo.value === 'number') {
    discount = Math.round(promo.value);
  } else {
    discount = Math.max(0, Math.round(promo.amount));
  }
  return Math.max(0, Math.min(discount, base - 1));
}

export async function getRedeemedCoupons(): Promise<RedeemedCoupon[]> {
  try {
    const raw = await readWithMigration(REDEEMED_COUPONS_KEY_BASE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => c && typeof c.code === 'string') : [];
  } catch {
    return [];
  }
}

export async function addRedeemedCoupon(coupon: RedeemedCoupon): Promise<void> {
  const list = await getRedeemedCoupons();
  list.unshift(coupon);
  const key = await getPerUserKey(REDEEMED_COUPONS_KEY_BASE);
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

/** Consumes a coupon exactly once (idempotent by code). */
export async function consumeRedeemedCoupon(code: string): Promise<void> {
  const list = await getRedeemedCoupons();
  const next = list.filter((c) => c.code !== code);
  const key = await getPerUserKey(REDEEMED_COUPONS_KEY_BASE);
  await AsyncStorage.setItem(key, JSON.stringify(next));
}

export async function getAppliedPromo(): Promise<AppliedPromo | null> {
  try {
    const raw = await readWithMigration(APPLIED_PROMO_KEY_BASE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.code === 'string' && typeof parsed.amount === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export async function setAppliedPromo(promo: AppliedPromo): Promise<void> {
  const key = await getPerUserKey(APPLIED_PROMO_KEY_BASE);
  await AsyncStorage.setItem(key, JSON.stringify(promo));
}

export async function clearAppliedPromo(): Promise<void> {
  const key = await getPerUserKey(APPLIED_PROMO_KEY_BASE);
  await AsyncStorage.removeItem(key);
}
