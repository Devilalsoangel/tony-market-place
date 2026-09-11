"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { exportToCSV, exportToExcel } from "@/lib/export";
import { Download, FileSpreadsheet, Clock } from "lucide-react";

const RESOURCES: { value: string; label: string }[] = [
  { value: "users", label: "Users" },
  { value: "sellers", label: "Sellers" },
  { value: "products", label: "Products" },
  { value: "orders", label: "Orders" },
  { value: "categories", label: "Categories" },
  { value: "communities", label: "Communities" },
  { value: "reviews", label: "Reviews" },
  { value: "transactions", label: "Transactions" },
  { value: "ledger", label: "Ledger" },
  { value: "gateway-logs", label: "Gateway Logs" },
  { value: "shipments", label: "Shipments" },
  { value: "carriers", label: "Carriers" },
  { value: "delivery-zones", label: "Delivery Zones" },
  { value: "tickets", label: "Support Tickets" },
  { value: "coupons", label: "Coupons" },
  { value: "promotions", label: "Promotions & Ads" },
  { value: "commission", label: "Commission & Fees" },
  // Subscribers removed: no such resource exists (export 404ed). Re-add only
  // with a real newsletter/subscriber table behind it.
  { value: "audit-logs", label: "Audit Logs" },
  { value: "admins", label: "Admins" },
];

function prettifyLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface RecentExport {
  resource: string;
  format: string;
  rows: number;
  at: string;
}

export default function ExportCenterPage() {
  const [resource, setResource] = useState("users");
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentExport[]>([]);

  const resourceLabel = RESOURCES.find((r) => r.value === resource)?.label ?? resource;

  const exportColumns = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return Object.keys(rows[0])
      .filter((k) => !["password", "passwordHash", "twoFactorCode"].includes(k))
      .slice(0, 12)
      .map((k) => ({ key: k, label: prettifyLabel(k) }));
  }, [rows]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data/${resource}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to load");
      setRows(body.rows as Record<string, unknown>[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }

  function record(format: "CSV" | "Excel") {
    setRecent((prev) =>
      [
        { resource: resourceLabel, format, rows: rows?.length ?? 0, at: new Date().toLocaleTimeString() },
        ...prev,
      ].slice(0, 8)
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">Export Center</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Export any dataset to CSV or Excel.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="w-full max-w-xs">
              <label className="mb-1.5 block text-sm font-medium text-[#18181B]">Dataset</label>
              <select
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                className="h-9 w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none focus:border-[#6C3BFF]"
              >
                {RESOURCES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Load data"}
            </Button>
            <Button onClick={() => { if (rows) { exportToCSV(rows as Record<string, unknown>[], `susej-${resource}`, exportColumns); record("CSV"); } }} disabled={!rows || rows.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="secondary" onClick={() => { if (rows) { exportToExcel(rows as Record<string, unknown>[], `susej-${resource}`, exportColumns); record("Excel"); } }} disabled={!rows || rows.length === 0}>
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          </div>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          {loading ? (
            <p className="py-8 text-center text-sm text-[#A1A1AA]">Loading...</p>
          ) : rows === null ? (
            <p className="py-8 text-center text-sm text-[#A1A1AA]">Choose a dataset and click &ldquo;Load data&rdquo; to preview it.</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#A1A1AA]">No rows in this dataset.</p>
          ) : (
            <>
              <p className="text-[13px] text-[#71717A]">
                {rows.length} rows · {exportColumns.length} columns
              </p>
              <div className="overflow-x-auto rounded-[6px] bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                      {exportColumns.map((c) => (
                        <th key={c.key} className="px-4 py-2.5 text-[13px] font-medium text-[#71717A]">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-[#E4E4E7] last:border-0">
                        {exportColumns.map((c) => {
                          const v = row[c.key];
                          const str = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
                          return <td key={c.key} className="max-w-[240px] truncate px-4 py-2.5 text-[13px] text-[#18181B]">{str}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <p className="text-xs text-[#A1A1AA]">Showing first 5 rows — export includes all {rows.length}.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Datasets available" value={RESOURCES.length} tone="purple" />
        <StatTile label="Loaded rows" value={rows?.length ?? 0} />
        <StatTile label="This session exports" value={recent.length} tone="green" />
        <StatTile label="Last export" value={recent[0] ? `${recent[0].format} · ${recent[0].rows} rows` : "—"} />
      </div>

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent exports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#E4E4E7]">
              {recent.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-[#A1A1AA]" />
                    <p className="text-[13px] font-medium text-[#18181B]">{r.resource}</p>
                    <BadgeMini>{r.format}</BadgeMini>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#A1A1AA]">
                    <span>{r.rows} rows</span>
                    <span>{r.at}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BadgeMini({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[4px] bg-[#F4F4F5] px-1.5 py-0.5 text-[10px] font-medium text-[#71717A]">
      {children}
    </span>
  );
}