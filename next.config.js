/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle in .next/standalone — the Dockerfile copies
  // just this folder + .next/static + public, no node_modules at runtime.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        // Conservative CSP. Inline scripts and styles are allowed because Next's
        // App Router emits inline hydration/streaming scripts (`self.__next_f`)
        // and Tailwind/Recharts inject inline styles. For stricter security
        // upgrade to per-request nonces via middleware:
        // https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob:",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
