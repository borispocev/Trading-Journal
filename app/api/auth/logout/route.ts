import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, destroySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (sid) destroySession(sid);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
  return response;
}
