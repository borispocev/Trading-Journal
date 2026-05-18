import { NextRequest, NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

// Process-local map. Single-node deployments only — fine for a Hetzner VPS.
// Multi-instance would need Redis/SQLite; we'd swap the backend, not the API.
const buckets = new Map<string, Bucket>();

function clientIp(req: NextRequest): string {
  // Trust X-Forwarded-For only when running behind a reverse proxy we control.
  // Caddy / Nginx in the provided compose set this header.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return req.ip ?? "unknown";
}

export type RateLimitOpts = {
  max: number;
  windowMs: number;
};

/**
 * Returns a 429 response if the caller is over the limit, otherwise null.
 * Increments the counter on every call (failed and successful) — this is
 * intentional for auth endpoints where we want to slow attackers regardless
 * of whether their guess succeeded.
 */
export function rateLimit(
  req: NextRequest,
  scope: string,
  opts: RateLimitOpts
): NextResponse | null {
  const ip = clientIp(req);
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    sweep(now);
    return null;
  }

  if (b.count >= opts.max) {
    const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  b.count += 1;
  return null;
}

let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}
