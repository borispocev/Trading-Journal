import type { Trade } from "./db";

export type Stats = {
  totalPnl: number;
  totalGross: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  totalFees: number;
  avgRR: number;
};

export function computeStats(trades: Trade[]): Stats {
  const closed = trades.filter((t) => t.pnl !== null);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);
  const breakeven = closed.filter((t) => (t.pnl ?? 0) === 0);

  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const totalFees = closed.reduce((s, t) => s + (t.fees ?? 0), 0);
  const totalGross = totalPnl + totalFees;
  const grossWin = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const largestWin = wins.length ? Math.max(...wins.map((t) => t.pnl ?? 0)) : 0;
  const largestLoss = losses.length ? Math.min(...losses.map((t) => t.pnl ?? 0)) : 0;
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

  return {
    totalPnl,
    totalGross,
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    largestWin,
    largestLoss,
    totalFees,
    avgRR,
  };
}

export function equityCurve(trades: Trade[]): { date: string; equity: number; pnl: number }[] {
  const closed = trades
    .filter((t) => t.pnl !== null && t.exit_time)
    .sort((a, b) => (a.exit_time! < b.exit_time! ? -1 : 1));
  let running = 0;
  return closed.map((t) => {
    running += t.pnl ?? 0;
    return {
      date: t.exit_time!,
      equity: Math.round(running * 100) / 100,
      pnl: t.pnl ?? 0,
    };
  });
}

export type AccountEquityPoint = {
  date: string;
  account_value: number;
  trail_stop: number;
  pnl: number;
};

/**
 * Builds an account-value equity curve with a per-point Apex-style trailing
 * drawdown stop. Trailing stop = max(peak_pnl, 0) − trailingDD, clamped so it
 * never exceeds the starting balance (Apex behavior: trail locks at starting
 * balance once peak equity reaches start + threshold).
 */
export function accountEquityCurve(
  trades: Trade[],
  startingBalance: number,
  trailingDrawdown: number
): AccountEquityPoint[] {
  const closed = trades
    .filter((t) => t.pnl !== null && t.exit_time)
    .sort((a, b) => (a.exit_time! < b.exit_time! ? -1 : 1));

  let running = 0;
  let peak = 0;
  const out: AccountEquityPoint[] = [];

  // Seed point at the first trade's entry for a visual "starts at $X" anchor.
  if (closed.length > 0) {
    const start = closed[0];
    out.push({
      date: start.entry_time,
      account_value: startingBalance,
      trail_stop: startingBalance - trailingDrawdown,
      pnl: 0,
    });
  }

  for (const t of closed) {
    running += t.pnl ?? 0;
    if (running > peak) peak = running;
    const trail = Math.min(
      startingBalance,
      startingBalance + peak - trailingDrawdown
    );
    out.push({
      date: t.exit_time!,
      account_value: Math.round((startingBalance + running) * 100) / 100,
      trail_stop: Math.round(trail * 100) / 100,
      pnl: t.pnl ?? 0,
    });
  }
  return out;
}

export type Projection = {
  label: string;
  target: number;
  reached: boolean;
  tradesNeeded: number | null;
  daysNeeded: number | null;
  etaDate: string | null;
  unreachable: boolean;
};

/**
 * Projects when the account will hit each target given the current edge:
 *   EV per trade = winRate × avgWin − lossRate × avgLoss
 * Returns one entry per target.
 */
export function projectToTargets(opts: {
  currentValue: number;
  winRate: number; // 0-100
  avgWin: number; // positive
  avgLoss: number; // positive (abs)
  tradesPerDay: number;
  targets: { label: string; value: number }[];
}): { evPerTrade: number; projections: Projection[] } {
  const wr = opts.winRate / 100;
  const evPerTrade = wr * opts.avgWin - (1 - wr) * opts.avgLoss;
  const projections: Projection[] = opts.targets.map(({ label, value }) => {
    const distance = value - opts.currentValue;
    if (distance <= 0) {
      return {
        label,
        target: value,
        reached: true,
        tradesNeeded: 0,
        daysNeeded: 0,
        etaDate: null,
        unreachable: false,
      };
    }
    if (evPerTrade <= 0) {
      return {
        label,
        target: value,
        reached: false,
        tradesNeeded: null,
        daysNeeded: null,
        etaDate: null,
        unreachable: true,
      };
    }
    const tradesNeeded = Math.ceil(distance / evPerTrade);
    const daysNeeded =
      opts.tradesPerDay > 0 ? Math.ceil(tradesNeeded / opts.tradesPerDay) : null;
    const etaDate =
      daysNeeded !== null
        ? new Date(Date.now() + daysNeeded * 86400000).toISOString().slice(0, 10)
        : null;
    return {
      label,
      target: value,
      reached: false,
      tradesNeeded,
      daysNeeded,
      etaDate,
      unreachable: false,
    };
  });
  return { evPerTrade, projections };
}

/**
 * Average trades per *trading* day across the dataset (so weekends/holidays
 * with zero trades don't drag the figure down). Returns 0 if no closed trades.
 */
export function tradesPerTradingDay(trades: Trade[]): number {
  const days = new Set<string>();
  let count = 0;
  for (const t of trades) {
    if (t.pnl === null || !t.exit_time) continue;
    days.add(t.exit_time.slice(0, 10));
    count += 1;
  }
  return days.size > 0 ? count / days.size : 0;
}

export function pnlByDay(trades: Trade[]): { date: string; pnl: number; trades: number }[] {
  const closed = trades.filter((t) => t.pnl !== null && t.exit_time);
  const byDay = new Map<string, { pnl: number; trades: number }>();
  for (const t of closed) {
    const day = t.exit_time!.slice(0, 10);
    const cur = byDay.get(day) ?? { pnl: 0, trades: 0 };
    cur.pnl += t.pnl ?? 0;
    cur.trades += 1;
    byDay.set(day, cur);
  }
  return Array.from(byDay.entries())
    .map(([date, v]) => ({ date, pnl: Math.round(v.pnl * 100) / 100, trades: v.trades }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Returns a map keyed by `YYYY-MM-DD` (the trade's exit date in local time)
 * so the calendar can do O(1) lookups per day cell.
 */
export function dailyPnlMap(trades: Trade[]): Map<string, { pnl: number; trades: number }> {
  const m = new Map<string, { pnl: number; trades: number }>();
  for (const t of trades) {
    if (t.pnl === null || !t.exit_time) continue;
    const d = new Date(t.exit_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cur = m.get(key) ?? { pnl: 0, trades: 0 };
    cur.pnl += t.pnl;
    cur.trades += 1;
    m.set(key, cur);
  }
  // round
  for (const [k, v] of m) m.set(k, { pnl: Math.round(v.pnl * 100) / 100, trades: v.trades });
  return m;
}
