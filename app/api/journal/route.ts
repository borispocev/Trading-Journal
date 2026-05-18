import { NextRequest, NextResponse } from "next/server";
import { getDb, type JournalEntry, type JournalPhoto, type Trade } from "@/lib/db";
import { enrichTradesWithFees } from "@/lib/commissions";
import { getCurrentUser } from "@/lib/auth";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const runtime = "nodejs";

// UPLOAD_DIR is set in production to /data/uploads (on the Fly volume). In dev
// it defaults to ./public/uploads so the dev server can serve photos directly.
// In production, the Dockerfile symlinks public/uploads -> /data/uploads so the
// URL path /uploads/xxx.png resolves regardless of where the file actually lives.
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
  const entries = db
    .prepare(
      "SELECT * FROM journal_entries WHERE user_id = ? ORDER BY entry_date DESC, id DESC"
    )
    .all(user.id) as JournalEntry[];

  const entryIds = entries.map((e) => e.id);
  let photos: JournalPhoto[] = [];
  if (entryIds.length > 0) {
    const placeholders = entryIds.map(() => "?").join(",");
    photos = db
      .prepare(
        `SELECT * FROM journal_photos WHERE journal_entry_id IN (${placeholders}) ORDER BY id ASC`
      )
      .all(...entryIds) as JournalPhoto[];
  }
  const photosByEntry = new Map<number, JournalPhoto[]>();
  for (const p of photos) {
    const arr = photosByEntry.get(p.journal_entry_id) ?? [];
    arr.push(p);
    photosByEntry.set(p.journal_entry_id, arr);
  }

  const tradeIds = Array.from(
    new Set(entries.map((e) => e.trade_id).filter((id): id is number => !!id))
  );
  const tradeById = new Map<number, ReturnType<typeof shapeTrade>>();
  if (tradeIds.length > 0) {
    const placeholders = tradeIds.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT * FROM trades WHERE user_id = ? AND id IN (${placeholders})`
      )
      .all(user.id, ...tradeIds) as Trade[];
    const enriched = enrichTradesWithFees(db, user.id, rows);
    for (const t of enriched) tradeById.set(t.id, shapeTrade(t));
  }

  return NextResponse.json(
    entries.map((e) => ({
      ...e,
      photos: photosByEntry.get(e.id) ?? [],
      trade: e.trade_id ? tradeById.get(e.trade_id) ?? null : null,
    }))
  );
}

function shapeTrade(t: ReturnType<typeof enrichTradesWithFees>[number]) {
  return {
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
  };
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const entry_date = String(form.get("entry_date") ?? "").trim();
  const title = String(form.get("title") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  const mood = String(form.get("mood") ?? "").trim() || null;
  const tradeIdRaw = form.get("trade_id");
  const trade_id =
    tradeIdRaw && String(tradeIdRaw).trim() !== "" ? Number(tradeIdRaw) : null;

  if (!entry_date) {
    return NextResponse.json({ error: "entry_date is required" }, { status: 400 });
  }

  const db = getDb();

  // If the entry references a trade, verify it belongs to this user.
  if (trade_id !== null) {
    const owned = db
      .prepare("SELECT 1 FROM trades WHERE id = ? AND user_id = ?")
      .get(trade_id, user.id);
    if (!owned) {
      return NextResponse.json(
        { error: "trade_id not found" },
        { status: 400 }
      );
    }
  }

  const ins = db.prepare(`
    INSERT INTO journal_entries (user_id, entry_date, title, notes, mood, trade_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const res = ins.run(user.id, entry_date, title, notes, mood, trade_id);
  const journal_entry_id = Number(res.lastInsertRowid);

  const photoIns = db.prepare(`
    INSERT INTO journal_photos (journal_entry_id, file_path, caption) VALUES (?, ?, ?)
  `);

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
    // Build the stored name from a server-generated token + sanitized ext —
    // never trust the original filename for path construction.
    const safeExt = ext.replace(/[^.\w]/g, "").slice(0, 8);
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    photoIns.run(journal_entry_id, `/uploads/${name}`, null);
  }

  return NextResponse.json({ id: journal_entry_id }, { status: 201 });
}
