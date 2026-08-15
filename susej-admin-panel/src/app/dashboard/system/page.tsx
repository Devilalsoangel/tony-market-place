"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";
import { useAuthStore } from "@/store/auth-store";
import { Database, Globe, Server, ShieldCheck, Activity } from "lucide-react";

const API_ENDPOINTS = [
  { method: "GET", path: "/api/data/:resource", desc: "List records (users, orders, coupons...)" },
  { method: "POST", path: "/api/data/:resource", desc: "Create a record" },
  { method: "PATCH", path: "/api/data/:resource", desc: "Update a record" },
  { method: "DELETE", path: "/api/data/:resource", desc: "Delete a record" },
  { method: "POST", path: "/api/login", desc: "Admin login" },
  { method: "POST", path: "/api/login/verify-2fa", desc: "Two-factor verification" },
  { method: "POST", path: "/api/logout", desc: "End session" },
  { method: "POST", path: "/api/forgot-password", desc: "Request password reset" },
  { method: "POST", path: "/api/reset-password", desc: "Complete password reset" },
  { method: "GET", path: "/api/v1/home", desc: "Public home feed" },
  { method: "GET", path: "/api/v1/promotions/my", desc: "My promotions" },
  { method: "POST", path: "/api/v1/promotions/checkout", desc: "Promotion checkout" },
  { method: "GET", path: "/api/v1/cron/sweep", desc: "Scheduled promotions sweep" },
];

const METHOD_TONE: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  GET: "success",
  POST: "info",
  PATCH: "warning",
  DELETE: "danger",
};

export default function SystemPage() {
  const user = useAuthStore((s) => s.user);
  const [dbStatus, setDbStatus] = useState<"checking" | "ok" | "degraded">("checking");
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [env, setEnv] = useState({
    platform: "",
    userAgent: "",
    locale: "",
    timezone: "",
    screen: "",
  });

  useEffect(() => {
    fetch("/api/data/app-settings", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("db error");
        return res.json();
      })
      .then((body) => {
        setDbStatus("ok");
        setRowCount(body.rows?.length ?? 0);
      })
      .catch(() => setDbStatus("degraded"));
  }, []);

  useEffect(() => {
    setEnv({
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${window.screen.width}×${window.screen.height}`,
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#18181B]">System</h1>
        <p className="mt-0.5 text-[13px] text-[#71717A]">Runtime, database and API overview for the admin panel.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile label="App version" value="v1.0.0" tone="purple" />
        <StatTile label="Database" value={dbStatus === "ok" ? "Connected" : dbStatus === "checking" ? "Checking..." : "Degraded"} tone={dbStatus === "ok" ? "green" : dbStatus === "degraded" ? "red" : "amber"} />
        <StatTile label="Settings records" value={rowCount ?? "—"} />
        <StatTile label="API endpoints" value={API_ENDPOINTS.length} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-[#6C3BFF]" />
              Runtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#E4E4E7]">
              {[
                { label: "Browser", value: env.userAgent },
                { label: "Platform", value: env.platform },
                { label: "Locale", value: env.locale },
                { label: "Timezone", value: env.timezone },
                { label: "Screen", value: env.screen },
              ].map((r) => (
                <div key={r.label} className="flex items-start justify-between gap-4 py-2.5">
                  <span className="text-[13px] text-[#71717A]">{r.label}</span>
                  <span className="max-w-[60%] truncate text-right text-[13px] font-medium text-[#18181B]">{r.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#6C3BFF]" />
              Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#E4E4E7]">
              {[
                { label: "Signed in as", value: user?.name ?? "—" },
                { label: "Login ID", value: user?.loginId ?? "—" },
                { label: "Role", value: user?.role ?? "—" },
                { label: "Auth", value: "JWT session cookie" },
                { label: "2FA", value: user?.twoFactorEnabled ? "Enabled" : "Not set" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between py-2.5">
                  <span className="text-[13px] text-[#71717A]">{r.label}</span>
                  <span className="text-[13px] font-medium capitalize text-[#18181B]">{r.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#6C3BFF]" />
            API endpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-[6px] bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                  <th className="px-4 py-2.5 text-[13px] font-medium text-[#71717A]">Method</th>
                  <th className="px-4 py-2.5 text-[13px] font-medium text-[#71717A]">Path</th>
                  <th className="px-4 py-2.5 text-[13px] font-medium text-[#71717A]">Description</th>
                </tr>
              </thead>
              <tbody>
                {API_ENDPOINTS.map((e) => (
                  <tr key={e.method + e.path} className="border-b border-[#E4E4E7] last:border-0">
                    <td className="px-4 py-2.5">
                      <Badge variant={METHOD_TONE[e.method] ?? "default"}>{e.method}</Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[13px] text-[#6C3BFF]">{e.path}</td>
                    <td className="px-4 py-2.5 text-[13px] text-[#71717A]">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#6C3BFF]" />
            Data layer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#16A34A]" />
            <p className="text-[13px] text-[#71717A]">
              Generic CRUD over{" "}
              <span className="font-mono text-[#18181B]">/api/data/:resource</span> —{" "}
              {dbStatus === "ok" ? "SQLite (Prisma) backed with static demo fallback." : "Running on static demo data (no database available)."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}