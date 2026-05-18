"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type IconProps = { className?: string };

function IconShield({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLogout({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDashboard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 13h7V3H3v10Zm0 8h7v-6H3v6Zm11 0h7V11h-7v10Zm0-18v6h7V3h-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconCalendar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconList({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconBook({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 7h7M8 11h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconUpload({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconCalculator({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="8"
        y="6"
        width="8"
        height="3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M9 13h.01M12 13h.01M15 13h.01M9 17h.01M12 17h.01M15 17h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconSettings({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NAV: { href: string; label: string; Icon: (p: IconProps) => JSX.Element }[] = [
  { href: "/", label: "Dashboard", Icon: IconDashboard },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/trades", label: "Trades", Icon: IconList },
  { href: "/journal", label: "Journal", Icon: IconBook },
  { href: "/position-calculator", label: "Position Calc", Icon: IconCalculator },
  { href: "/import", label: "Import", Icon: IconUpload },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

export default function Sidebar({
  user,
}: {
  user: { email: string; is_admin: boolean } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 min-h-screen p-4 border-r border-bg-border bg-bg-panel/60 backdrop-blur-sm flex flex-col">
      <Link href="/" className="flex items-center gap-2.5 mb-8 px-1.5 group">
        <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-muted shadow-glow">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-bg" fill="none">
            <path
              d="M3 17l5-6 4 4 7-9"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 6h5v5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tightish text-slate-100">
            Tradovate
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Journal
          </div>
        </div>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? "bg-bg-card text-slate-50"
                  : "text-slate-400 hover:bg-bg-card/60 hover:text-slate-100"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent" />
              )}
              <Icon
                className={`h-[18px] w-[18px] ${
                  active ? "text-accent" : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
        {user?.is_admin && (
          <Link
            href="/admin"
            className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              pathname.startsWith("/admin")
                ? "bg-bg-card text-slate-50"
                : "text-slate-400 hover:bg-bg-card/60 hover:text-slate-100"
            }`}
          >
            {pathname.startsWith("/admin") && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent" />
            )}
            <IconShield
              className={`h-[18px] w-[18px] ${
                pathname.startsWith("/admin") ? "text-accent" : "text-slate-500"
              }`}
            />
            <span className="font-medium">Admin</span>
          </Link>
        )}
      </nav>

      <div className="mt-auto pt-6 space-y-2">
        {user && (
          <div className="rounded-lg border border-bg-border bg-bg-card/60 p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">
              Signed in
            </div>
            <div
              className="text-sm font-medium text-slate-200 truncate"
              title={user.email}
            >
              {user.email}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {user.is_admin ? "Admin" : "User"}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-bg-card/60 hover:text-slate-100 transition-all"
        >
          <IconLogout className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
