import { NextResponse } from "next/server";
import { userCount } from "@/lib/auth";

export const runtime = "nodejs";

// Public probe used by the signup page to decide whether to show the
// invite-code field. We deliberately do NOT expose any user identity here.
export async function GET() {
  return NextResponse.json({ hasUsers: userCount() > 0 });
}
