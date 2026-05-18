import { getDb, type Trade } from "@/lib/db";
import { enrichTradesWithFees } from "@/lib/commissions";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function fmt(n: number | null) {
  if (n === null) return "—";
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtDuration(s: number | null) {
  if (s === null) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function TradesPage() {
  const user = requireUser();
  const db = getDb();
  const raw = db
    .prepare(
      "SELECT * FROM trades WHERE user_id = ? ORDER BY entry_time DESC"
    )
    .all(user.id) as Trade[];
  const trades = enrichTradesWithFees(db, user.id, raw);

  const totalGross = trades.reduce((s, t) => s + (t.gross_pnl ?? 0), 0);
  const totalFees = trades.reduce((s, t) => s + t.fees_calc, 0);
  const totalNet = totalGross - totalFees;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tightest">Trades</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {trades.length} trade{trades.length === 1 ? "" : "s"} imported · fees deducted
            per Tradovate/Apex rates.
          </p>
        </div>
        <a href="/import" className="btn btn-ghost">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
              d="M12 5v14m-7-7h14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Import CSV
        </a>
      </header>

      {trades.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="surface-card p-4">
            <div className="section-label">Gross P&L</div>
            <div
              className={`text-xl font-semibold mono mt-1 ${
                totalGross >= 0 ? "text-slate-100" : "text-accent-loss"
              }`}
            >
              {fmt(totalGross)}
            </div>
          </div>
          <div className="surface-card p-4">
            <div className="section-label">Total Fees</div>
            <div className="text-xl font-semibold mono mt-1 text-slate-400">
              −${totalFees.toFixed(2)}
            </div>
          </div>
          <div className="surface-card p-4">
            <div className="section-label">Net P&L</div>
            <div
              className={`text-xl font-semibold mono mt-1 ${
                totalNet >= 0 ? "text-accent" : "text-accent-loss"
              }`}
            >
              {fmt(totalNet)}
            </div>
          </div>
        </div>
      )}

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Side</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Entry</th>
                <th className="text-right">Exit</th>
                <th>Duration</th>
                <th>Account</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Fees</th>
                <th className="text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center text-slate-500">
                    No trades yet. Import a CSV to get started.
                  </td>
                </tr>
              )}
              {trades.map((t) => (
                <tr key={t.id}>
                  <td className="text-slate-400 whitespace-nowrap">
                    {new Date(t.entry_time).toLocaleString(undefined, {
                      year: "2-digit",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="font-medium">{t.symbol}</td>
                  <td>
                    <span className={t.side === "long" ? "pill pill-up" : "pill pill-down"}>
                      {t.side}
                    </span>
                  </td>
                  <td className="text-right mono">{t.qty}</td>
                  <td className="text-right mono text-slate-300">{t.entry_price}</td>
                  <td className="text-right mono text-slate-300">
                    {t.exit_price ?? "—"}
                  </td>
                  <td className="text-slate-400 mono">{fmtDuration(t.duration_seconds)}</td>
                  <td className="text-slate-400">{t.account ?? "—"}</td>
                  <td
                    className={`text-right mono ${
                      (t.gross_pnl ?? 0) >= 0 ? "text-slate-300" : "text-accent-loss/80"
                    }`}
                  >
                    {fmt(t.gross_pnl)}
                  </td>
                  <td className="text-right mono text-slate-500">
                    −${t.fees_calc.toFixed(2)}
                  </td>
                  <td
                    className={`text-right mono font-medium ${
                      (t.net_pnl ?? 0) >= 0 ? "text-accent" : "text-accent-loss"
                    }`}
                  >
                    {fmt(t.net_pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
