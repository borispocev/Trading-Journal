import Papa from "papaparse";

export type ParsedTrade = {
  external_id: string | null;
  account: string | null;
  symbol: string;
  side: "long" | "short";
  qty: number;
  entry_price: number;
  exit_price: number | null;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  fees: number;
  duration_seconds: number | null;
};

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  let s = String(v).replace(/[$,\s]/g, "");
  // Tradovate writes negative P&L as accountant parens, e.g. "$(88.00)".
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * Parses Tradovate duration strings like "5sec", "24min 6sec", "1h 29min 32sec".
 * Returns total seconds, or null if unrecognized.
 */
function parseDurationStr(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  // Pure number → already in seconds
  const asNum = Number(s);
  if (Number.isFinite(asNum)) return asNum;
  let total = 0;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    matched = true;
    const n = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (unit.startsWith("h")) total += n * 3600;
    else if (unit.startsWith("m")) total += n * 60;
    else total += n;
  }
  return matched ? Math.round(total) : null;
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Try MM/DD/YYYY HH:MM:SS
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (m) {
    let hh = parseInt(m[4], 10);
    if (m[7]?.toUpperCase() === "PM" && hh < 12) hh += 12;
    if (m[7]?.toUpperCase() === "AM" && hh === 12) hh = 0;
    const dt = new Date(
      parseInt(m[3], 10),
      parseInt(m[1], 10) - 1,
      parseInt(m[2], 10),
      hh,
      parseInt(m[5], 10),
      m[6] ? parseInt(m[6], 10) : 0
    );
    return dt.toISOString();
  }
  return null;
}

function findKey(row: Record<string, unknown>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find((k) => k.toLowerCase().replace(/[\s_]/g, "") === c.toLowerCase().replace(/[\s_]/g, ""));
    if (found) return found;
  }
  return undefined;
}

function getStr(row: Record<string, unknown>, candidates: string[]): string | null {
  const k = findKey(row, candidates);
  if (!k) return null;
  const v = row[k];
  if (v === undefined || v === null || v === "") return null;
  return String(v).trim();
}

function getNum(row: Record<string, unknown>, candidates: string[]): number | null {
  const k = findKey(row, candidates);
  if (!k) return null;
  return num(row[k]);
}

/**
 * Parses Tradovate Performance/Trade History CSV exports. The shape of these
 * exports varies across Tradovate versions; we look for several common
 * column-name variants and fall back to fills-style rows if needed.
 */
export function parseTradovateCsv(
  csv: string,
  opts: { defaultAccount?: string | null } = {}
): { trades: ParsedTrade[]; warnings: string[] } {
  const defaultAccount = opts.defaultAccount ?? null;
  const result = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const warnings: string[] = [];
  if (result.errors.length) {
    warnings.push(`CSV parse warnings: ${result.errors.length} (using best-effort)`);
  }

  const rows = result.data.filter((r) => r && Object.keys(r).length > 0);
  if (rows.length === 0) return { trades: [], warnings: ["CSV has no rows"] };

  const sample = rows[0];
  const hasPaired =
    findKey(sample, ["buyPrice", "sellPrice", "pnl", "boughtTimestamp", "soldTimestamp"]);

  const trades: ParsedTrade[] = [];

  if (hasPaired) {
    for (const row of rows) {
      const symbol = getStr(row, ["symbol", "contract", "contractName", "instrument"]);
      const qty = getNum(row, ["qty", "quantity", "filledQty"]);
      const buyPrice = getNum(row, ["buyPrice", "buy_price"]);
      const sellPrice = getNum(row, ["sellPrice", "sell_price"]);
      const pnl = getNum(row, ["pnl", "P&L", "profit", "netPnl", "realizedPnl"]);
      const bought = parseDate(getStr(row, ["boughtTimestamp", "bought", "buyTime", "buyTimestamp"]));
      const sold = parseDate(getStr(row, ["soldTimestamp", "sold", "sellTime", "sellTimestamp"]));
      const account = getStr(row, ["account", "accountName"]) ?? defaultAccount;
      const buyFillId = getStr(row, ["buyFillId", "buyId"]);
      const sellFillId = getStr(row, ["sellFillId", "sellId"]);
      const durationKey = findKey(row, ["duration", "durationSeconds", "duration_seconds"]);
      const duration = durationKey ? parseDurationStr(row[durationKey]) : null;
      const fees = getNum(row, ["fees", "commission", "commissions"]) ?? 0;

      if (!symbol || qty === null || buyPrice === null || sellPrice === null || !bought || !sold) {
        warnings.push(`Skipped row: missing required fields (${JSON.stringify(row).slice(0, 100)})`);
        continue;
      }

      const side: "long" | "short" = bought <= sold ? "long" : "short";
      const entry_time = side === "long" ? bought : sold;
      const exit_time = side === "long" ? sold : bought;
      const entry_price = side === "long" ? buyPrice : sellPrice;
      const exit_price = side === "long" ? sellPrice : buyPrice;
      const external_id = [buyFillId, sellFillId, symbol, qty, entry_time].filter(Boolean).join("|");

      trades.push({
        external_id,
        account,
        symbol,
        side,
        qty,
        entry_price,
        exit_price,
        entry_time,
        exit_time,
        pnl,
        fees,
        duration_seconds:
          duration ??
          Math.round((new Date(exit_time).getTime() - new Date(entry_time).getTime()) / 1000),
      });
    }
    return { trades, warnings };
  }

  // Fallback: fills format. Pair buys and sells per symbol/account FIFO.
  type Fill = {
    time: string;
    side: "B" | "S";
    qty: number;
    price: number;
    symbol: string;
    account: string | null;
    id: string | null;
  };
  const fills: Fill[] = [];
  for (const row of rows) {
    const symbol = getStr(row, ["symbol", "contract", "contractName"]);
    const sideStr = getStr(row, ["B/S", "side", "BuySell", "action"]);
    const qty = getNum(row, ["filledQty", "qty", "quantity"]);
    const price = getNum(row, ["avgPrice", "price", "fillPrice"]);
    const time = parseDate(getStr(row, ["fillTime", "timestamp", "time", "filledTime"]));
    const account = getStr(row, ["account", "accountName"]) ?? defaultAccount;
    const id = getStr(row, ["orderId", "id", "fillId"]);
    if (!symbol || !sideStr || qty === null || price === null || !time) {
      warnings.push(`Skipped fill: missing fields`);
      continue;
    }
    const sideNorm = sideStr.toUpperCase().startsWith("B") ? "B" : "S";
    fills.push({ time, side: sideNorm, qty, price, symbol, account, id });
  }

  fills.sort((a, b) => (a.time < b.time ? -1 : 1));

  const openByKey = new Map<string, Fill[]>();
  for (const f of fills) {
    const key = `${f.symbol}|${f.account ?? ""}`;
    const open = openByKey.get(key) ?? [];
    if (open.length === 0 || open[0].side === f.side) {
      open.push(f);
      openByKey.set(key, open);
      continue;
    }
    let remaining = f.qty;
    while (remaining > 0 && open.length > 0) {
      const o = open[0];
      const matched = Math.min(o.qty, remaining);
      const side: "long" | "short" = o.side === "B" ? "long" : "short";
      const entry_time = o.time;
      const exit_time = f.time;
      const entry_price = o.price;
      const exit_price = f.price;
      const pnl =
        side === "long"
          ? (exit_price - entry_price) * matched
          : (entry_price - exit_price) * matched;
      trades.push({
        external_id: [o.id, f.id, f.symbol, matched, entry_time].filter(Boolean).join("|"),
        account: f.account,
        symbol: f.symbol,
        side,
        qty: matched,
        entry_price,
        exit_price,
        entry_time,
        exit_time,
        pnl,
        fees: 0,
        duration_seconds: Math.round(
          (new Date(exit_time).getTime() - new Date(entry_time).getTime()) / 1000
        ),
      });
      o.qty -= matched;
      remaining -= matched;
      if (o.qty === 0) open.shift();
    }
    if (remaining > 0) {
      open.push({ ...f, qty: remaining });
    }
    openByKey.set(key, open);
  }

  return { trades, warnings };
}
