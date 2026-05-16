import { NextRequest, NextResponse } from "next/server";
import { getDb, type JournalEntry, type JournalPhoto, type Trade } from "@/lib/db";
import { enrichTradesWithFees } from "@/lib/commissions";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export async function GET() {
  const db = getDb();
  const entries = db
    .prepare("SELECT * FROM journal_entries ORDER BY entry_date DESC, id DESC")
    .all() as JournalEntry[];
  const photos = db
    .prepare("SELECT * FROM journal_photos ORDER BY id ASC")
    .all() as JournalPhoto[];
  const photosByEntry = new Map<number, JournalPhoto[]>();
  for (const p of photos) {
    const arr = photosByEntry.get(p.journal_entry_id) ?? [];
    arr.push(p);
    photosByEntry.set(p.journal_entry_id, arr);
  }

  // Embed linked-trade snapshots (with calculated net P&L) when entries
  // reference a trade — saves a second round-trip in the journal page.
  const tradeIds = Array.from(
    new Set(entries.map((e) => e.trade_id).filter((id): id is number => !!id))
  );
  const tradeById = new Map<number, ReturnType<typeof shapeTrade>>();
  if (tradeIds.length > 0) {
    const placeholders = tradeIds.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT * FROM trades WHERE id IN (${placeholders})`)
      .all(...tradeIds) as Trade[];
    const enriched = enrichTradesWithFees(db, rows);
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
  const ins = db.prepare(`
    INSERT INTO journal_entries (entry_date, title, notes, mood, trade_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const res = ins.run(entry_date, title, notes, mood, trade_id);
  const journal_entry_id = Number(res.lastInsertRowid);

  const photoIns = db.prepare(`
    INSERT INTO journal_photos (journal_entry_id, file_path, caption) VALUES (?, ?, ?)
  `);

  const files = form.getAll("photos");
  for (const f of files) {
    if (!(f instanceof Blob) || (f as File).size === 0) continue;
    const file = f as File;
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || ".png";
    const safeExt = ext.replace(/[^.\w]/g, "").slice(0, 8);
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    photoIns.run(journal_entry_id, `/uploads/${name}`, null);
  }

  return NextResponse.json({ id: journal_entry_id }, { status: 201 });
}
