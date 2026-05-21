"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Label,
} from "recharts";

type Point = {
  date: string;
  account_value: number;
  trail_stop: number;
  withdrawal?: number;
};

// Custom dot for the account line: an amber marker on points where cash was
// withdrawn, nothing on ordinary trade points.
function WithdrawalDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: Point;
}) {
  const { cx, cy, payload, index } = props;
  if (cx == null || cy == null || !payload || !(payload.withdrawal! > 0)) {
    return <g key={`wd-${index}`} />;
  }
  return (
    <circle
      key={`wd-${index}`}
      cx={cx}
      cy={cy}
      r={4.5}
      fill="#fbbf24"
      stroke="#0a0d12"
      strokeWidth={2}
    />
  );
}

type Props = {
  data: Point[];
  startingBalance: number;
  minWithdraw: number | null;
  maxWithdraw: number | null;
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function EquityChart({
  data,
  startingBalance,
  minWithdraw,
  maxWithdraw,
}: Props) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  // Pick a y-axis domain that always includes every visible reference line.
  const allVals = [
    ...formatted.flatMap((d) => [d.account_value, d.trail_stop]),
    startingBalance,
    ...(minWithdraw !== null ? [minWithdraw] : []),
    ...(maxWithdraw !== null ? [maxWithdraw] : []),
  ];
  const minY = Math.min(...allVals) - 200;
  const maxY = Math.max(...allVals) + 200;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={formatted}
          margin={{ top: 12, right: 16, bottom: 0, left: -4 }}
        >
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3a4" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#22d3a4" stopOpacity={0} />
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
            tickFormatter={fmtMoney}
            domain={[minY, maxY]}
            width={68}
          />
          <Tooltip
            cursor={{ stroke: "#2c374a", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "#11151c",
              border: "1px solid #222a39",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
            labelStyle={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}
            formatter={(v: number, name) => {
              const labels: Record<string, string> = {
                account_value: "Account",
                trail_stop: "Trail stop",
              };
              return [fmtMoney(Number(v)), labels[String(name)] ?? String(name)];
            }}
          />

          {/* Starting-balance baseline — subtle */}
          <ReferenceLine
            y={startingBalance}
            stroke="#475569"
            strokeDasharray="2 3"
            strokeWidth={1}
          >
            <Label
              value={`Start ${fmtMoney(startingBalance)}`}
              position="insideBottomLeft"
              fill="#64748b"
              fontSize={10}
            />
          </ReferenceLine>

          {/* Min withdraw — lighter green */}
          {minWithdraw !== null && (
            <ReferenceLine
              y={minWithdraw}
              stroke="#6ee7c0"
              strokeDasharray="4 4"
              strokeWidth={1.4}
            >
              <Label
                value={`Min withdraw ${fmtMoney(minWithdraw)}`}
                position="insideTopLeft"
                fill="#6ee7c0"
                fontSize={11}
              />
            </ReferenceLine>
          )}

          {/* Target / max withdraw — bright green */}
          {maxWithdraw !== null && (
            <ReferenceLine
              y={maxWithdraw}
              stroke="#22d3a4"
              strokeDasharray="6 3"
              strokeWidth={1.6}
            >
              <Label
                value={`Target ${fmtMoney(maxWithdraw)}`}
                position="insideTopLeft"
                fill="#22d3a4"
                fontSize={11}
                offset={14}
              />
            </ReferenceLine>
          )}

          {/* Trailing stop — red, per-point ratchet */}
          <Line
            type="stepAfter"
            dataKey="trail_stop"
            stroke="#f87171"
            strokeWidth={1.6}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />

          {/* Account value — green area */}
          <Area
            type="monotone"
            dataKey="account_value"
            stroke="#22d3a4"
            strokeWidth={2.2}
            fill="url(#equityFill)"
            dot={<WithdrawalDot />}
            activeDot={{
              r: 4,
              fill: "#22d3a4",
              stroke: "#0a0d12",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
