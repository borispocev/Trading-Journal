"use client";

import Link from "next/link";

type DayData = { pnl: number; trades: number };

type Props = {
  year: number;
  month: number; // 0-11
  dayData: Record<string, DayData>;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtPnl(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function monthParam(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

export default function CalendarView({ year, month, dayData }: Props) {
  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startDow);

  type Cell = { date: Date; key: string; inMonth: boolean; data: DayData | null };
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    cells.push({
      date: d,
      key,
      inMonth: d.getMonth() === month,
      data: dayData[key] ?? null,
    });
  }

  const weeks: Cell[][] = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i * 7, i * 7 + 7));
  while (weeks.length > 1 && weeks[weeks.length - 1].every((c) => !c.inMonth)) {
    weeks.pop();
  }

  const weekTotals = weeks.map((row) => {
    let pnl = 0;
    let trades = 0;
    let days = 0;
    for (const c of row) {
      if (c.data) {
        pnl += c.data.pnl;
        trades += c.data.trades;
        days += 1;
      }
    }
    return { pnl: Math.round(pnl * 100) / 100, trades, days };
  });

  let monthPnl = 0;
  let monthTrades = 0;
  let monthDays = 0;
  let winningDays = 0;
  let losingDays = 0;
  for (const c of cells) {
    if (c.inMonth && c.data) {
      monthPnl += c.data.pnl;
      monthTrades += c.data.trades;
      monthDays += 1;
      if (c.data.pnl > 0) winningDays += 1;
      else if (c.data.pnl < 0) losingDays += 1;
    }
  }
  monthPnl = Math.round(monthPnl * 100) / 100;

  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tightest">Calendar</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Daily net P&amp;L and trade count · weekly totals on the right.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/calendar?month=${monthParam(prev.getFullYear(), prev.getMonth())}`}
            className="btn btn-ghost px-2.5 py-1.5"
            aria-label="Previous month"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="surface-panel px-4 py-1.5 text-sm font-medium text-slate-100 min-w-[170px] text-center">
            {MONTH_NAMES[month]} {year}
          </div>
          <Link
            href={`/calendar?month=${monthParam(next.getFullYear(), next.getMonth())}`}
            className="btn btn-ghost px-2.5 py-1.5"
            aria-label="Next month"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link href="/calendar" className="btn btn-ghost">
            Today
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="surface-card p-4">
          <div className="section-label">Month P&amp;L</div>
          <div
            className={`text-[26px] font-semibold mono mt-1 ${
              monthPnl >= 0 ? "text-accent" : "text-accent-loss"
            }`}
          >
            {fmtPnl(monthPnl)}
          </div>
        </div>
        <div className="surface-card p-4">
          <div className="section-label">Trading Days</div>
          <div className="text-[26px] font-semibold mono mt-1 text-slate-100">{monthDays}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {winningDays} green · {losingDays} red
          </div>
        </div>
        <div className="surface-card p-4">
          <div className="section-label">Total Trades</div>
          <div className="text-[26px] font-semibold mono mt-1 text-slate-100">{monthTrades}</div>
        </div>
        <div className="surface-card p-4">
          <div className="section-label">Avg Day</div>
          <div
            className={`text-[26px] font-semibold mono mt-1 ${
              monthDays > 0 && monthPnl / monthDays >= 0
                ? "text-accent"
                : monthDays > 0
                ? "text-accent-loss"
                : "text-slate-100"
            }`}
          >
            {monthDays > 0 ? fmtPnl(monthPnl / monthDays) : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4">
        <div className="surface-card p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-[10px] uppercase tracking-[0.16em] text-slate-500 text-center py-1.5"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {weeks.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 gap-1">
                {row.map((c) => {
                  const isToday = c.key === todayKey;
                  const positive = c.data && c.data.pnl > 0;
                  const negative = c.data && c.data.pnl < 0;
                  const tone = positive
                    ? "bg-accent/[0.07] border-accent/30 hover:bg-accent/[0.11]"
                    : negative
                    ? "bg-accent-loss/[0.07] border-accent-loss/30 hover:bg-accent-loss/[0.11]"
                    : "bg-bg-panel/60 border-bg-border hover:bg-bg-panel";
                  return (
                    <div
                      key={c.key}
                      className={`min-h-[92px] rounded-lg border p-2 flex flex-col transition-colors ${tone} ${
                        c.inMonth ? "" : "opacity-30"
                      } ${isToday ? "ring-1 ring-accent" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={`text-xs mono ${
                            isToday ? "text-accent font-semibold" : "text-slate-400"
                          }`}
                        >
                          {c.date.getDate()}
                        </span>
                        {c.data && (
                          <span className="text-[10px] text-slate-500 mono">
                            {c.data.trades}
                          </span>
                        )}
                      </div>
                      {c.data && (
                        <div className="mt-auto">
                          <div
                            className={`text-sm font-semibold mono ${
                              c.data.pnl >= 0 ? "text-accent" : "text-accent-loss"
                            }`}
                          >
                            {fmtPnl(c.data.pnl)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-2">
          <div className="section-label px-1">Weekly P&amp;L</div>
          {weekTotals.map((w, i) => {
            const positive = w.pnl > 0;
            const negative = w.pnl < 0;
            const tone = positive
              ? "border-accent/30"
              : negative
              ? "border-accent-loss/30"
              : "border-bg-border";
            return (
              <div
                key={i}
                className={`surface-card border ${tone} p-3 min-h-[92px] flex flex-col justify-between`}
              >
                <div className="text-xs text-slate-500">Week {i + 1}</div>
                {w.days > 0 ? (
                  <>
                    <div
                      className={`text-lg font-semibold mono ${
                        w.pnl >= 0 ? "text-accent" : "text-accent-loss"
                      }`}
                    >
                      {fmtPnl(w.pnl)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {w.trades} trade{w.trades === 1 ? "" : "s"} · {w.days} day
                      {w.days === 1 ? "" : "s"}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-600">—</div>
                )}
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
