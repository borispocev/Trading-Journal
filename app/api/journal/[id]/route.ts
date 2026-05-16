import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const db = getDb();
  const photos = db
    .prepare("SELECT file_path FROM journal_photos WHERE journal_entry_id = ?")
    .all(id) as { file_path: string }[];
  for (const p of photos) {
    const abs = path.join(process.cwd(), "public", p.file_path.replace(/^\//, ""));
    try {
      fs.unlinkSync(abs);
    } catch {
      // ignore
    }
  }
  db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
