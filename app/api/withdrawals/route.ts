import { NextRequest, NextResponse } from "next/server";
import { getDb, type Withdrawal, type WithdrawalPhoto } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const runtime = "nodejs";

// UPLOAD_DIR mirrors the journal route: /data/uploads on the Fly volume in
// production (symlinked from public/uploads), ./public/uploads in dev.
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB per file
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM withdrawals WHERE user_id = ? ORDER BY withdraw_date DESC, id DESC"
    )
    .all(user.id) as Withdrawal[];

  const ids = rows.map((w) => w.id);
  let photos: WithdrawalPhoto[] = [];
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    photos = db
      .prepare(
        `SELECT * FROM withdrawal_photos WHERE withdrawal_id IN (${placeholders}) ORDER BY id ASC`
      )
      .all(...ids) as WithdrawalPhoto[];
  }
  const byWithdrawal = new Map<number, WithdrawalPhoto[]>();
  for (const p of photos) {
    const arr = byWithdrawal.get(p.withdrawal_id) ?? [];
    arr.push(p);
    byWithdrawal.set(p.withdrawal_id, arr);
  }

  const total = rows.reduce((s, w) => s + w.amount, 0);

  return NextResponse.json({
    total: Math.round(total * 100) / 100,
    withdrawals: rows.map((w) => ({
      ...w,
      photos: byWithdrawal.get(w.id) ?? [],
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const withdraw_date = String(form.get("withdraw_date") ?? "").trim();
  const note = String(form.get("note") ?? "").trim() || null;
  const amount = Number(form.get("amount"));

  if (!withdraw_date) {
    return NextResponse.json(
      { error: "withdraw_date is required" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number" },
      { status: 400 }
    );
  }

  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO withdrawals (user_id, amount, withdraw_date, note) VALUES (?, ?, ?, ?)"
    )
    .run(user.id, amount, withdraw_date, note);
  const withdrawal_id = Number(res.lastInsertRowid);

  const photoIns = db.prepare(
    "INSERT INTO withdrawal_photos (withdrawal_id, file_path, caption) VALUES (?, ?, ?)"
  );

  const files = form.getAll("photos");
  for (const f of files) {
    if (!(f instanceof Blob) || (f as File).size === 0) continue;
    const file = f as File;
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` },
        { status: 413 }
      );
    }
    const ext = (path.extname(file.name) || ".png").toLowerCase();
    if (!ALLOWED_MIME.has(file.type) || !ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, WEBP, or GIF images are allowed" },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    // Server-generated name + sanitized ext — never trust the original filename.
    const safeExt = ext.replace(/[^.\w]/g, "").slice(0, 8);
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    photoIns.run(withdrawal_id, `/uploads/${name}`, null);
  }

  return NextResponse.json({ id: withdrawal_id }, { status: 201 });
}
