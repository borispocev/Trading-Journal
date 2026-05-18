"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const FULLSCREEN_PATHS = ["/login", "/signup"];

export default function AppShell({
  user,
  children,
}: {
  user: { email: string; is_admin: boolean } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const fullscreen = FULLSCREEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (fullscreen) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-8">{children}</div>
      </main>
    </div>
  );
}
