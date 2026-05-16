"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";

type Point = { date: string; pnl: number };

export default function PnlBarChart({ data }: { data: Point[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 10, right: 8, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="barUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34e3b6" stopOpacity={1} />
              <stop offset="100%" stopColor="#1eb88c" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="barDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb8a8a" stopOpacity={1} />
              <stop offset="100%" stopColor="#dc5c5c" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1a2030" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#475569"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#1a2030" }}
            minTickGap={24}
          />
          <YAxis
            stroke="#475569"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "rgba(34, 211, 164, 0.04)" }}
            contentStyle={{
              background: "#11151c",
              border: "1px solid #222a39",
              borderRadius: 8,
              fontSize: 12,
              color: "#e2e8f0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
            labelStyle={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}
            itemStyle={{ color: "#e2e8f0" }}
            formatter={(v: number) => [
              <span
                key="v"
                style={{ color: v >= 0 ? "#22d3a4" : "#f87171" }}
              >{`$${v.toFixed(2)}`}</span>,
              "P&L",
            ]}
          />
          <ReferenceLine y={0} stroke="#334155" strokeDasharray="2 2" />
          <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={36}>
            {formatted.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? "url(#barUp)" : "url(#barDown)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
