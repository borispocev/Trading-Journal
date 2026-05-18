"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (alive) setHasUsers(!!j.hasUsers);
      })
      .catch(() => alive && setHasUsers(true));
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          invite_code: hasUsers ? inviteCode : "",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Signup failed");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const needsInvite = hasUsers === true;
  const firstUserHint = hasUsers === false;

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
          <h1 className="text-xl font-semibold text-slate-100">Create account</h1>
          <p className="text-sm text-slate-400 mt-1">
            {firstUserHint
              ? "You're the first user — your account will be the admin."
              : "Sign up with an invite code from the admin (codes expire 30 minutes after they're generated)."}
          </p>
        </div>
        <div className="surface-card p-6">
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
            <Field label="Password (min 8 chars)">
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
                placeholder="••••••••"
              />
            </Field>
            {needsInvite && (
              <Field label="Invite code">
                <input
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="input w-full mono uppercase tracking-wider"
                  placeholder="XXXXXXXXXXXX"
                />
              </Field>
            )}
            {error && (
              <div className="text-sm text-accent-loss bg-accent-loss/10 border border-accent-loss/25 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || hasUsers === null}
              className="btn btn-primary w-full justify-center"
            >
              {busy ? "Creating account…" : "Sign up"}
            </button>
          </form>
          <div className="text-xs text-slate-500 text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </div>
        </div>
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
