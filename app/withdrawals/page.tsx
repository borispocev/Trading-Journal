"use client";

import { useEffect, useState } from "react";

type Photo = { id: number; file_path: string; caption: string | null };

type Withdrawal = {
  id: number;
  amount: number;
  withdraw_date: string;
  note: string | null;
  created_at: string;
  photos: Photo[];
};

function fmtMoney(n: number): string {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function WithdrawalsPage() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  async function load() {
    const res = await fetch("/api/withdrawals").then((r) => r.json());
    setItems(res.withdrawals ?? []);
    setTotal(res.total ?? 0);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a withdrawal amount greater than 0.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("withdraw_date", date);
      fd.append("amount", String(amt));
      fd.append("note", note);
      for (const p of photos) fd.append("photos", p);
      const res = await fetch("/api/withdrawals", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Save failed");
      }
      setAmount("");
      setNote("");
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
    if (!confirm("Delete this withdrawal and its certificate?")) return;
    const res = await fetch(`/api/withdrawals/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tightest">Withdrawals</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {items.length} payout{items.length === 1 ? "" : "s"} · deducted from
            your account equity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Total withdrawn
            </div>
            <div className="text-lg font-semibold mono text-accent">
              {fmtMoney(total)}
            </div>
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
                New Withdrawal
              </>
            )}
          </button>
        </div>
      </header>

      {showForm && (
        <form onSubmit={handleSubmit} className="surface-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
                required
              />
            </Field>
            <Field label="Amount ($)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input mono"
                placeholder="500.00"
                required
              />
            </Field>
          </div>
          <Field label="Note (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
              placeholder="e.g. First Apex PA payout"
            />
          </Field>
          <Field label={`Withdrawal certificate (${photos.length} selected)`}>
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
              {busy ? "Saving..." : "Save Withdrawal"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {items.length === 0 && !showForm && (
          <div className="surface-card p-8 text-center text-slate-400">
            No withdrawals yet. Click &quot;New Withdrawal&quot; to log a payout and
            deduct it from your account equity.
          </div>
        )}
        {items.map((w) => (
          <article key={w.id} className="surface-card p-5 space-y-3">
            <header className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-400">
                  {new Date(w.withdraw_date).toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <div className="text-2xl font-semibold mono text-accent mt-1">
                  −{fmtMoney(w.amount).replace("-", "")}
                </div>
                {w.note && (
                  <p className="text-sm text-slate-300 mt-1.5">{w.note}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(w.id)}
                className="text-xs text-slate-500 hover:text-accent-loss transition-colors"
              >
                delete
              </button>
            </header>

            {w.photos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                {w.photos.map((p) => (
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
                      alt={p.caption ?? "Withdrawal certificate"}
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
