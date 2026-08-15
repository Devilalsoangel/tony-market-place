"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface GrowthChartProps {
  data: { month: string; users: number; sellers: number }[];
}

export function GrowthChart({ data }: GrowthChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E4E4E7",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        />
        <Legend />
        <Area type="monotone" dataKey="users" stroke="#6C3BFF" fill="#6C3BFF" fillOpacity={0.1} strokeWidth={2} name="Users" />
        <Area type="monotone" dataKey="sellers" stroke="#16A34A" fill="#16A34A" fillOpacity={0.1} strokeWidth={2} name="Sellers" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
