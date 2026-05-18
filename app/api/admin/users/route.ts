import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { destroyAllSessionsForUser, getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

type UserRow = {
  id: number;
  email: string;
  is_admin: number;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
  trade_count: number;
  journal_count: number;
};

export async function GET() {
  const user = getCurrentUser();
  if (!user || user.is_admin !== 1) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         u.id, u.email, u.is_admin, u.is_active, u.created_at, u.last_login_at,
         (SELECT COUNT(*) FROM trades t WHERE t.user_id = u.id) AS trade_count,
         (SELECT COUNT(*) FROM journal_entries j WHERE j.user_id = u.id) AS journal_count
       FROM users u
       ORDER BY u.created_at ASC`
    )
    .all() as UserRow[];
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.is_admin !== 1) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const db = getDb();
  if (typeof body.is_active === "boolean") {
    if (id === user.id && body.is_active === false) {
      return NextResponse.json(
        { error: "You cannot deactivate yourself" },
        { status: 400 }
      );
    }
    db.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(
      body.is_active ? 1 : 0,
      id
    );
    if (!body.is_active) destroyAllSessionsForUser(id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.is_admin !== 1) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  if (id === user.id) {
    return NextResponse.json(
      { error: "You cannot delete yourself" },
      { status: 400 }
    );
  }

  const db = getDb();
  // FK cascades take care of trades, journal entries, accounts, commission_rates,
  // app_settings, sessions, and invites created by this user.
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
