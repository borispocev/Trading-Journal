import type { Projection } from "@/lib/stats";

type Props = {
  currentValue: number;
  evPerTrade: number;
  winRate: number;
  avgRR: number;
  tradesPerDay: number;
  projections: Projection[];
};

function fmtMoney(n: number) {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PredictionCard({
  currentValue,
  evPerTrade,
  winRate,
  avgRR,
  tradesPerDay,
  projections,
}: Props) {
  const positive = evPerTrade > 0;
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
        <div>
          <div className="section-label">Projection</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Forecast to reach payout thresholds at current edge
          </div>
        </div>
        <div
          className={`pill ${positive ? "pill-up" : "pill-down"} mono`}
          title="Expected value per trade"
        >
          EV {fmtMoney(evPerTrade)}/trade
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-bg-border">
        <Stat label="Current" value={fmtMoney(currentValue)} />
        <Stat label="Win rate" value={`${winRate.toFixed(1)}%`} />
        <Stat label="Avg R:R" value={avgRR.toFixed(2)} />
        <Stat
          label="Trades / day"
          value={tradesPerDay > 0 ? tradesPerDay.toFixed(1) : "—"}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="app-table">
          <thead>
            <tr>
              <th>Target</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Distance</th>
              <th className="text-right">Trades</th>
              <th className="text-right">Days</th>
              <th className="text-right">ETA</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((p) => {
              const distance = p.target - currentValue;
              const distColor =
                distance <= 0 ? "text-accent" : "text-slate-300";
              return (
                <tr key={p.label}>
                  <td className="font-medium">{p.label}</td>
                  <td className="text-right mono text-slate-300">
                    {fmtMoney(p.target)}
                  </td>
                  <td className={`text-right mono ${distColor}`}>
                    {distance <= 0
                      ? "✓ reached"
                      : `+${fmtMoney(distance).replace("$", "$")}`}
                  </td>
                  <td className="text-right mono">
                    {p.reached ? (
                      <span className="text-accent">—</span>
                    ) : p.unreachable ? (
                      <span className="text-accent-loss">∞</span>
                    ) : (
                      <span className="text-slate-100">
                        {p.tradesNeeded?.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="text-right mono">
                    {p.reached ? (
                      <span className="text-accent">—</span>
                    ) : p.unreachable ? (
                      <span className="text-accent-loss">—</span>
                    ) : (
                      <span className="text-slate-100">
                        {p.daysNeeded?.toLocaleString() ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="text-right mono text-slate-400 whitespace-nowrap">
                    {p.reached ? (
                      <span className="text-accent">today</span>
                    ) : p.unreachable ? (
                      <span className="text-accent-loss">unreachable</span>
                    ) : (
                      fmtDate(p.etaDate)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!positive && (
        <div className="px-4 py-3 border-t border-bg-border text-xs text-accent-loss/90 bg-accent-loss/5">
          Current edge is negative ({fmtMoney(evPerTrade)}/trade). Targets are
          unreachable on average without raising win rate or R:R.
        </div>
      )}
      {positive && (
        <div className="px-4 py-3 border-t border-bg-border text-[11px] text-slate-500">
          Linear projection: EV = winRate × avgWin − lossRate × avgLoss.
          Doesn&apos;t account for variance, drawdowns, or the trailing stop —
          this is the average path, not the realized path.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card px-4 py-3">
      <div className="section-label">{label}</div>
      <div className="text-lg font-semibold mono mt-0.5 text-slate-100">
        {value}
      </div>
    </div>
  );
}
