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
  /** true when the code came from @susej_redeemed_coupons (consumed on use). */
  redeemed?: boolean;
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
