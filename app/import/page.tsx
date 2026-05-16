"use client";

import { useEffect, useState } from "react";

type Account = { id: number; name: string };

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [account, setAccount] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<{
    parsed: number;
    inserted: number;
    duplicates: number;
    warnings: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data: Account[]) => {
        setAccounts(data);
        if (data.length === 1) setAccount(data[0].name);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setStatus("Please choose a CSV file first.");
      return;
    }
    setBusy(true);
    setStatus("Uploading...");
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    if (account.trim()) fd.append("account", account.trim());
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`Error: ${json.error ?? res.statusText}`);
      } else {
        setResult(json);
        setStatus(
          `Imported ${json.inserted} new trades (${json.duplicates} duplicates skipped).`
        );
      }
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tightest">Import Trades</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Upload a Tradovate CSV export. Supports Trade History and Fills formats.
          Commissions are calculated on import using your configured rates.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="surface-card p-6 space-y-5">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-2">
            CSV file
          </label>
          <label className="flex items-center gap-3 border border-dashed border-bg-border hover:border-accent/40 rounded-lg p-4 cursor-pointer transition-colors bg-bg-panel/40 hover:bg-bg-panel/70">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path
                  d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="flex-1">
              <div className="text-sm text-slate-200">
                {file ? file.name : "Choose CSV file"}
              </div>
              <div className="text-xs text-slate-500">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : "Drop a Tradovate trade-history export"}
              </div>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-2">
            Account{" "}
            <span className="lowercase tracking-normal text-slate-500 normal-case">
              (used when CSV has no account column)
            </span>
          </label>
          <input
            list="account-options"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="e.g. Apex PA1"
            className="input"
          />
          <datalist id="account-options">
            {accounts.map((a) => (
              <option key={a.id} value={a.name} />
            ))}
          </datalist>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !file}
            className="btn btn-primary"
          >
            {busy ? "Importing..." : "Import"}
          </button>
          {status && <div className="text-sm text-slate-300">{status}</div>}
        </div>
      </form>

      {result && (
        <div className="surface-card p-4">
          <div className="section-label mb-2">Import summary</div>
          <ul className="text-sm text-slate-300 space-y-1 mono">
            <li>Rows parsed: {result.parsed}</li>
            <li>Inserted: {result.inserted}</li>
            <li>Duplicates skipped: {result.duplicates}</li>
          </ul>
          {result.warnings.length > 0 && (
            <details className="mt-3">
              <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-200">
                {result.warnings.length} warning(s)
              </summary>
              <ul className="text-xs text-slate-500 mt-2 space-y-0.5 max-h-48 overflow-auto mono">
                {result.warnings.slice(0, 50).map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="surface-panel p-5 text-sm text-slate-400">
        <div className="text-slate-100 font-medium mb-2">How to export from Tradovate</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open Tradovate → Performance → Trade History.</li>
          <li>Pick the date range you want to import.</li>
          <li>
            Click <span className="text-slate-200">Export</span> → CSV.
          </li>
          <li>Upload the file above.</li>
        </ol>
        <p className="mt-3 text-xs">
          Re-importing the same file is safe — duplicate trades are detected and skipped.
        </p>
      </div>
    </div>
  );
}
