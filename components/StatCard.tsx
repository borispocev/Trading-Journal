import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
};

export default function StatCard({ label, value, sub, tone = "neutral", icon }: Props) {
  const color =
    tone === "positive"
      ? "text-accent"
      : tone === "negative"
      ? "text-accent-loss"
      : "text-slate-100";

  const accentBar =
    tone === "positive"
      ? "from-accent/60 to-accent/0"
      : tone === "negative"
      ? "from-accent-loss/60 to-accent-loss/0"
      : "from-slate-500/40 to-slate-500/0";

  return (
    <div className="surface-card relative overflow-hidden p-4 group transition-colors hover:border-bg-elevated">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentBar}`}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="section-label">{label}</div>
        {icon && (
          <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
            {icon}
          </span>
        )}
      </div>
      <div className={`text-[26px] font-semibold mt-1.5 mono tracking-tightish ${color}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}
