import { NextRequest, NextResponse } from "next/server";
import { getDb, type User } from "@/lib/db";
import { SESSION_COOKIE, createSession, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 10 attempts per minute per IP. Tight enough to defeat online brute force
  // but won't bother a real user fat-fingering their password.
  const limited = rateLimit(req, "login", { max: 10, windowMs: 60 * 1000 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as User | undefined;

  // Generic message for both wrong-email and wrong-password to avoid
  // leaking which accounts exist.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (user.is_active !== 1) {
    return NextResponse.json(
      { error: "Account disabled — contact the admin" },
      { status: 403 }
    );
  }

  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(
    user.id
  );

  const session = createSession(user.id);
  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, is_admin: user.is_admin === 1 },
  });
  response.cookies.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(session.expiresAt),
    path: "/",
  });
  return response;
}
