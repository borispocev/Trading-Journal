# Tradovate Journal

A local trading journal for futures traders on **Tradovate / Apex prop accounts**.
Import your Trade History CSV, see net P&L (after commissions), track progress
toward withdrawal targets, journal each session with screenshots.

## Features

- **CSV import** — Tradovate Performance → Trade History exports (paired-fills
  and raw-fills formats both supported)
- **Commissions** — per-symbol per-side rates, configurable; round-trip fees
  applied to every trade and re-priced on read
- **Equity curve** — account-value chart with **trailing-stop**, **min-withdraw**,
  and **target / max-withdraw** reference lines
- **Projection** — expected-value-per-trade model that estimates trades and
  days needed to reach each target at your current edge
- **Calendar** — daily / weekly / monthly net P&L grid
- **Journal** — entries linked to specific trades, with screenshot uploads
- **Session clock** — Local + New York times with NY-open / NY-close countdowns
- **Multi-account** — track multiple prop accounts (eval / PA); mark one
  active to drive the dashboard

## Stack

- Next.js 14 (App Router) · React 18 · TypeScript
- Tailwind CSS
- better-sqlite3 (local file-based DB; no external service)
- recharts (charts)
- papaparse (CSV parsing)

## Local setup

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

The database lives at `data/journal.db` and is created on first run.

## Importing trades

1. In Tradovate: **Performance → Trade History → Export → CSV**
2. In the app: **Import** → choose the file → set the account name → submit

Re-importing the same file is safe — duplicates are detected via `external_id`.

A demo CSV is included at `sample-data/tradovate-sample.csv` if you just want
to see the UI light up.

## Configuring commissions

Default rates (per side per contract) are seeded for common Apex / Tradovate
products on first run:

| Group                    | Per-side rate |
|--------------------------|---------------|
| Micros (MNQ, MES, MYM, M2K, MCL, MGC) | $0.74 |
| Minis (NQ, ES, YM, RTY, CL, GC)       | $2.04 |

Change them under **Settings → Commissions**. Editing a rate re-prices every
historical trade instantly — no migration needed.

## Configuring account targets

Under **Settings → Accounts** you can configure:

- Account size (starting balance)
- Trailing drawdown
- Max daily loss
- **Min withdraw** — lighter green line on the equity chart
- **Target / max withdraw** — bright green line on the equity chart

Mark one account **active** — the dashboard chart and projection use its
parameters. Leave a withdraw field blank to hide that reference line (useful
for eval accounts that only have a single profit target).

## Project layout

```
app/                  Next.js routes (App Router) + API handlers
components/           UI components (charts, sidebar, clocks, etc.)
lib/
  db.ts               SQLite schema + migrations
  tradovate.ts        CSV parser (paired + fills formats)
  commissions.ts      Per-symbol rate lookup, fee calc, enrichment
  stats.ts            P&L stats, equity curve, projection model
data/                 Local DB (gitignored)
public/uploads/       Journal screenshots (gitignored)
sample-data/          Demo CSV for trying the app
```

## Notes

- **The DB is local-only.** This app stores everything in `data/journal.db`.
  There is no remote sync.
- **Don't commit your real CSVs.** `.gitignore` already excludes root-level
  CSVs and `data/`, but double-check before pushing.
- **Tradovate's API is not used.** All data comes from CSV exports. If you
  want to wire up the real-time API, see the notes in
  `lib/tradovate.ts` for the existing parsing shape.
