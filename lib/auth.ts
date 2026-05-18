import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, INVITE_TTL_MINUTES, type User } from "./db";

export const SESSION_COOKIE = "tj_session";
const SESSION_TTL_DAYS = 30;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function createSession(userId: number): { id: string; expiresAt: Date } {
  const db = getDb();
  const id = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(id, userId, expiresAt.toISOString());
  return { id, expiresAt };
}

export function destroySession(sessionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function destroyAllSessionsForUser(userId: number): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

/**
 * Resolve the current user from the session cookie. Returns null when
 * unauthenticated, expired, or the user has been deactivated. Also
 * GC's the expired session row when it finds one.
 */
export function getCurrentUser(): User | null {
  const c = cookies().get(SESSION_COOKIE);
  if (!c?.value) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at AS s_expires
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
    .get(c.value) as (User & { s_expires: string }) | undefined;
  if (!row) return null;
  if (new Date(row.s_expires).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(c.value);
    return null;
  }
  if (row.is_active !== 1) return null;
  const { s_expires, ...user } = row;
  return user;
}

export function requireUser(): User {
  const u = getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export function requireAdmin(): User {
  const u = requireUser();
  if (u.is_admin !== 1) redirect("/");
  return u;
}

export function userCount(): number {
  const db = getDb();
  const r = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  return r.c;
}

export function generateInviteCode(
  createdByUserId: number
): { code: string; expiresAt: Date } {
  const db = getDb();
  // Short, human-shareable: 12 hex chars (~48 bits of entropy — fine for an
  // invite that's single-use and only checked against this DB).
  const code = randomToken(6).toUpperCase();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MINUTES * 60 * 1000);
  db.prepare(
    "INSERT INTO invite_codes (code, created_by_user_id, expires_at) VALUES (?, ?, ?)"
  ).run(code, createdByUserId, expiresAt.toISOString());
  return { code, expiresAt };
}

export type InviteValidation =
  | { ok: true }
  | { ok: false; reason: "not_found" | "used" | "expired" };

export function validateInviteCode(code: string): InviteValidation {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT code, used_by_user_id, expires_at FROM invite_codes WHERE code = ?"
    )
    .get(code) as
    | { code: string; used_by_user_id: number | null; expires_at: string | null }
    | undefined;
  if (!row) return { ok: false, reason: "not_found" };
  if (row.used_by_user_id !== null) return { ok: false, reason: "used" };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export function consumeInviteCode(code: string, byUserId: number): boolean {
  const db = getDb();
  // SQL-level expiry guard so a race between validate() and consume() can't
  // slip through an expired code.
  const res = db
    .prepare(
      `UPDATE invite_codes
          SET used_by_user_id = ?, used_at = datetime('now')
        WHERE code = ?
          AND used_by_user_id IS NULL
          AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
    .run(byUserId, code);
  return res.changes > 0;
}
