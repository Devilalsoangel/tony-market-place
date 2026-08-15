"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface RevenueChartProps {
  data: { month: string; revenue: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
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
