"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: number;
  email: string;
  is_admin: number;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
  trade_count: number;
  journal_count: number;
};

type Invite = {
  code: string;
  created_by_user_id: number;
  used_by_user_id: number | null;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_by_email: string | null;
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inviteStatus(i: Invite, now: number): "used" | "expired" | "unused" {
  if (i.used_by_user_id) return "used";
  if (i.expires_at && new Date(i.expires_at).getTime() < now) return "expired";
  return "unused";
}

function fmtRelative(target: string, now: number): string {
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return "expired";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h left`;
}

export default function AdminPanel({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [u, i] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/invites").then((r) => r.json()),
    ]);
    setUsers(u);
    setInvites(i);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(u: AdminUser) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, is_active: u.is_active !== 1 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(u: AdminUser) {
    if (
      !confirm(
        `Delete ${u.email}? This wipes all their trades, journal, accounts, and commission settings. Cannot be undone.`
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/invites", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      const mins = j.expires_at
        ? Math.max(1, Math.round((new Date(j.expires_at).getTime() - Date.now()) / 60000))
        : null;
      setMsg(
        mins
          ? `New invite: ${j.code} — valid for ${mins} minutes`
          : `New invite code: ${j.code}`
      );
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(code: string) {
    if (!confirm(`Revoke invite code ${code}?`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMsg(`Copied ${code} to clipboard`);
    } catch {
      setMsg(`Code: ${code}`);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Users</h2>
            <p className="text-xs text-slate-500">
              {users.length} user{users.length === 1 ? "" : "s"}. Disabling kicks
              the user out and blocks future logins until re-enabled.
            </p>
          </div>
        </div>
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Trades</th>
                  <th className="text-right">Journal</th>
                  <th>Joined</th>
                  <th>Last login</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      No users yet.
                    </td>
                  </tr>
                )}
                {users.map((u) => {
                  const self = u.id === currentUserId;
                  return (
                    <tr key={u.id}>
                      <td className="font-medium">
                        {u.email}
                        {self && (
                          <span className="ml-2 text-[11px] text-slate-500">(you)</span>
                        )}
                      </td>
                      <td>
                        {u.is_admin === 1 ? (
                          <span className="pill pill-up">admin</span>
                        ) : (
                          <span className="pill pill-neutral">user</span>
                        )}
                      </td>
                      <td>
                        {u.is_active === 1 ? (
                          <span className="pill pill-up">active</span>
                        ) : (
                          <span className="pill pill-down">disabled</span>
                        )}
                      </td>
                      <td className="text-right mono">{u.trade_count}</td>
                      <td className="text-right mono">{u.journal_count}</td>
                      <td className="text-slate-400 text-xs">
                        {fmtDate(u.created_at)}
                      </td>
                      <td className="text-slate-400 text-xs">
                        {fmtDate(u.last_login_at)}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={busy || self}
                          className="text-xs text-slate-400 hover:text-accent transition-colors mr-3 disabled:opacity-30"
                          title={self ? "Cannot disable yourself" : undefined}
                        >
                          {u.is_active === 1 ? "disable" : "enable"}
                        </button>
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={busy || self}
                          className="text-xs text-slate-500 hover:text-accent-loss transition-colors disabled:opacity-30"
                          title={self ? "Cannot delete yourself" : undefined}
                        >
                          delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Invite codes</h2>
            <p className="text-xs text-slate-500">
              Single-use codes. Share with friends — they enter the code on the
              signup page.
            </p>
          </div>
          <button
            onClick={createInvite}
            disabled={busy}
            className="btn btn-primary"
          >
            Generate code
          </button>
        </div>
        {msg && <div className="text-xs text-slate-400">{msg}</div>}
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Used by</th>
                  <th>Created</th>
                  <th>Used</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      No invite codes yet.
                    </td>
                  </tr>
                )}
                {invites.map((i) => {
                  const now = Date.now();
                  const status = inviteStatus(i, now);
                  return (
                    <tr key={i.code}>
                      <td className="font-medium mono tracking-wider">{i.code}</td>
                      <td>
                        {status === "used" ? (
                          <span className="pill pill-neutral">used</span>
                        ) : status === "expired" ? (
                          <span className="pill pill-down">expired</span>
                        ) : (
                          <span className="pill pill-up">unused</span>
                        )}
                      </td>
                      <td className="text-slate-400 text-xs whitespace-nowrap">
                        {status === "used"
                          ? "—"
                          : i.expires_at
                          ? status === "expired"
                            ? fmtDate(i.expires_at)
                            : fmtRelative(i.expires_at, now)
                          : "never"}
                      </td>
                      <td className="text-slate-400">{i.used_by_email ?? "—"}</td>
                      <td className="text-slate-400 text-xs">
                        {fmtDate(i.created_at)}
                      </td>
                      <td className="text-slate-400 text-xs">
                        {fmtDate(i.used_at)}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {status === "unused" && (
                          <button
                            onClick={() => copyCode(i.code)}
                            className="text-xs text-slate-400 hover:text-accent transition-colors mr-3"
                          >
                            copy
                          </button>
                        )}
                        {status !== "used" && (
                          <button
                            onClick={() => revokeInvite(i.code)}
                            disabled={busy}
                            className="text-xs text-slate-500 hover:text-accent-loss transition-colors"
                          >
                            revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
