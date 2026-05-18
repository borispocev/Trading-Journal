import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "tj_session";
const PUBLIC_PATHS = ["/login", "/signup"];
const PUBLIC_API_PREFIXES = ["/api/auth/"];

// Middleware runs at the edge — it can't touch SQLite, so it does only a
// presence check on the session cookie. Real session validation happens
// inside server components/API routes via getCurrentUser().
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;
  const isPublicPage = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!hasSession && !isPublicPage) {
    // API requests get a clean 401 so client-side fetches don't follow a
    // 307 into an HTML login page and choke on JSON parsing.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except Next internals and public static assets.
    "/((?!_next/static|_next/image|favicon.ico|uploads/).*)",
  ],
};
