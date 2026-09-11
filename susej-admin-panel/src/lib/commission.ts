/**
 * Marketplace commission resolution shared by the order placement and
 * order-lifecycle routes. Reads the global CommissionSetting row; when no
 * row exists yet (fresh deploy before an admin saves settings) we fall back
 * to a single documented constant instead of silently guessing per call.
 */
export const COMMISSION_FALLBACK_PERCENT = 8;

type CommissionReader = {
  commissionSetting: {
    findUnique(args: { where: { id: string } }): Promise<{ commissionRate: number } | null>;
  };
};

/**
 * Normalize a stored commission value to a fraction. The ONLY writer is the
 * admin UI, which labels the field (%) and clamps 0-30 — so every stored
 * value is a percent, including sub-1 values (0.5 typed by an admin means
 * 0.5%, and the UI displays it back as "0.5%"). Treating (0,1) as fractions
 * turned that into 50%. No genuine-fraction rows exist (seed is 8 = percent).
 */
export function normalizeCommissionRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 1) return value / 100; // 1 -> 1%, 0.5 -> 0.5%, never 100%
  return Math.min(value / 100, 1); // percent 1.01..100+
}

/** Commission as a fraction: 8 (percent) -> 0.08. */
export async function resolveCommissionRate(db: CommissionReader, category?: string | null): Promise<number> {
  const setting = await (db as unknown as {
    commissionSetting: {
      findUnique(args: { where: { id: string } }): Promise<{ commissionRate: number; categoryOverrides?: unknown } | null>;
    };
  }).commissionSetting.findUnique({ where: { id: "global" } });
  if (!setting) return normalizeCommissionRate(COMMISSION_FALLBACK_PERCENT);
  const cat = (category ?? "").trim().toLowerCase();
  if (cat && Array.isArray(setting.categoryOverrides)) {
    const hit = (setting.categoryOverrides as Array<{ category?: unknown; rate?: unknown }>).find(
      (o) => String(o?.category ?? "").trim().toLowerCase() === cat
    );
    const rate = Number(hit?.rate);
    if (Number.isFinite(rate) && rate > 0) return normalizeCommissionRate(rate);
  }
  return normalizeCommissionRate(setting.commissionRate);
}

/**
 * Sum of per-line commission legs persisted at placement (category-aware).
 * Returns null when the order predates settled legs — callers fall back to
 * the global rate. Central helper so placement, COD settlement, clawbacks
 * and dispute rulings can never disagree on what was taken.
 */
export function settledFeeFromLegs(itemsList: unknown): number | null {
  try {
    const list = itemsList as Array<{ commission?: unknown }> | null;
    if (!Array.isArray(list) || !list.length) return null;
    if (!list.some((l) => typeof l?.commission === "number")) return null;
    return list.reduce(
      (s, l) =>
        s + (typeof l?.commission === "number" && Number.isFinite(l.commission) ? Math.max(0, Math.round(l.commission)) : 0),
      0
    );
  } catch {
    return null;
  }
}

/** Line shape stored in Order.itemsList (Json). */
export interface SettledLine {
  price?: unknown;
  netPrice?: unknown;
  qty?: unknown;
  quantity?: unknown;
}

/**
 * Settlement goods basis: SUM((netPrice ?? price) x qty). netPrice carries
 * the coupon-discounted line value persisted at placement, so clawbacks, COD
 * credits and dispute rulings settle on what the buyer actually paid — never
 * the pre-discount receipt figure. Rows predating netPrice fall back to
 * price, exactly as before. Returns NaN when unusable; callers fall back to
 * the order amount.
 */
export function settlementGoodsBasis(itemsList: unknown): number {
  try {
    const list = itemsList as SettledLine[];
    if (!Array.isArray(list) || !list.length) return NaN;
    return list.reduce((s, i) => {
      const unit = Number(i?.netPrice ?? i?.price ?? 0);
      const q = Math.max(1, Math.round(Number(i?.qty ?? i?.quantity ?? 1)));
      return s + unit * q;
    }, 0);
  } catch {
    return NaN;
  }
}
