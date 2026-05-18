import { NextRequest, NextResponse } from "next/server";
import { getDb, type CommissionRate } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rates = db
    .prepare(
      "SELECT root, rate_per_side, updated_at FROM commission_rates WHERE user_id = ? ORDER BY root ASC"
    )
    .all(user.id) as Pick<CommissionRate, "root" | "rate_per_side" | "updated_at">[];
  const def = db
    .prepare(
      "SELECT value FROM app_settings WHERE user_id = ? AND key = 'default_commission_per_side'"
    )
    .get(user.id) as { value: string } | undefined;
  return NextResponse.json({
    rates,
    default_per_side: def ? Number(def.value) : 0.74,
  });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = getDb();

  if (typeof body.default_per_side === "number" || typeof body.default_per_side === "string") {
    const v = Number(body.default_per_side);
    if (Number.isFinite(v) && v >= 0) {
      db.prepare(
        `INSERT INTO app_settings (user_id, key, value) VALUES (?, 'default_commission_per_side', ?)
         ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
      ).run(user.id, String(v));
    }
  }

  if (Array.isArray(body.rates)) {
    const up = db.prepare(
      `INSERT INTO commission_rates (user_id, root, rate_per_side, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, root) DO UPDATE SET
         rate_per_side = excluded.rate_per_side,
         updated_at = datetime('now')`
    );
    const tx = db.transaction((rows: { root: string; rate_per_side: number }[]) => {
      for (const r of rows) {
        const root = String(r.root ?? "").trim().toUpperCase();
        const rate = Number(r.rate_per_side);
        if (!root || !Number.isFinite(rate) || rate < 0) continue;
        up.run(user.id, root, rate);
      }
    });
    tx(body.rates);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { root } = await req.json();
  if (!root || typeof root !== "string") {
    return NextResponse.json({ error: "root required" }, { status: 400 });
  }
  const db = getDb();
  db.prepare(
    "DELETE FROM commission_rates WHERE user_id = ? AND root = ?"
  ).run(user.id, root.toUpperCase());
  return NextResponse.json({ ok: true });
}
