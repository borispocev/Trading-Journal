"use client";

import { useEffect, useState } from "react";

const NY_TZ = "America/New_York";

// NYSE cash session: 09:30–16:00 local
const NYSE_OPEN: [number, number] = [9, 30];
const NYSE_CLOSE: [number, number] = [16, 0];

/**
 * Returns the UTC ms timestamp for `Y-M-D H:M` interpreted in the given zone.
 * Works across DST by iterating once: guess UTC, see what zone it shows as,
 * compute the offset and apply it.
 */
function tzToUtcMs(
  tz: string,
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number
): number {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(guess));
  const o: Record<string, string> = {};
  for (const p of parts) o[p.type] = p.value;
  const hourShown = +o.hour === 24 ? 0 : +o.hour;
  const shownUtc = Date.UTC(+o.year, +o.month - 1, +o.day, hourShown, +o.minute);
  const offset = shownUtc - guess;
  return guess - offset;
}

function partsInZone(tz: string, at: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) out[p.type] = p.value;
  return out;
}

function nextOccurrence(tz: string, hour: number, minute: number, from: Date): Date {
  const nowMs = from.getTime();
  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const candidateDay = new Date(nowMs + dayOffset * 86400000);
    const p = partsInZone(tz, candidateDay);
    if (p.weekday === "Sat" || p.weekday === "Sun") continue;
    const candidateMs = tzToUtcMs(tz, +p.year, +p.month, +p.day, hour, minute);
    if (candidateMs > nowMs) return new Date(candidateMs);
  }
  return new Date(nowMs);
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h ${m}m`;
  }
  if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function fmtClock(tz: string | undefined, at: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(at);
}

function fmtDate(tz: string | undefined, at: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(at);
}

function isSessionOpen(
  tz: string,
  at: Date,
  openHm: [number, number],
  closeHm: [number, number]
): boolean {
  const p = partsInZone(tz, at);
  if (p.weekday === "Sat" || p.weekday === "Sun") return false;
  const minutes = +p.hour * 60 + +p.minute;
  const openMin = openHm[0] * 60 + openHm[1];
  const closeMin = closeHm[0] * 60 + closeHm[1];
  return minutes >= openMin && minutes < closeMin;
}

export default function SessionClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="surface-card p-4 h-[120px] animate-pulse opacity-50" />
    );
  }

  const nyOpen = isSessionOpen(NY_TZ, now, NYSE_OPEN, NYSE_CLOSE);
  const nyOpenAt = nextOccurrence(NY_TZ, NYSE_OPEN[0], NYSE_OPEN[1], now);
  const nyCloseAt = nextOccurrence(NY_TZ, NYSE_CLOSE[0], NYSE_CLOSE[1], now);

  return (
    <div className="surface-card overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-y md:divide-y-0 divide-bg-border">
        <Cell>
          <Clock
            label="Local"
            time={fmtClock(undefined, now)}
            date={fmtDate(undefined, now)}
          />
        </Cell>
        <Cell>
          <Clock
            label="New York"
            time={fmtClock(NY_TZ, now)}
            date={fmtDate(NY_TZ, now)}
            status={nyOpen ? "open" : "closed"}
          />
        </Cell>
        <Cell>
          <Countdown
            label="NY open"
            ms={nyOpenAt.getTime() - now.getTime()}
            active={nyOpen}
            activeLabel="open now"
          />
        </Cell>
        <Cell>
          <Countdown
            label="NY close"
            ms={nyCloseAt.getTime() - now.getTime()}
            tone="warn"
            show={nyOpen}
          />
        </Cell>
      </div>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-4">{children}</div>;
}

function Clock({
  label,
  time,
  date,
  status,
}: {
  label: string;
  time: string;
  date: string;
  status?: "open" | "closed";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="section-label">{label}</div>
        {status && (
          <span className={status === "open" ? "pill pill-up" : "pill pill-neutral"}>
            {status}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold mono tracking-tightish text-slate-100 leading-tight">
        {time}
      </div>
      <div className="text-[11px] text-slate-500 mt-1">{date}</div>
    </div>
  );
}

function Countdown({
  label,
  ms,
  active,
  activeLabel,
  tone,
  show,
}: {
  label: string;
  ms: number;
  active?: boolean;
  activeLabel?: string;
  tone?: "warn";
  show?: boolean;
}) {
  const dimmed = show === false;
  const value = active ? activeLabel ?? "now" : fmtCountdown(ms);
  return (
    <div
      className={`transition-opacity ${dimmed ? "opacity-40" : ""}`}
    >
      <div className="section-label mb-1">{label}</div>
      <div
        className={`text-2xl font-semibold mono tracking-tightish leading-tight ${
          active
            ? "text-accent"
            : tone === "warn"
            ? "text-amber-300"
            : "text-slate-100"
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-slate-500 mt-1">
        {active ? "session in progress" : tone === "warn" ? "to bell" : "to bell"}
      </div>
    </div>
  );
}
