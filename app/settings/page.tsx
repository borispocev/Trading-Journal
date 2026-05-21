"use client";

import { useEffect, useState } from "react";

type Account = {
  id: number;
  name: string;
  account_size: number | null;
  max_daily_loss: number | null;
  trailing_drawdown: number | null;
  min_withdraw: number | null;
  max_withdraw: number | null;
  is_active: number;
};

type CommissionRate = { root: string; rate_per_side: number; updated_at: string };

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-4xl animate-fade-in">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tightest">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Configure prop-firm accounts and per-symbol commission rates. Rates apply
          to all historical trades automatically.
        </p>
      </header>

      <AccountsSection />
      <CommissionsSection />
      <DangerZone />
    </div>
  );
}

function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [dailyLoss, setDailyLoss] = useState("");
  const [trailing, setTrailing] = useState("");
  const [minWithdraw, setMinWithdraw] = useState("");
  const [maxWithdraw, setMaxWithdraw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/accounts");
    setAccounts(await r.json());
  }
  useEffect(() => {
    load();
  }, []);

  function loadIntoForm(a: Account) {
    setName(a.name);
    setSize(a.account_size?.toString() ?? "");
    setDailyLoss(a.max_daily_loss?.toString() ?? "");
    setTrailing(a.trailing_drawdown?.toString() ?? "");
    setMinWithdraw(a.min_withdraw?.toString() ?? "");
    setMaxWithdraw(a.max_withdraw?.toString() ?? "");
    setMsg(`Editing ${a.name} — change values and save.`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          account_size: size,
          max_daily_loss: dailyLoss,
          trailing_drawdown: trailing,
          min_withdraw: minWithdraw,
          max_withdraw: maxWithdraw,
        }),
      });
      if (!r.ok) throw new Error("save failed");
      setName("");
      setSize("");
      setDailyLoss("");
      setTrailing("");
      setMinWithdraw("");
      setMaxWithdraw("");
      setMsg("Saved.");
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: number) {
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activate: id }),
    });
    await load();
  }

  async function remove(id: number, accountName: string) {
    if (!confirm(`Delete account "${accountName}"?`)) return;
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Accounts</h2>
        <p className="text-xs text-slate-500">
          Track multiple prop-firm accounts and their risk limits. Mark one as
          <span className="text-accent"> active</span> — the dashboard uses its
          starting balance, trailing drawdown, and withdraw targets for the equity
          chart and projection. Re-enter the same name to update an existing
          account.
        </p>
      </div>

      <form onSubmit={save} className="surface-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Account name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
              placeholder="Apex 50K #1"
            />
          </Field>
          <Field label="Account size ($)">
            <input
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="input"
              placeholder="50000"
            />
          </Field>
          <Field label="Trailing drawdown ($)">
            <input
              type="number"
              value={trailing}
              onChange={(e) => setTrailing(e.target.value)}
              className="input"
              placeholder="2000"
            />
          </Field>
          <Field label="Max daily loss ($)">
            <input
              type="number"
              value={dailyLoss}
              onChange={(e) => setDailyLoss(e.target.value)}
              className="input"
              placeholder="2500"
            />
          </Field>
          <Field
            label={
              <>
                Min withdraw target ($){" "}
                <span className="text-slate-600 normal-case tracking-normal">
                  optional
                </span>
              </>
            }
          >
            <input
              type="number"
              value={minWithdraw}
              onChange={(e) => setMinWithdraw(e.target.value)}
              className="input"
              placeholder="52600 (Apex PA first-payout)"
            />
          </Field>
          <Field
            label={
              <>
                Target / max withdraw ($){" "}
                <span className="text-slate-600 normal-case tracking-normal">
                  optional
                </span>
              </>
            }
          >
            <input
              type="number"
              value={maxWithdraw}
              onChange={(e) => setMaxWithdraw(e.target.value)}
              className="input"
              placeholder="53600 PA · 53000 eval target"
            />
          </Field>
        </div>
        <div className="flex justify-end items-center gap-3">
          {msg && <span className="text-xs text-slate-400">{msg}</span>}
          <button
            type="submit"
            disabled={busy || !name}
            className="btn btn-primary"
          >
            {busy ? "Saving..." : "Save Account"}
          </button>
        </div>
      </form>

      <div className="surface-card overflow-hidden">
        <table className="app-table">
          <thead>
            <tr>
              <th>Account</th>
              <th className="text-right">Size</th>
              <th className="text-right">Trail DD</th>
              <th className="text-right">Daily Loss</th>
              <th className="text-right">Min WD</th>
              <th className="text-right">Target</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No accounts configured.
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">
                  <div className="flex items-center gap-2">
                    {a.name}
                    {a.is_active === 1 && <span className="pill pill-up">active</span>}
                  </div>
                </td>
                <td className="text-right mono text-slate-300">
                  {a.account_size !== null ? `$${a.account_size}` : "—"}
                </td>
                <td className="text-right mono text-slate-300">
                  {a.trailing_drawdown !== null ? `$${a.trailing_drawdown}` : "—"}
                </td>
                <td className="text-right mono text-slate-300">
                  {a.max_daily_loss !== null ? `$${a.max_daily_loss}` : "—"}
                </td>
                <td className="text-right mono text-slate-300">
                  {a.min_withdraw !== null ? `$${a.min_withdraw}` : "—"}
                </td>
                <td className="text-right mono text-accent">
                  {a.max_withdraw !== null ? `$${a.max_withdraw}` : "—"}
                </td>
                <td className="text-right whitespace-nowrap">
                  <button
                    onClick={() => loadIntoForm(a)}
                    className="text-xs text-slate-400 hover:text-slate-100 transition-colors mr-3"
                  >
                    edit
                  </button>
                  {a.is_active !== 1 && (
                    <button
                      onClick={() => activate(a.id)}
                      className="text-xs text-slate-400 hover:text-accent transition-colors mr-3"
                    >
                      activate
                    </button>
                  )}
                  <button
                    onClick={() => remove(a.id, a.name)}
                    className="text-xs text-slate-500 hover:text-accent-loss transition-colors"
                  >
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CommissionsSection() {
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [defaultRate, setDefaultRate] = useState<string>("0.74");
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [newRoot, setNewRoot] = useState("");
  const [newRate, setNewRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/commissions");
    const j = await r.json();
    setRates(j.rates);
    setDefaultRate(String(j.default_per_side));
    setEdited({});
  }
  useEffect(() => {
    load();
  }, []);

  function changeRow(root: string, val: string) {
    setEdited((e) => ({ ...e, [root]: val }));
  }

  async function saveAll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const updates = Object.entries(edited)
        .map(([root, v]) => ({ root, rate_per_side: Number(v) }))
        .filter((r) => Number.isFinite(r.rate_per_side) && r.rate_per_side >= 0);
      const body: { rates: typeof updates; default_per_side?: number } = {
        rates: updates,
      };
      const def = Number(defaultRate);
      if (Number.isFinite(def) && def >= 0) body.default_per_side = def;

      if (newRoot.trim() && newRate.trim()) {
        const rate = Number(newRate);
        if (Number.isFinite(rate) && rate >= 0) {
          body.rates.push({
            root: newRoot.trim().toUpperCase(),
            rate_per_side: rate,
          });
        }
      }

      const r = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("save failed");
      setNewRoot("");
      setNewRate("");
      setMsg("Saved — historical trades re-priced.");
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeRate(root: string) {
    if (!confirm(`Remove commission rate for ${root}? It will fall back to the default.`))
      return;
    await fetch("/api/commissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root }),
    });
    await load();
  }

  const dirty = Object.keys(edited).length > 0 || (newRoot.trim() && newRate.trim());

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Commissions</h2>
        <p className="text-xs text-slate-500">
          Per-side commission per contract. Round-trip fee = rate × qty × 2. Tradovate
          Trade History CSVs don&apos;t include fees, so they&apos;re calculated from
          these rates. Defaults are typical Apex/Tradovate retail rates.
        </p>
      </div>

      <form onSubmit={saveAll} className="surface-card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-slate-400 uppercase tracking-[0.12em]">
            Default per-side
          </label>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">$</span>
            <input
              type="number"
              step="0.01"
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
              className="input w-28"
            />
          </div>
          <span className="text-xs text-slate-500">
            Used for any symbol not listed below.
          </span>
        </div>

        <div className="hairline" />

        <div className="overflow-x-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th>Root Symbol</th>
                <th className="text-right">Per-side ($)</th>
                <th className="text-right">Round-trip / 1 ct ($)</th>
                <th className="text-right">Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                const current = edited[r.root] ?? String(r.rate_per_side);
                const rt = (Number(current) || 0) * 2;
                return (
                  <tr key={r.root}>
                    <td className="font-medium mono">{r.root}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <span className="text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={current}
                          onChange={(e) => changeRow(r.root, e.target.value)}
                          className="input w-24 text-right mono"
                        />
                      </div>
                    </td>
                    <td className="text-right mono text-slate-400">
                      ${rt.toFixed(2)}
                    </td>
                    <td className="text-right text-slate-500 text-xs">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeRate(r.root)}
                        className="text-xs text-slate-500 hover:text-accent-loss transition-colors"
                      >
                        remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <input
                    value={newRoot}
                    onChange={(e) => setNewRoot(e.target.value.toUpperCase())}
                    placeholder="e.g. SI"
                    className="input w-28 mono uppercase"
                    maxLength={4}
                  />
                </td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span className="text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                      placeholder="2.04"
                      className="input w-24 text-right mono"
                    />
                  </div>
                </td>
                <td colSpan={3} className="text-slate-500 text-xs">
                  Add a new symbol root (will save on submit).
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end items-center gap-3">
          {msg && <span className="text-xs text-slate-400">{msg}</span>}
          <button
            type="submit"
            disabled={busy || !dirty}
            className="btn btn-primary"
          >
            {busy ? "Saving..." : "Save Commission Rates"}
          </button>
        </div>
      </form>
    </section>
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

function DangerZone() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reset(
    target: "trades" | "journal" | "withdrawals" | "accounts" | "all",
    label: string
  ) {
    if (
      !confirm(
        `Delete all ${label}? This cannot be undone.${
          target === "all"
            ? "\n\nThis will wipe trades, journal entries (with photos), withdrawals (with certificates), and accounts."
            : ""
        }`
      )
    )
      return;
    setBusy(target);
    setMsg(null);
    try {
      const r = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "reset failed");
      const parts = Object.entries(j.deleted)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ");
      setMsg(`Deleted: ${parts || "nothing"}.`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="surface-card border-accent-loss/25 p-5 space-y-3">
      <div>
        <div className="text-sm font-semibold text-accent-loss">Danger Zone</div>
        <p className="text-xs text-slate-400 mt-1">
          Wipe data. Useful after running test imports or starting fresh.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => reset("trades", "trades")}
          disabled={busy !== null}
          className="btn btn-ghost"
        >
          {busy === "trades" ? "Clearing..." : "Clear trades"}
        </button>
        <button
          onClick={() => reset("journal", "journal entries (and photos)")}
          disabled={busy !== null}
          className="btn btn-ghost"
        >
          {busy === "journal" ? "Clearing..." : "Clear journal"}
        </button>
        <button
          onClick={() => reset("withdrawals", "withdrawals (and certificates)")}
          disabled={busy !== null}
          className="btn btn-ghost"
        >
          {busy === "withdrawals" ? "Clearing..." : "Clear withdrawals"}
        </button>
        <button
          onClick={() => reset("accounts", "accounts")}
          disabled={busy !== null}
          className="btn btn-ghost"
        >
          {busy === "accounts" ? "Clearing..." : "Clear accounts"}
        </button>
        <button
          onClick={() => reset("all", "data (trades + journal + withdrawals + accounts)")}
          disabled={busy !== null}
          className="btn btn-danger"
        >
          {busy === "all" ? "Wiping..." : "Wipe everything"}
        </button>
      </div>
      {msg && <div className="text-xs text-slate-400">{msg}</div>}
    </section>
  );
}
