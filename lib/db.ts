import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "journal.db");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT UNIQUE,
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time);
    CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
    CREATE INDEX IF NOT EXISTS idx_trades_account ON trades(account);

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL,
      title TEXT,
      notes TEXT,
      mood TEXT,
      trade_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);

    CREATE TABLE IF NOT EXISTS journal_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_entry_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      account_size REAL,
      max_daily_loss REAL,
      trailing_drawdown REAL,
      min_withdraw REAL,
      max_withdraw REAL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS commission_rates (
      root TEXT PRIMARY KEY,
      rate_per_side REAL NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const seed = db.prepare(
    "INSERT OR IGNORE INTO commission_rates (root, rate_per_side) VALUES (?, ?)"
  );
  const DEFAULT_RATES: [string, number][] = [
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
  const seedTx = db.transaction(() => {
    for (const [r, rate] of DEFAULT_RATES) seed.run(r, rate);
    db.prepare(
      "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('default_commission_per_side', '0.74')"
    ).run();
  });
  seedTx();

  // Lightweight in-place migration: add columns that were introduced later so
  // existing databases pick them up without a reset.
  const accountCols = new Set(
    (db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[]).map(
      (r) => r.name
    )
  );
  if (!accountCols.has("min_withdraw")) {
    db.exec("ALTER TABLE accounts ADD COLUMN min_withdraw REAL");
  }
  if (!accountCols.has("max_withdraw")) {
    db.exec("ALTER TABLE accounts ADD COLUMN max_withdraw REAL");
  }
  if (!accountCols.has("is_active")) {
    db.exec("ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 0");
  }

  dbInstance = db;
  return db;
}

export type Trade = {
  id: number;
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

export type CommissionRate = {
  root: string;
  rate_per_side: number;
  updated_at: string;
};

export type Account = {
  id: number;
  name: string;
  account_size: number | null;
  max_daily_loss: number | null;
  trailing_drawdown: number | null;
  min_withdraw: number | null;
  max_withdraw: number | null;
  is_active: number;
  created_at: string;
};
