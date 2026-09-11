"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface RevenueChartProps {
  data: { month: string; revenue: number }[];
}

// Indian numbering: ₹12k / ₹1.2L / ₹1.5Cr
function inrCompact(v: number): string {
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (v >= 1_000) return `₹${Math.round(v / 1_000)}k`;
  return `₹${v}`;
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => inrCompact(Number(v))} />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E4E4E7",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        />
        <Line type="monotone" dataKey="revenue" stroke="#6C3BFF" strokeWidth={2} dot={{ fill: "#6C3BFF", r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
