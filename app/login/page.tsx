"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Login failed");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to your trading journal.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input w-full"
            placeholder="••••••••"
          />
        </Field>
        {error && (
          <div className="text-sm text-accent-loss bg-accent-loss/10 border border-accent-loss/25 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full justify-center"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="text-xs text-slate-500 text-center mt-6">
        No account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </div>
    </AuthShell>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-muted shadow-glow mb-3">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-bg" fill="none">
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
          </div>
          <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className="surface-card p-6">{children}</div>
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
