import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const VALID = new Set(["trades", "journal", "withdrawals", "accounts", "all"]);
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { target } = await req.json();
  if (!VALID.has(target)) {
    return NextResponse.json({ error: "invalid target" }, { status: 400 });
  }
  const db = getDb();
  const counts: Record<string, number> = {};

  if (target === "trades" || target === "all") {
    counts.trades = db
      .prepare("DELETE FROM trades WHERE user_id = ?")
      .run(user.id).changes;
  }
  if (target === "journal" || target === "all") {
    // Only this user's photos. Scope by joining through journal_entries.
    const photoPaths = db
      .prepare(
        `SELECT p.file_path
           FROM journal_photos p
           JOIN journal_entries e ON e.id = p.journal_entry_id
          WHERE e.user_id = ?`
      )
      .all(user.id) as { file_path: string }[];

    for (const p of photoPaths) {
      const base = path.basename(p.file_path);
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, base));
      } catch {}
    }

    counts.photos = db
      .prepare(
        `DELETE FROM journal_photos
          WHERE journal_entry_id IN (
            SELECT id FROM journal_entries WHERE user_id = ?
          )`
      )
      .run(user.id).changes;
    counts.journal = db
      .prepare("DELETE FROM journal_entries WHERE user_id = ?")
      .run(user.id).changes;
  }
  if (target === "withdrawals" || target === "all") {
    // Unlink certificate images first, scoped to this user via the join.
    const certPaths = db
      .prepare(
        `SELECT p.file_path
           FROM withdrawal_photos p
           JOIN withdrawals w ON w.id = p.withdrawal_id
          WHERE w.user_id = ?`
      )
      .all(user.id) as { file_path: string }[];

    for (const p of certPaths) {
      const base = path.basename(p.file_path);
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, base));
      } catch {}
    }

    counts.withdrawal_photos = db
      .prepare(
        `DELETE FROM withdrawal_photos
          WHERE withdrawal_id IN (
            SELECT id FROM withdrawals WHERE user_id = ?
          )`
      )
      .run(user.id).changes;
    counts.withdrawals = db
      .prepare("DELETE FROM withdrawals WHERE user_id = ?")
      .run(user.id).changes;
  }
  if (target === "accounts" || target === "all") {
    counts.accounts = db
      .prepare("DELETE FROM accounts WHERE user_id = ?")
      .run(user.id).changes;
  }

  return NextResponse.json({ ok: true, deleted: counts });
}
