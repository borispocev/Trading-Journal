import { NextResponse } from "next/server";
import { userCount } from "@/lib/auth";

export const runtime = "nodejs";
// This route doesn't read cookies/headers, so Next's App Router will cache
// the response by default. That's wrong here: the answer flips the first
// time anyone signs up and must reflect live DB state on every request.
export const dynamic = "force-dynamic";

// Public probe used by the signup page to decide whether to show the
// invite-code field. We deliberately do NOT expose any user identity here.
export async function GET() {
  return NextResponse.json({ hasUsers: userCount() > 0 });
}
