"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch, apiPost } from "@/lib/api-mutate";
import { Percent, Trash2, Plus, Save, IndianRupee, Wallet, Megaphone } from "lucide-react";
import type { CommissionSettings, Order, PromotionPurchase, WithdrawalRequest } from "@/types";
import { PROMOTION_PACKAGES, DEFAULT_CHAT_PIN } from "@/lib/promotions/catalog";
import { settledFeeFromLegs, settlementGoodsBasis } from "@/lib/commission";

// susej is an Indian marketplace — all fees/commissions are INR.
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Code defaults the editable pricing UI starts from (catalog is the base). */
const PRICING_DEFAULTS: { id: string; name: string; slot: string; price: number }[] = [
  ...PROMOTION_PACKAGES.map((p) => ({
    id: p.id,
    name: p.name,
    slot: p.description,
    price: p.price,
  })),
  {
    id: "chatPin",
    name: "Pinned Chat · 7 days",
    slot: "Seller chat pinned to the top of the buyer's inbox",
    price: DEFAULT_CHAT_PIN.price,
  },
];

type PriceMap = Record<string, string>;

/** Persisted shape in AppSetting("promoPrices"): only values that differ from code defaults. */
function extractOverrides(prices: PriceMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of PRICING_DEFAULTS) {
    const v = Number(prices[d.id]);
    if (Number.isFinite(v) && v >= 0 && Math.round(v) !== d.price) out[d.id] = Math.round(v);
  }
  return out;
}

async function persistPromoPrices(overrides: Record<string, number>) {
  try {
    await apiPatch("app-settings", "promoPrices", { value: overrides });
  } catch {
    // key may not exist yet - create it
    await apiPost("app-settings", { key: "promoPrices", value: overrides });
  }
}

/** Seller-facing promo & chat-pin pricing — editable here, consumed live by the app via /api/v1/config. */
function PromoPricingCard() {
  const [prices, setPrices] = useState<PriceMap>(() =>
    Object.fromEntries(PRICING_DEFAULTS.map((d) => [d.id, String(d.price)]))
  );
  const [savedOverrides, setSavedOverrides] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);

  const loadSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/data/app-settings", { cache: "no-store" });
      const body = await res.json();
      const row = ((body.rows as { key: string; value: unknown }[] | undefined) ?? []).find(
        (r) => r.key === "promoPrices"
      );
      const raw = row?.value;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const map = raw as Record<string, unknown>;
        setSavedOverrides(
          Object.fromEntries(
            Object.entries(map).filter(([, v]) => typeof v === "number")
          ) as Record<string, number>
        );
        setPrices((prev) => {
          const next = { ...prev };
          for (const d of PRICING_DEFAULTS) {
            const v = map[d.id];
            if (typeof v === "number" && v >= 0) next[d.id] = String(Math.round(v));
          }
          return next;
        });
      }
    } catch {
      // server hiccup — code defaults stay visible/editable
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  function updatePrice(id: string, value: string) {
    setPrices((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  }

  async function save() {
    const overrides = extractOverrides(prices);
    await persistPromoPrices(overrides);
    setSavedOverrides(overrides);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[14px]">
          <Megaphone className="h-4 w-4 text-[#6C3BFF]" /> Promo Pricing (seller-facing)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {PRICING_DEFAULTS.map((p) => {
          const overridden = savedOverrides[p.id] !== undefined;
          return (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-[#E8EAF2] px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-[#18181B]">{p.name}</span>
                  <span
                    className={
                      overridden
                        ? "rounded-full bg-[#F3EFFF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6C3BFF]"
                        : "rounded-full bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#71717A]"
                    }
                  >
                    {overridden ? "Custom" : "Default"}
                  </span>
                </div>
                <div className="text-[12px] text-[#71717A]">{p.slot}</div>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-1.5">
                <span className="text-[13px] text-[#71717A]">₹</span>
                <Input
                  type="number"
                  min={0}
                  value={prices[p.id] ?? ""}
                  onChange={(e) => updatePrice(p.id, e.target.value)}
                  className="w-24"
                />
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 pt-1">
          <Button size="sm" onClick={save}>
            <Save className="h-3.5 w-3.5" /> Save promo pricing
          </Button>
          {saved && (
            <span className="text-[12px] font-medium text-[#16A34A]">Saved — the seller app picks this up live</span>
          )}
        </div>
        <p className="text-[12px] leading-5 text-[#71717A]">
          Prices apply to new purchases immediately via <code className="text-[#6C3BFF]">/api/v1/config</code>; active
          campaigns keep their original terms.
        </p>
      </CardContent>
    </Card>
  );
}

export default function CommissionPage() {
  const { data: rows, refresh } = useDbResource<CommissionSettings>("commission");
  // All three money tables are first-100 windows (same contract as the
  // dedicated desks): tiles below qualify whenever the window is partial.
  const { data: promoRows, total: promoTotal } = useDbResource<PromotionPurchase>("promotions", { take: 100 });
  const { data: orderRows, total: orderTotal } = useDbResource<Order>("orders", { take: 100 });
  const { data: withdrawalRows, total: withdrawalTotal } = useDbResource<WithdrawalRequest>("withdrawals", { take: 100 });
  const [settings, setSettings] = useState<CommissionSettings | null>(rows?.[0] ?? null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (rows?.[0]) setSettings(rows[0]);
  }, [rows]);

  function update<K extends keyof CommissionSettings>(key: K, value: CommissionSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function updateOverride(index: number, field: "category" | "rate", value: string | number) {
    setSettings((prev) => {
      if (!prev) return prev;
      const overrides = prev.categoryOverrides.map((o, i) => (i === index ? { ...o, [field]: value } : o));
      return { ...prev, categoryOverrides: overrides };
    });
    setSaved(false);
  }

  function addOverride() {
    setSettings((prev) =>
      prev ? { ...prev, categoryOverrides: [...prev.categoryOverrides, { category: "New category", rate: 8 }] } : prev
    );
    setSaved(false);
  }

  function removeOverride(index: number) {
    setSettings((prev) =>
      prev ? { ...prev, categoryOverrides: prev.categoryOverrides.filter((_, i) => i !== index) } : prev
    );
    setSaved(false);
  }

  async function save() {
    if (!settings) return;
    setSaveError(null);
    // The PK never rides in update data: Prisma rejects writes to @id, which
    // used to 503 every save once the row existed (hostile-audit 7b).
    const { id: _dropId, ...payload } = settings as CommissionSettings & { id?: string };
    void _dropId;
    try {
      try {
        await apiPatch("commission", "global", payload);
      } catch {
        // Fresh deploy without the id:"global" row (CommissionSetting.id has
        // no DB default): create it instead of failing silently.
        await apiPost("commission", { id: "global", ...payload });
      }
      refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed — rates unchanged. Try again.");
    }
  }

  const rate = settings?.commissionRate ?? 0;
  const payoutFee = settings?.payoutFee ?? 0;
  // Real bases only: delivered orders, active promo purchases, settled payouts.
  const deliveredOrders = (orderRows ?? []).filter((o) => o.status === "delivered");
  const deliveredGmv = deliveredOrders.reduce((s, o) => s + o.amount, 0);
  // Settled per-line legs (category overrides at sale time) — exactly what the
  // ledger + wallet settled. Legacy rows without legs fall back to the global
  // rate on the amount; flagged so the tile never silently disagrees again.
  let legacyFallbackCount = 0;
  const commissionOnDelivered = deliveredOrders.reduce((s, o) => {
    const itemsList = (o as unknown as { itemsList?: unknown }).itemsList;
    const legs = settledFeeFromLegs(itemsList);
    if (legs !== null) return s + legs;
    legacyFallbackCount += 1;
    // Goods-only basis (price×qty from the lines), never o.amount — amount
    // carries the delivery float, and rating it overstates commission by
    // ship×rate on every legacy row.
    const gb = settlementGoodsBasis(itemsList);
    const base = Number.isFinite(gb) ? (gb as number) : o.amount;
    return s + Math.round((base * rate) / 100);
  }, 0);
  const activePromos = (promoRows ?? []).filter((p) => p.status === "active");
  const promoRevenue = activePromos.reduce((s, p) => s + p.amountPaid, 0);
  const settledPayouts = (withdrawalRows ?? []).filter((w) => w.status === "approved" || w.status === "completed");
  const payoutFees = settledPayouts.length * payoutFee;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Commission & Fees</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          How the platform earns: per-sale commission, listing fees and payout fees. Rates shown here are what
          seller wallets reflect — category overrides apply at sale time, the default rate covers the rest.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Delivered GMV" value={inr(deliveredGmv)} tone="purple" />
        <StatTile label={`Commission on delivered (${rate}%)`} value={inr(commissionOnDelivered)} tone="green" />
        <StatTile label={`Promo revenue (${activePromos.length} active)${typeof promoTotal === "number" && promoTotal > (promoRows ?? []).length ? " · first 100" : ""}`} value={inr(promoRevenue)} tone="purple" />
        <StatTile label={`Payout fees (${settledPayouts.length} payouts)${typeof withdrawalTotal === "number" && withdrawalTotal > (withdrawalRows ?? []).length ? " · first 100" : ""}`} value={inr(payoutFees)} />
      </div>
      {((typeof orderTotal === "number" && orderTotal > (orderRows ?? []).length) ||
        (typeof promoTotal === "number" && promoTotal > (promoRows ?? []).length) ||
        (typeof withdrawalTotal === "number" && withdrawalTotal > (withdrawalRows ?? []).length) ||
        legacyFallbackCount > 0) && (
        <p className="text-[12px] text-[#71717A]">
          {typeof orderTotal === "number" && orderTotal > (orderRows ?? []).length
            ? `Computed over the first ${(orderRows ?? []).length} of ${orderTotal} orders. `
            : ""}
          {typeof promoTotal === "number" && promoTotal > (promoRows ?? []).length
            ? `Promo revenue over the first ${(promoRows ?? []).length} of ${promoTotal} campaigns. `
            : ""}
          {typeof withdrawalTotal === "number" && withdrawalTotal > (withdrawalRows ?? []).length
            ? `Payout fees over the first ${(withdrawalRows ?? []).length} of ${withdrawalTotal} requests. `
            : ""}
          {legacyFallbackCount > 0
            ? `Includes a global-rate estimate for ${legacyFallbackCount} pre-settlement order${legacyFallbackCount === 1 ? "" : "s"} (placed before per-line legs).`
            : ""}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <Percent className="h-4 w-4 text-[#6C3BFF]" /> Marketplace Commission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>Global commission rate (%)</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={settings?.commissionRate ?? ""}
                  placeholder="Not set"
                  onChange={(e) => update("commissionRate", Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                  className="w-28"
                />
                <span className="text-[12px] text-[#71717A]">
                  Applied to every delivered order. Seller payout = gross − commission.
                </span>
              </div>
            </div>
            <div>
              <Label>Listing fee (₹ per new listing)</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  value={settings?.listingFee ?? 0}
                  onChange={(e) => update("listingFee", Math.max(0, Number(e.target.value) || 0))}
                  className="w-28"
                />
                <span className="text-[12px] text-[#71717A]">Charged when a seller publishes a product post.</span>
              </div>
            </div>
            <div>
              <Label>Payout fee (₹ per withdrawal)</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  value={settings?.payoutFee ?? ""}
                  placeholder="Not set"
                  onChange={(e) => update("payoutFee", Math.max(0, Number(e.target.value) || 0))}
                  className="w-28"
                />
                <span className="text-[12px] text-[#71717A]">Deducted from each bank withdrawal request.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <PromoPricingCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[14px]">
              <Wallet className="h-4 w-4 text-[#6C3BFF]" /> Category Overrides
            </span>
            <Button size="sm" variant="secondary" onClick={addOverride}>
              <Plus className="h-3.5 w-3.5" /> Add category
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#E8EAF2] text-[12px] text-[#71717A]">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Commission rate</th>
                <th className="pb-2 font-medium text-right">Effective payout (₹1,000 sale)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {(settings?.categoryOverrides ?? []).map((o, i) => (
                <tr key={i} className="border-b border-[#F0F1F6]">
                  <td className="py-2.5 pr-3">
                    <Input value={o.category} onChange={(e) => updateOverride(i, "category", e.target.value)} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={o.rate}
                        onChange={(e) => updateOverride(i, "rate", Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                        className="w-24"
                      />
                      <span className="text-[#71717A]">%</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-[#18181B]">
                    {inr(Math.round(1000 * (1 - (o.rate ?? 0) / 100)))}
                  </td>
                  <td className="py-2.5 text-right">
                    <Button variant="ghost" size="sm" className="text-[#EF4444]" onClick={() => removeOverride(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={save}>
          <Save className="h-4 w-4" /> Save commission settings
        </Button>
        {saved && <span className="text-[13px] font-medium text-[#16A34A]">Saved — seller wallets now use these rates</span>}
        {saveError && <span className="text-[13px] font-medium text-[#B91C1C]">{saveError}</span>}
      </div>
    </div>
  );
}
