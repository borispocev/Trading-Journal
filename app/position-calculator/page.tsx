"use client";

import { useMemo, useState } from "react";

type ContractSpec = {
  root: string;
  name: string;
  pointValue: number;
  tickSize: number;
  isMicro: boolean;
};

const CONTRACTS: ContractSpec[] = [
  { root: "NQ", name: "E-mini Nasdaq-100", pointValue: 20, tickSize: 0.25, isMicro: false },
  { root: "MNQ", name: "Micro E-mini Nasdaq-100", pointValue: 2, tickSize: 0.25, isMicro: true },
  { root: "ES", name: "E-mini S&P 500", pointValue: 50, tickSize: 0.25, isMicro: false },
  { root: "MES", name: "Micro E-mini S&P 500", pointValue: 5, tickSize: 0.25, isMicro: true },
  { root: "CL", name: "Crude Oil", pointValue: 1000, tickSize: 0.01, isMicro: false },
  { root: "MCL", name: "Micro Crude Oil", pointValue: 100, tickSize: 0.01, isMicro: true },
  { root: "GC", name: "Gold", pointValue: 100, tickSize: 0.1, isMicro: false },
  { root: "MGC", name: "Micro Gold", pointValue: 10, tickSize: 0.1, isMicro: true },
  { root: "YM", name: "E-mini Dow", pointValue: 5, tickSize: 1, isMicro: false },
  { root: "MYM", name: "Micro E-mini Dow", pointValue: 0.5, tickSize: 1, isMicro: true },
];

const RR_RATIOS = [1, 2, 3, 4];

function fmtUsd(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtNum(n: number, digits = 2) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function PositionCalculatorPage() {
  const [root, setRoot] = useState<string>("MNQ");
  const [dollarRisk, setDollarRisk] = useState<string>("100");
  const [points, setPoints] = useState<string>("10");
  const [ticks, setTicks] = useState<string>("40");
  // Tracks which input the user last edited so we don't fight their typing.
  const [lastEdited, setLastEdited] = useState<"points" | "ticks">("points");

  const spec = useMemo(
    () => CONTRACTS.find((c) => c.root === root) ?? CONTRACTS[0],
    [root]
  );
  const tickValue = spec.pointValue * spec.tickSize;

  function onPointsChange(v: string) {
    setPoints(v);
    setLastEdited("points");
    const p = Number(v);
    if (Number.isFinite(p) && spec.tickSize > 0) {
      setTicks(String(+(p / spec.tickSize).toFixed(4)));
    }
  }

  function onTicksChange(v: string) {
    setTicks(v);
    setLastEdited("ticks");
    const t = Number(v);
    if (Number.isFinite(t)) {
      setPoints(String(+(t * spec.tickSize).toFixed(4)));
    }
  }

  function onSymbolChange(newRoot: string) {
    const next = CONTRACTS.find((c) => c.root === newRoot) ?? CONTRACTS[0];
    setRoot(newRoot);
    // Re-sync the secondary field against the new tick size so values stay consistent.
    if (lastEdited === "points") {
      const p = Number(points);
      if (Number.isFinite(p) && next.tickSize > 0) {
        setTicks(String(+(p / next.tickSize).toFixed(4)));
      }
    } else {
      const t = Number(ticks);
      if (Number.isFinite(t)) {
        setPoints(String(+(t * next.tickSize).toFixed(4)));
      }
    }
  }

  const risk = Number(dollarRisk);
  const stopPts = Number(points);
  const stopTicks = Number(ticks);
  const inputsValid =
    Number.isFinite(risk) &&
    risk > 0 &&
    Number.isFinite(stopPts) &&
    stopPts > 0;

  const riskPerContract = stopPts * spec.pointValue;
  const rawContracts = inputsValid ? risk / riskPerContract : 0;
  const contracts = inputsValid ? Math.max(0, Math.floor(rawContracts)) : 0;
  const actualRisk = contracts * riskPerContract;
  const leftover = inputsValid ? risk - actualRisk : 0;

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tightest">
          Position Calculator
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Size futures positions from a fixed dollar risk and a stop distance.
          Whole contracts only — fractional contracts round down so you never
          exceed your risk budget.
        </p>
      </header>

      <section className="surface-card p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Symbol">
            <select
              value={root}
              onChange={(e) => onSymbolChange(e.target.value)}
              className="input mono"
            >
              {CONTRACTS.map((c) => (
                <option key={c.root} value={c.root}>
                  {c.root} — {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dollar risk ($)">
            <input
              type="number"
              min="0"
              step="any"
              value={dollarRisk}
              onChange={(e) => setDollarRisk(e.target.value)}
              className="input mono"
              placeholder="100"
            />
          </Field>
          <Field label="Stop (points)">
            <input
              type="number"
              min="0"
              step="any"
              value={points}
              onChange={(e) => onPointsChange(e.target.value)}
              className="input mono"
              placeholder="10"
            />
          </Field>
          <Field label="Stop (ticks)">
            <input
              type="number"
              min="0"
              step="any"
              value={ticks}
              onChange={(e) => onTicksChange(e.target.value)}
              className="input mono"
              placeholder="40"
            />
          </Field>
        </div>

        <div className="hairline" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="$ / point" value={fmtUsd(spec.pointValue)} />
          <Stat label="Tick size" value={fmtNum(spec.tickSize, spec.tickSize < 1 ? 2 : 0)} />
          <Stat label="$ / tick" value={fmtUsd(tickValue)} />
          <Stat
            label="Risk per contract"
            value={inputsValid ? fmtUsd(riskPerContract) : "—"}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BigStat
          label="Contracts"
          value={inputsValid ? String(contracts) : "—"}
          sub={
            inputsValid
              ? `${fmtNum(rawContracts, 2)} raw · floored`
              : "Enter risk + stop"
          }
          accent
        />
        <BigStat
          label="Actual $ risk"
          value={inputsValid ? fmtUsd(actualRisk) : "—"}
          sub={
            inputsValid && contracts > 0
              ? `${contracts} × ${fmtUsd(riskPerContract)}`
              : inputsValid
                ? "Stop too wide for this risk"
                : "—"
          }
        />
        <BigStat
          label="Unused risk budget"
          value={inputsValid ? fmtUsd(leftover) : "—"}
          sub={
            inputsValid
              ? `of ${fmtUsd(risk)} budgeted`
              : "—"
          }
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Reward targets
          </h2>
          <p className="text-xs text-slate-500">
            R:R targets based on the actual risk for {contracts || 0} contract
            {contracts === 1 ? "" : "s"}. Move the stop tighter to increase
            contracts and proportionally scale all reward levels.
          </p>
        </div>

        <div className="surface-card overflow-hidden">
          <table className="app-table">
            <thead>
              <tr>
                <th>R:R</th>
                <th className="text-right">Reward ($)</th>
                <th className="text-right">Reward / ct</th>
                <th className="text-right">Target distance (pts)</th>
                <th className="text-right">Target distance (ticks)</th>
              </tr>
            </thead>
            <tbody>
              {RR_RATIOS.map((r) => {
                const rewardTotal = actualRisk * r;
                const rewardPerCt = riskPerContract * r;
                const targetPts = stopPts * r;
                const targetTicks = stopTicks * r;
                return (
                  <tr key={r}>
                    <td className="font-medium">
                      <span className="pill pill-up">1 : {r}</span>
                    </td>
                    <td className="text-right mono text-accent">
                      {inputsValid && contracts > 0
                        ? fmtUsd(rewardTotal)
                        : "—"}
                    </td>
                    <td className="text-right mono text-slate-300">
                      {inputsValid ? fmtUsd(rewardPerCt) : "—"}
                    </td>
                    <td className="text-right mono text-slate-300">
                      {inputsValid ? fmtNum(targetPts, 2) : "—"}
                    </td>
                    <td className="text-right mono text-slate-400">
                      {inputsValid ? fmtNum(targetTicks, 2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mono text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="surface-card p-5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div
        className={`mono text-3xl mt-1 ${
          accent ? "text-accent" : "text-slate-100"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}
