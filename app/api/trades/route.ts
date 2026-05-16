import { NextResponse } from "next/server";
import { getDb, type Trade } from "@/lib/db";
import { enrichTradesWithFees } from "@/lib/commissions";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const trades = db
    .prepare("SELECT * FROM trades ORDER BY entry_time DESC LIMIT 500")
    .all() as Trade[];
  const enriched = enrichTradesWithFees(db, trades);
  // Slim payload — the picker only needs identifying fields + P&L.
  return NextResponse.json(
    enriched.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      qty: t.qty,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      entry_time: t.entry_time,
      exit_time: t.exit_time,
      duration_seconds: t.duration_seconds,
      account: t.account,
      gross_pnl: t.gross_pnl,
      fees: t.fees_calc,
      net_pnl: t.net_pnl,
    }))
  );
}
