import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Tradovate Journal",
  description: "Personal trading journal for Tradovate / Apex prop accounts",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = getCurrentUser();
  const shellUser = user
    ? { email: user.email, is_admin: user.is_admin === 1 }
    : null;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell user={shellUser}>{children}</AppShell>
      </body>
    </html>
  );
}
