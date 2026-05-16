import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, account_size, max_daily_loss, trailing_drawdown,
              min_withdraw, max_withdraw, is_active, created_at
       FROM accounts
       ORDER BY is_active DESC, name ASC`
    )
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Activate-only path: { activate: <id> } makes that account the active one.
  if (body.activate !== undefined && body.activate !== null) {
    const db = getDb();
    const id = Number(body.activate);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }
    const tx = db.transaction(() => {
      db.prepare("UPDATE accounts SET is_active = 0").run();
      db.prepare("UPDATE accounts SET is_active = 1 WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const account_size = toNum(body.account_size);
  const max_daily_loss = toNum(body.max_daily_loss);
  const trailing_drawdown = toNum(body.trailing_drawdown);
  const min_withdraw = toNum(body.min_withdraw);
  const max_withdraw = toNum(body.max_withdraw);

  const db = getDb();
  db.prepare(
    `INSERT INTO accounts
       (name, account_size, max_daily_loss, trailing_drawdown, min_withdraw, max_withdraw)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       account_size = excluded.account_size,
       max_daily_loss = excluded.max_daily_loss,
       trailing_drawdown = excluded.trailing_drawdown,
       min_withdraw = excluded.min_withdraw,
       max_withdraw = excluded.max_withdraw`
  ).run(
    name,
    account_size,
    max_daily_loss,
    trailing_drawdown,
    min_withdraw,
    max_withdraw
  );

  // If no account is active yet, mark the first inserted one active.
  const activeCount = db
    .prepare("SELECT COUNT(*) as c FROM accounts WHERE is_active = 1")
    .get() as { c: number };
  if (activeCount.c === 0) {
    db.prepare(
      "UPDATE accounts SET is_active = 1 WHERE id = (SELECT id FROM accounts ORDER BY id ASC LIMIT 1)"
    ).run();
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const numId = Number(id);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const db = getDb();
  db.prepare("DELETE FROM accounts WHERE id = ?").run(numId);
  return NextResponse.json({ ok: true });
}
