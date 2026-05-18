import { NextRequest, NextResponse } from "next/server";
import { getDb, seedUserDefaults } from "@/lib/db";
import {
  SESSION_COOKIE,
  consumeInviteCode,
  createSession,
  hashPassword,
  userCount,
  validateInviteCode,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function normEmail(e: string) {
  return e.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "signup", { max: 5, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const email = normEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const inviteCode = String(body.invite_code ?? "").trim().toUpperCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = getDb();
  const isFirstUser = userCount() === 0;

  // After the first user is created, every subsequent signup needs a code.
  if (!isFirstUser && !inviteCode) {
    return NextResponse.json({ error: "Invite code required" }, { status: 400 });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  // Validate invite (skip for the very first user — they get auto-admin).
  if (!isFirstUser) {
    const check = validateInviteCode(inviteCode);
    if (!check.ok) {
      const msg =
        check.reason === "expired"
          ? "Invite code has expired"
          : check.reason === "used"
          ? "Invite code has already been used"
          : "Invalid invite code";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const hash = hashPassword(password);
  const res = db
    .prepare(
      "INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, ?)"
    )
    .run(email, hash, isFirstUser ? 1 : 0);
  const userId = Number(res.lastInsertRowid);

  if (!isFirstUser) {
    const consumed = consumeInviteCode(inviteCode, userId);
    if (!consumed) {
      // Race: code was used or expired between validate and consume. Roll the
      // new user back so we never grant access without a valid invite.
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      return NextResponse.json(
        { error: "Invite code is no longer valid" },
        { status: 400 }
      );
    }
  }

  seedUserDefaults(db, userId);

  const session = createSession(userId);
  const response = NextResponse.json({
    ok: true,
    user: { id: userId, email, is_admin: isFirstUser },
  });
  response.cookies.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: session.expiresAt,
    path: "/",
  });
  return response;
}
