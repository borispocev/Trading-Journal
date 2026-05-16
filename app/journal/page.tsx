"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Photo = { id: number; file_path: string; caption: string | null };

type LinkedTrade = {
  id: number;
  symbol: string;
  side: "long" | "short";
  qty: number;
  entry_price: number;
  exit_price: number | null;
  entry_time: string;
  exit_time: string | null;
  duration_seconds: number | null;
  account: string | null;
  gross_pnl: number | null;
  fees: number;
  net_pnl: number | null;
};

type Entry = {
  id: number;
  entry_date: string;
  title: string | null;
  notes: string | null;
  mood: string | null;
  trade_id: number | null;
  created_at: string;
  photos: Photo[];
  trade: LinkedTrade | null;
};

const MOODS = ["", "Confident", "Calm", "Focused", "Anxious", "Frustrated", "Tilted"];

function fmtMoney(n: number | null): string {
  if (n === null) return "—";
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtTradeLine(t: LinkedTrade): string {
  const when = new Date(t.entry_time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${t.symbol} · ${t.side} ${t.qty} @ ${t.entry_price} → ${
    t.exit_price ?? "—"
  } · ${fmtMoney(t.net_pnl)} · ${when}`;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [trades, setTrades] = useState<LinkedTrade[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState("");
  const [tradeId, setTradeId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);

  async function load() {
    const [entriesRes, tradesRes] = await Promise.all([
      fetch("/api/journal").then((r) => r.json()),
      fetch("/api/trades").then((r) => r.json()),
    ]);
    setEntries(entriesRes);
    setTrades(tradesRes);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("entry_date", date);
      fd.append("title", title);
      fd.append("notes", notes);
      fd.append("mood", mood);
      if (tradeId !== null) fd.append("trade_id", String(tradeId));
      for (const p of photos) fd.append("photos", p);
      const res = await fetch("/api/journal", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Upload failed");
      }
      setTitle("");
      setNotes("");
      setMood("");
      setTradeId(null);
      setPhotos([]);
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this entry and its photos?")) return;
    const res = await fetch(`/api/journal/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tightest">Journal</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"}.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className={showForm ? "btn btn-ghost" : "btn btn-primary"}
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                <path
                  d="M12 5v14m-7-7h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              New Entry
            </>
          )}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleSubmit} className="surface-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
                required
              />
            </Field>
            <Field label="Mood">
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="input"
              >
                {MOODS.map((m) => (
                  <option key={m} value={m}>
                    {m || "—"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Link to trade (optional)">
              <TradePicker
                trades={trades}
                value={tradeId}
                onChange={setTradeId}
              />
            </Field>
          </div>
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="e.g. Morning session — fade the open"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="input font-mono"
              placeholder="What was your plan? What happened? What did you learn?"
            />
          </Field>
          <Field label={`Screenshots (${photos.length} selected)`}>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-bg-panel file:text-slate-200 file:text-sm file:cursor-pointer cursor-pointer"
            />
          </Field>
          {error && <div className="text-sm text-accent-loss">{error}</div>}
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {entries.length === 0 && !showForm && (
          <div className="surface-card p-8 text-center text-slate-400">
            No entries yet. Click &quot;New Entry&quot; to add your first journal note.
          </div>
        )}
        {entries.map((e) => (
          <article key={e.id} className="surface-card p-5 space-y-3">
            <header className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap text-sm text-slate-400">
                  <span>
                    {new Date(e.entry_date).toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  {e.mood && <span className="pill pill-neutral">{e.mood}</span>}
                </div>
                {e.title && (
                  <h2 className="text-lg font-semibold mt-1.5 text-slate-100">
                    {e.title}
                  </h2>
                )}
              </div>
              <button
                onClick={() => handleDelete(e.id)}
                className="text-xs text-slate-500 hover:text-accent-loss transition-colors"
              >
                delete
              </button>
            </header>

            {e.trade && <LinkedTradeCard trade={e.trade} />}

            {e.notes && (
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {e.notes}
              </p>
            )}
            {e.photos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                {e.photos.map((p) => (
                  <a
                    key={p.id}
                    href={p.file_path}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg overflow-hidden border border-bg-border hover:border-accent/40 transition-colors group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.file_path}
                      alt={p.caption ?? ""}
                      className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function TradePicker({
  trades,
  value,
  onChange,
}: {
  trades: LinkedTrade[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => trades.find((t) => t.id === value) ?? null,
    [trades, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trades.slice(0, 50);
    return trades
      .filter((t) => {
        const tag = `${t.symbol} ${t.side} ${t.qty} ${t.id} ${new Date(
          t.entry_time
        ).toLocaleDateString()}`.toLowerCase();
        return tag.includes(q);
      })
      .slice(0, 50);
  }, [trades, query]);

  useEffect(() => {
    function onClickOutside(ev: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(ev.target as Node)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input text-left w-full flex items-center justify-between gap-2"
      >
        <span className={selected ? "text-slate-100" : "text-slate-500"}>
          {selected ? fmtTradeLine(selected) : "Pick a trade…"}
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" fill="none">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full surface-card overflow-hidden shadow-elevated">
          <div className="p-2 border-b border-bg-border">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by symbol, date, side…"
              className="input"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {selected && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-bg-panel/70 border-b border-bg-border"
              >
                ✕ Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                No matching trades.
              </div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-panel/70 flex items-center gap-3 border-b border-bg-border/60 ${
                    t.id === value ? "bg-accent/[0.07]" : ""
                  }`}
                >
                  <span className="font-medium text-slate-100 w-14 truncate">
                    {t.symbol}
                  </span>
                  <span
                    className={`pill ${
                      t.side === "long" ? "pill-up" : "pill-down"
                    } shrink-0`}
                  >
                    {t.side}
                  </span>
                  <span className="mono text-xs text-slate-400 w-10 text-right">
                    ×{t.qty}
                  </span>
                  <span className="mono text-xs text-slate-500 flex-1 truncate">
                    {new Date(t.entry_time).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className={`mono text-sm font-medium ${
                      (t.net_pnl ?? 0) >= 0 ? "text-accent" : "text-accent-loss"
                    }`}
                  >
                    {fmtMoney(t.net_pnl)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkedTradeCard({ trade }: { trade: LinkedTrade }) {
  const positive = (trade.net_pnl ?? 0) >= 0;
  const duration = trade.duration_seconds
    ? trade.duration_seconds < 60
      ? `${trade.duration_seconds}s`
      : trade.duration_seconds < 3600
      ? `${Math.floor(trade.duration_seconds / 60)}m`
      : `${Math.floor(trade.duration_seconds / 3600)}h ${Math.floor(
          (trade.duration_seconds % 3600) / 60
        )}m`
    : null;

  return (
    <div className="rounded-lg border border-bg-border bg-bg-panel/60 p-3 grid grid-cols-2 md:grid-cols-6 gap-3">
      <div className="md:col-span-2 flex items-center gap-2 min-w-0">
        <span className="text-base font-semibold text-slate-100">
          {trade.symbol}
        </span>
        <span
          className={`pill ${trade.side === "long" ? "pill-up" : "pill-down"}`}
        >
          {trade.side}
        </span>
        <span className="mono text-sm text-slate-400">× {trade.qty}</span>
      </div>
      <Cell label="Entry → Exit">
        <span className="mono text-slate-200">
          {trade.entry_price} → {trade.exit_price ?? "—"}
        </span>
      </Cell>
      <Cell label="Time">
        <span className="text-slate-300 mono text-xs">
          {new Date(trade.entry_time).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </Cell>
      <Cell label="Duration">
        <span className="text-slate-300 mono text-xs">{duration ?? "—"}</span>
      </Cell>
      <Cell label="Net P&amp;L">
        <span
          className={`mono font-semibold ${
            positive ? "text-accent" : "text-accent-loss"
          }`}
        >
          {fmtMoney(trade.net_pnl)}
          <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
            gross {fmtMoney(trade.gross_pnl)} · fees −${trade.fees.toFixed(2)}
          </span>
        </span>
      </Cell>
    </div>
  );
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-0.5">
        {label}
      </div>
      <div className="truncate">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
