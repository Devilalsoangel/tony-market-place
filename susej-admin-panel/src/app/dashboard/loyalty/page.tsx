"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { Dialog } from "@/components/ui/dialog";
import { useDbResource } from "@/hooks/use-db-resource";
import { formatNumber, formatDate } from "@/lib/utils";
import { Gift, PlusCircle, MinusCircle } from "lucide-react";
import type { MockLoyaltyUser } from "@/services/mock-data";

const column = createColumnHelper<MockLoyaltyUser>();

const tierVariant: Record<string, "default" | "info" | "warning" | "primary"> = {
  Bronze: "default",
  Silver: "info",
  Gold: "warning",
  Platinum: "primary",
};

function tierFromPoints(points: number): MockLoyaltyUser["tier"] {
  if (points >= 5000) return "Platinum";
  if (points >= 1500) return "Gold";
  if (points >= 500) return "Silver";
  return "Bronze";
}

const makeColumns = (onAdjust: (u: MockLoyaltyUser) => void) => [
  column.accessor("userName", { header: "User", cell: (info) => <span className="font-medium text-[#18181B]">{info.getValue()}</span> }),
  column.accessor("tier", {
    header: "Tier",
    cell: (info) => <Badge variant={tierVariant[info.getValue()]}>{info.getValue()}</Badge>,
  }),
  column.accessor("points", { header: "Points", cell: (info) => <span className="font-medium tabular-nums">{formatNumber(info.getValue())}</span> }),
  column.accessor("referrals", { header: "Referrals", cell: (info) => <span className="tabular-nums">{info.getValue()}</span> }),
  column.accessor("rewardsRedeemed", { header: "Rewards Redeemed", cell: (info) => <span className="tabular-nums">{info.getValue()}</span> }),
  column.accessor("joinedAt", { header: "Member Since", cell: (info) => <span className="text-[#71717A]">{formatDate(info.getValue())}</span> }),
  column.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => onAdjust(info.row.original)}>
          <PlusCircle className="h-3.5 w-3.5 text-[#6C3BFF]" /> Adjust
        </Button>
      </div>
    ),
  }),
];

export default function LoyaltyPage() {
  const { data: rows, refresh } = useDbResource<MockLoyaltyUser>("loyalty");
  const [items, setItems] = useState<MockLoyaltyUser[] | null>(rows);
  const [target, setTarget] = useState<MockLoyaltyUser | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setItems(rows ?? null);
  }, [rows]);

  function openAdjust(u: MockLoyaltyUser) {
    setTarget(u);
    setDelta("");
    setReason("");
  }

  function submitAdjust() {
    if (!target) return;
    const amount = Number(delta);
    if (!Number.isFinite(amount) || amount === 0) return;
    const points = Math.max(0, target.points + amount);
    const tier = tierFromPoints(points);
    setItems((prev) =>
      (prev ?? []).map((u) => (u.id === target.id ? { ...u, points, tier } : u))
    );
    fetch("/api/data/loyalty", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: target.id, data: { points, tier } }),
    })
      .finally(() => {
        setTarget(null);
        refresh();
      });
  }

  const totalPoints = (items ?? []).reduce((s, u) => s + u.points, 0);
  const premium = (items ?? []).filter((u) => u.tier === "Gold" || u.tier === "Platinum").length;
  const totalReferrals = (items ?? []).reduce((s, u) => s + u.referrals, 0);
  const redeemed = (items ?? []).reduce((s, u) => s + u.rewardsRedeemed, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Loyalty & Referrals</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">
          Points, tiers, and referral activity — adjust balances and tiers from here.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Total points issued" value={formatNumber(totalPoints)} tone="purple" />
        <StatTile label="Gold & Platinum" value={premium} tone="amber" />
        <StatTile label="Total referrals" value={totalReferrals} tone="green" />
        <StatTile label="Rewards redeemed" value={redeemed} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loyalty Members</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={makeColumns(openAdjust)}
            data={items ?? []}
            searchable
            searchKey="userName"
            filename="loyalty"
            exportColumns={[
              { key: "userName", label: "User" },
              { key: "tier", label: "Tier" },
              { key: "points", label: "Points" },
              { key: "referrals", label: "Referrals" },
              { key: "rewardsRedeemed", label: "Rewards Redeemed" },
              { key: "joinedAt", label: "Member Since" },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={!!target} onClose={() => setTarget(null)} title="Adjust loyalty points">
        {target && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#18181B]">{target.userName}</p>
                  <p className="mt-0.5 text-[13px] text-[#71717A]">
                    Current balance: {formatNumber(target.points)} pts
                  </p>
                </div>
                <Badge variant={tierVariant[target.tier]}>{target.tier}</Badge>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#18181B]">
                Points to add / deduct
              </label>
              <input
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="e.g. 200 or -150"
                className="h-11 w-full rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm text-[#18181B] outline-none focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20"
              />
              <p className="mt-1 text-xs text-[#71717A]">
                Use a negative number to deduct. Tier recalculates automatically (Bronze 0 · Silver
                500 · Gold 1500 · Platinum 5000).
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#18181B]">
                Reason (audit log)
              </label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Refund bonus, fraud deduction, manual correction"
                className="h-11 w-full rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm text-[#18181B] outline-none focus:border-[#6C3BFF] focus:ring-1 focus:ring-[#6C3BFF]/20"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={submitAdjust}
                disabled={!delta || Number(delta) === 0}
              >
                {delta.startsWith("-") ? (
                  <MinusCircle className="h-4 w-4" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                Apply adjustment
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <div className="flex items-center gap-2 text-[13px] text-[#71717A]">
        <Gift className="h-4 w-4" />
        Balance adjustments are recorded in the audit trail with the reason provided.
      </div>
    </div>
  );
}