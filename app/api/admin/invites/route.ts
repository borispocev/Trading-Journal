import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateInviteCode, getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

type InviteRow = {
  code: string;
  created_by_user_id: number;
  used_by_user_id: number | null;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_by_email: string | null;
};

export async function GET() {
  const user = getCurrentUser();
  if (!user || user.is_admin !== 1) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT i.code, i.created_by_user_id, i.used_by_user_id, i.created_at,
              i.expires_at, i.used_at,
              u.email AS used_by_email
         FROM invite_codes i
         LEFT JOIN users u ON u.id = i.used_by_user_id
        ORDER BY i.created_at DESC`
    )
    .all() as InviteRow[];
  return NextResponse.json(rows);
}

export async function POST() {
  const user = getCurrentUser();
  if (!user || user.is_admin !== 1) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { code, expiresAt } = generateInviteCode(user.id);
  return NextResponse.json({ code, expires_at: expiresAt.toISOString() });
}

export async function DELETE(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.is_admin !== 1) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const db = getDb();
  // Only allow deleting unused codes — used ones are kept as a record.
  const res = db
    .prepare("DELETE FROM invite_codes WHERE code = ? AND used_by_user_id IS NULL")
    .run(code);
  if (res.changes === 0) {
    return NextResponse.json(
      { error: "Code not found or already used" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
