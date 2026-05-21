import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const db = getDb();
  const owned = db
    .prepare("SELECT id FROM withdrawals WHERE id = ? AND user_id = ?")
    .get(id, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photos = db
    .prepare("SELECT file_path FROM withdrawal_photos WHERE withdrawal_id = ?")
    .all(id) as { file_path: string }[];
  for (const p of photos) {
    // file_path is the URL path "/uploads/<name>" — strip to basename and
    // resolve against UPLOAD_DIR so it works in dev and on the Fly volume.
    const base = path.basename(p.file_path);
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, base));
    } catch {
      // ignore
    }
  }
  // withdrawal_photos rows cascade via the FK ON DELETE CASCADE.
  db.prepare("DELETE FROM withdrawals WHERE id = ? AND user_id = ?").run(
    id,
    user.id
  );
  return NextResponse.json({ ok: true });
}
