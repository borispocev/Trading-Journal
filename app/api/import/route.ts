import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseTradovateCsv } from "@/lib/tradovate";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const text = await file.text();
  const accountField = form.get("account");
  const defaultAccount =
    typeof accountField === "string" && accountField.trim() ? accountField.trim() : null;
  const { trades, warnings } = parseTradovateCsv(text, { defaultAccount });

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO trades
      (user_id, external_id, account, symbol, side, qty, entry_price, exit_price,
       entry_time, exit_time, pnl, fees, duration_seconds)
    VALUES
      (@user_id, @external_id, @account, @symbol, @side, @qty, @entry_price, @exit_price,
       @entry_time, @exit_time, @pnl, @fees, @duration_seconds)
    ON CONFLICT(user_id, external_id) DO NOTHING
  `);

  const tx = db.transaction((rows: typeof trades) => {
    let inserted = 0;
    for (const r of rows) {
      const res = insert.run({ ...r, user_id: user.id });
      if (res.changes > 0) inserted += 1;
    }
    return inserted;
  });

  const inserted = tx(trades);

  return NextResponse.json({
    parsed: trades.length,
    inserted,
    duplicates: trades.length - inserted,
    warnings,
  });
}
