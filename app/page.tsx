import { getDb, type Trade } from "@/lib/db";
import {
  computeStats,
  accountEquityCurve,
  pnlByDay,
  projectToTargets,
  tradesPerTradingDay,
} from "@/lib/stats";
import { enrichTradesWithFees, asNetTrades } from "@/lib/commissions";
import { requireUser } from "@/lib/auth";
import StatCard from "@/components/StatCard";
import EquityChart from "@/components/EquityChart";
import PnlBarChart from "@/components/PnlBarChart";
import PredictionCard from "@/components/PredictionCard";
import SessionClock from "@/components/SessionClock";

export const dynamic = "force-dynamic";

// Apex 50K rules — fallbacks when no account is configured.
const FALLBACK_STARTING = 50000;
const FALLBACK_TRAILING_DD = 2000;
const FALLBACK_MIN_WITHDRAW_OFFSET = 2600; // start + 2600 = $52,600 for 50K PA
const FALLBACK_MAX_WITHDRAW_OFFSET = 3600; // start + 3600 = $53,600 for 50K PA

function fmt(n: number) {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function IconCash() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function IconTrend() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M3 17l6-6 4 4 8-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 6h7v7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconScale() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path d="M12 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M5 8h14M5 8l-2 6a4 4 0 0 0 8 0L5 8Zm14 0-2 6a4 4 0 0 0 8 0l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const user = requireUser();
  const db = getDb();
  const raw = db
    .prepare(
      "SELECT * FROM trades WHERE user_id = ? ORDER BY entry_time DESC"
    )
    .all(user.id) as Trade[];
  const enriched = enrichTradesWithFees(db, user.id, raw);
  const netTrades = asNetTrades(enriched);
  const stats = computeStats(netTrades);
  const byDay = pnlByDay(netTrades);
  const recent = enriched.slice(0, 10);

  // Pull account config — active account first, else first account, else fallbacks.
  const account = (db
    .prepare(
      `SELECT name, account_size, trailing_drawdown, min_withdraw, max_withdraw
       FROM accounts
       WHERE user_id = ?
       ORDER BY is_active DESC, id ASC
       LIMIT 1`
    )
    .get(user.id) as
    | {
        name: string;
        account_size: number | null;
        trailing_drawdown: number | null;
        min_withdraw: number | null;
        max_withdraw: number | null;
      }
    | undefined) ?? null;

  const startingBalance = account?.account_size ?? FALLBACK_STARTING;
  const trailingDD = account?.trailing_drawdown ?? FALLBACK_TRAILING_DD;
  // When an account exists, only show targets it has explicitly configured.
  // Without any account, fall back to Apex 50K PA defaults so the chart isn't bare.
  const minWithdraw: number | null = account
    ? account.min_withdraw
    : startingBalance + FALLBACK_MIN_WITHDRAW_OFFSET;
  const maxWithdraw: number | null = account
    ? account.max_withdraw
    : startingBalance + FALLBACK_MAX_WITHDRAW_OFFSET;

  // Withdrawals are deducted from account equity (cash off the table, not a
  // trading loss) — they step the curve down but don't move the trailing stop.
  const withdrawalRows = db
    .prepare(
      "SELECT amount, withdraw_date FROM withdrawals WHERE user_id = ? ORDER BY withdraw_date ASC, id ASC"
    )
    .all(user.id) as { amount: number; withdraw_date: string }[];
  const totalWithdrawn = withdrawalRows.reduce((s, w) => s + w.amount, 0);

  const equity = accountEquityCurve(
    netTrades,
    startingBalance,
    trailingDD,
    withdrawalRows.map((w) => ({ date: w.withdraw_date, amount: w.amount }))
  );
  const currentValue =
    equity.length > 0
      ? equity[equity.length - 1].account_value
      : startingBalance - totalWithdrawn;

  const tradesPerDay = tradesPerTradingDay(netTrades);
  const targets: { label: string; value: number }[] = [];
  if (minWithdraw !== null) targets.push({ label: "Min withdraw", value: minWithdraw });
  if (maxWithdraw !== null) targets.push({ label: "Target", value: maxWithdraw });
  const { evPerTrade, projections } = projectToTargets({
    currentValue,
    winRate: stats.winRate,
    avgWin: stats.avgWin,
    avgLoss: stats.avgLoss,
    tradesPerDay,
    targets,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <SessionClock />

      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tightest">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Net performance across all imported trades — after commissions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="pill pill-neutral">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Live
          </span>
          <span className="mono">{stats.totalTrades} trades</span>
        </div>
      </header>

      {raw.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <IconTrend />
          </div>
          <div className="text-lg font-medium mb-1">No trades yet</div>
          <p className="text-sm text-slate-400 mb-5">
            Import your Tradovate trade history CSV to get started.
          </p>
          <a href="/import" className="btn btn-primary inline-flex">
            Go to Import →
          </a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Net P&L"
              value={fmt(stats.totalPnl)}
              tone={stats.totalPnl >= 0 ? "positive" : "negative"}
              sub={`gross ${fmt(stats.totalGross)} · fees ${fmt(stats.totalFees)}`}
              icon={<IconCash />}
            />
            <StatCard
              label="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
              sub={`${stats.wins}W · ${stats.losses}L`}
              icon={<IconTarget />}
            />
            <StatCard
              label="Profit Factor"
              value={
                stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)
              }
              tone={stats.profitFactor >= 1 ? "positive" : "negative"}
              icon={<IconScale />}
            />
            <StatCard
              label="Avg R:R"
              value={stats.avgRR.toFixed(2)}
              sub={`win ${fmt(stats.avgWin)} / loss ${fmt(stats.avgLoss)}`}
              icon={<IconTrend />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="section-label">Equity Curve</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Account {fmt(currentValue)} · Apex{" "}
                    {fmt(startingBalance).replace(".00", "")} rules
                    {totalWithdrawn > 0 && (
                      <> · withdrawn {fmt(totalWithdrawn)}</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <Legend color="#22d3a4" label="Account" solid />
                  <Legend color="#f87171" label="Trail stop" dashed />
                  {totalWithdrawn > 0 && (
                    <Legend color="#fbbf24" label="Withdrawal" dot />
                  )}
                </div>
              </div>
              <EquityChart
                data={equity}
                startingBalance={startingBalance}
                minWithdraw={minWithdraw}
                maxWithdraw={maxWithdraw}
              />
            </div>
            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="section-label">Daily P&L</div>
                  <div className="text-xs text-slate-500 mt-0.5">After commissions</div>
                </div>
              </div>
              <PnlBarChart data={byDay} />
            </div>
          </div>

          <PredictionCard
            currentValue={currentValue}
            evPerTrade={evPerTrade}
            winRate={stats.winRate}
            avgRR={stats.avgRR}
            tradesPerDay={tradesPerDay}
            projections={projections}
          />

          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
              <div className="section-label">Recent Trades</div>
              <a
                href="/trades"
                className="text-xs text-slate-400 hover:text-accent transition-colors"
              >
                View all →
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Entry</th>
                    <th className="text-right">Exit</th>
                    <th>Time</th>
                    <th className="text-right">Fees</th>
                    <th className="text-right">Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
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
                      <td className="text-slate-500 whitespace-nowrap">
                        {new Date(t.entry_time).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="text-right mono text-slate-500">
                        −${t.fees_calc.toFixed(2)}
                      </td>
                      <td
                        className={`text-right mono font-medium ${
                          (t.net_pnl ?? 0) >= 0 ? "text-accent" : "text-accent-loss"
                        }`}
                      >
                        {t.net_pnl !== null ? fmt(t.net_pnl) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Legend({
  color,
  label,
  dashed,
  solid,
  dot,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  solid?: boolean;
  dot?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-400">
      {dot ? (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color }}
        />
      ) : (
        <span
          className="inline-block h-[2px] w-5 rounded"
          style={{
            background: solid ? color : "transparent",
            borderTop: dashed ? `2px dashed ${color}` : undefined,
          }}
        />
      )}
      {label}
    </span>
  );
}
