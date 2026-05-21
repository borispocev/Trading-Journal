import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// DB_PATH lets the deployment override where SQLite lives. On Fly we mount a
// persistent volume at /data and point this there; local dev falls back to
// ./data/journal.db so nothing changes.
const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "journal.db");
const DATA_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      created_by_user_id INTEGER NOT NULL,
      used_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      used_at TEXT,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      external_id TEXT,
      account TEXT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      qty INTEGER NOT NULL,
      entry_price REAL NOT NULL,
      exit_price REAL,
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      pnl REAL,
      fees REAL DEFAULT 0,
      duration_seconds INTEGER,
      risk_amount REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (user_id, external_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trades_user_entry_time ON trades(user_id, entry_time);
    CREATE INDEX IF NOT EXISTS idx_trades_user_symbol ON trades(user_id, symbol);
    CREATE INDEX IF NOT EXISTS idx_trades_user_account ON trades(user_id, account);

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      title TEXT,
      notes TEXT,
      mood TEXT,
      trade_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, entry_date);

    CREATE TABLE IF NOT EXISTS journal_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_entry_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      withdraw_date TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_withdrawals_user_date ON withdrawals(user_id, withdraw_date);

    CREATE TABLE IF NOT EXISTS withdrawal_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      withdrawal_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (withdrawal_id) REFERENCES withdrawals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      account_size REAL,
      max_daily_loss REAL,
      trailing_drawdown REAL,
      min_withdraw REAL,
      max_withdraw REAL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS commission_rates (
      user_id INTEGER NOT NULL,
      root TEXT NOT NULL,
      rate_per_side REAL NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, root),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Lightweight in-place migrations for older DBs. Adding columns is the only
  // change we expect here; better-sqlite3 ALTER is fast and idempotent-by-check.
  const inviteCols = db
    .prepare("PRAGMA table_info(invite_codes)")
    .all() as { name: string }[];
  if (!inviteCols.some((c) => c.name === "expires_at")) {
    db.exec("ALTER TABLE invite_codes ADD COLUMN expires_at TEXT");
  }

  dbInstance = db;
  return db;
}

export const INVITE_TTL_MINUTES = 30;

export const DEFAULT_COMMISSION_RATES: [string, number][] = [
  ["MNQ", 0.74],
  ["MES", 0.74],
  ["MYM", 0.74],
  ["M2K", 0.74],
  ["MCL", 0.74],
  ["MGC", 0.74],
  ["NQ", 2.04],
  ["ES", 2.04],
  ["YM", 2.04],
  ["RTY", 2.04],
  ["CL", 2.04],
  ["GC", 2.04],
];

export const DEFAULT_PER_SIDE = 0.74;

/**
 * Seed per-user commission rates and the default-per-side setting.
 * Called once at user signup so each user gets sane starting rates
 * without sharing state with other users.
 */
export function seedUserDefaults(db: Database.Database, userId: number) {
  const tx = db.transaction(() => {
    const insRate = db.prepare(
      "INSERT OR IGNORE INTO commission_rates (user_id, root, rate_per_side) VALUES (?, ?, ?)"
    );
    for (const [r, rate] of DEFAULT_COMMISSION_RATES) insRate.run(userId, r, rate);
    db.prepare(
      "INSERT OR IGNORE INTO app_settings (user_id, key, value) VALUES (?, 'default_commission_per_side', ?)"
    ).run(userId, String(DEFAULT_PER_SIDE));
  });
  tx();
}

export type User = {
  id: number;
  email: string;
  password_hash: string;
  is_admin: number;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
};

export type Session = {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
};

export type InviteCode = {
  code: string;
  created_by_user_id: number;
  used_by_user_id: number | null;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
};

export type Trade = {
  id: number;
  user_id: number;
  external_id: string | null;
  account: string | null;
  symbol: string;
  side: "long" | "short";
  qty: number;
  entry_price: number;
  exit_price: number | null;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  fees: number;
  duration_seconds: number | null;
  risk_amount: number | null;
  notes: string | null;
  created_at: string;
};

export type JournalEntry = {
  id: number;
  user_id: number;
  entry_date: string;
  title: string | null;
  notes: string | null;
  mood: string | null;
  trade_id: number | null;
  created_at: string;
  updated_at: string;
};

export type JournalPhoto = {
  id: number;
  journal_entry_id: number;
  file_path: string;
  caption: string | null;
  created_at: string;
};

export type Withdrawal = {
  id: number;
  user_id: number;
  amount: number;
  withdraw_date: string;
  note: string | null;
  created_at: string;
};

export type WithdrawalPhoto = {
  id: number;
  withdrawal_id: number;
  file_path: string;
  caption: string | null;
  created_at: string;
};

export type CommissionRate = {
  user_id: number;
  root: string;
  rate_per_side: number;
  updated_at: string;
};

export type Account = {
  id: number;
  user_id: number;
  name: string;
  account_size: number | null;
  max_daily_loss: number | null;
  trailing_drawdown: number | null;
  min_withdraw: number | null;
  max_withdraw: number | null;
  is_active: number;
  created_at: string;
};
