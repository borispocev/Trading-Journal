import type Database from "better-sqlite3";
import type { Trade, CommissionRate } from "./db";

/**
 * Extracts the root contract symbol from a Tradovate symbol.
 * MNQM6 → MNQ, MESH26 → MES, MCLM6 → MCL. Falls back to the input.
 */
export function extractRoot(symbol: string): string {
  const s = String(symbol).trim().toUpperCase();
  const m = s.match(/^([A-Z]{1,4}?)([FGHJKMNQUVXZ]\d{1,2})$/);
  if (m) return m[1];
  const m2 = s.match(/^([A-Z]+?)(\d.*)$/);
  if (m2) return m2[1];
  return s;
}

export type RateTable = {
  bySymbol: Map<string, number>;
  defaultPerSide: number;
};

export function loadRateTable(db: Database.Database): RateTable {
  const rows = db
    .prepare("SELECT root, rate_per_side FROM commission_rates")
    .all() as Pick<CommissionRate, "root" | "rate_per_side">[];
  const bySymbol = new Map<string, number>();
  for (const r of rows) bySymbol.set(r.root.toUpperCase(), Number(r.rate_per_side));
  const def = db
    .prepare("SELECT value FROM app_settings WHERE key = 'default_commission_per_side'")
    .get() as { value: string } | undefined;
  const defaultPerSide = def ? Number(def.value) : 0.74;
  return { bySymbol, defaultPerSide };
}

export function feesForTrade(
  symbol: string,
  qty: number,
  rates: RateTable
): number {
  const root = extractRoot(symbol);
  const perSide = rates.bySymbol.get(root) ?? rates.defaultPerSide;
  // Round-trip: entry + exit
  return Math.round(perSide * qty * 2 * 100) / 100;
}

export type EnrichedTrade = Trade & {
  gross_pnl: number | null;
  fees_calc: number;
  net_pnl: number | null;
};

/**
 * Returns a Trade[]-shaped view where `pnl` is net (gross − fees) and
 * `fees` is the calculated round-trip commission. Use this to feed
 * existing stat / chart functions that expect Trade[] but should treat
 * net P&L as the value to aggregate.
 */
export function asNetTrades(enriched: EnrichedTrade[]): Trade[] {
  return enriched.map((t) => ({
    ...t,
    pnl: t.net_pnl,
    fees: t.fees_calc,
  }));
}

/**
 * Attaches calculated fees and net P&L (gross − fees) to each trade,
 * using the configured commission_rates table.
 */
export function enrichTradesWithFees(
  db: Database.Database,
  trades: Trade[]
): EnrichedTrade[] {
  const rates = loadRateTable(db);
  return trades.map((t) => {
    const gross = t.pnl;
    const fees = feesForTrade(t.symbol, t.qty, rates);
    return {
      ...t,
      gross_pnl: gross,
      fees_calc: fees,
      net_pnl: gross === null ? null : Math.round((gross - fees) * 100) / 100,
    };
  });
}
