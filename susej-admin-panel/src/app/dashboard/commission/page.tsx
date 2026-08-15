"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/shared/stat-tile";
import { useDbResource } from "@/hooks/use-db-resource";
import { apiPatch } from "@/lib/api-mutate";
import { Percent, Trash2, Plus, Save, IndianRupee, Wallet } from "lucide-react";
import type { CommissionSettings } from "@/types";

// susej is an Indian marketplace — all fees/commissions are INR.
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const ESTIMATED_MONTHLY_GMV = 420000;
const EST_PROMO_REVENUE = 8493; // sum of active promo purchases (mockPromotions)

export default function CommissionPage() {
  const { data: rows, refresh } = useDbResource<CommissionSettings>("commission");
  const [settings, setSettings] = useState<CommissionSettings | null>(rows?.[0] ?? null);
  const [saved, setSaved] = useState(false);

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
    try {
      await apiPatch("commission", "global", settings);
      refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
    }
  }

  const rate = settings?.commissionRate ?? 0;
  const estCommission = Math.round((ESTIMATED_MONTHLY_GMV * rate) / 100);
  const estPayoutFees = Math.round(ESTIMATED_MONTHLY_GMV / 1500) * (settings?.payoutFee ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Commission & Fees</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          How the platform earns: per-sale commission, listing fees and payout fees. Rates shown here are what
          seller wallets reflect — 8% default, first 10 orders 0%.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Est. monthly GMV" value={inr(ESTIMATED_MONTHLY_GMV)} tone="purple" />
        <StatTile label="Est. commission / mo" value={inr(estCommission)} tone="green" />
        <StatTile label="Promo revenue" value={inr(EST_PROMO_REVENUE)} tone="purple" />
        <StatTile label="Est. payout fees / mo" value={inr(estPayoutFees)} />
      </div>

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
                  value={settings?.commissionRate ?? 8}
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
                  value={settings?.payoutFee ?? 20}
                  onChange={(e) => update("payoutFee", Math.max(0, Number(e.target.value) || 0))}
                  className="w-28"
                />
                <span className="text-[12px] text-[#71717A]">Deducted from each bank withdrawal request.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <IndianRupee className="h-4 w-4 text-[#6C3BFF]" /> Promo Packages (per day pricing)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { name: "Top Seller Spotlight", prices: "7d ₹599 · 30d ₹1999", slot: "Home Top Sellers rail" },
              { name: "Hot Deal", prices: "7d ₹499 · 30d ₹1499", slot: "Hot Deals section + URGENT badge" },
              { name: "Boost Post", prices: "7d ₹349 · 30d ₹999", slot: "Sponsored in buyer feeds" },
            ].map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-xl border border-[#E8EAF2] px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-[#18181B]">{p.name}</div>
                  <div className="text-[12px] text-[#71717A]">{p.slot}</div>
                </div>
                <span className="text-[13px] font-semibold tabular-nums text-[#18181B]">{p.prices}</span>
              </div>
            ))}
            <p className="text-[12px] leading-5 text-[#71717A]">
              Managed by the promotion catalog (<code className="text-[#6C3BFF]">lib/promotions/catalog.ts</code>) and
              reflected 1:1 in the seller app Promotions screen.
            </p>
          </CardContent>
        </Card>
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
      </div>
    </div>
  );
}
