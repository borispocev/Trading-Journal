import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const VALID = new Set(["trades", "journal", "accounts", "all"]);

export async function POST(req: NextRequest) {
  const { target } = await req.json();
  if (!VALID.has(target)) {
    return NextResponse.json({ error: "invalid target" }, { status: 400 });
  }
  const db = getDb();
  const counts: Record<string, number> = {};

  if (target === "trades" || target === "all") {
    counts.trades = db.prepare("DELETE FROM trades").run().changes;
  }
  if (target === "journal" || target === "all") {
    const dir = path.join(process.cwd(), "public", "uploads");
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f === ".gitkeep") continue;
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {}
      }
    }
    counts.photos = db.prepare("DELETE FROM journal_photos").run().changes;
    counts.journal = db.prepare("DELETE FROM journal_entries").run().changes;
  }
  if (target === "accounts" || target === "all") {
    counts.accounts = db.prepare("DELETE FROM accounts").run().changes;
  }

  return NextResponse.json({ ok: true, deleted: counts });
}
