import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type Tone = "ok" | "warning" | "critical" | "neutral";

// colours for the icon badge: green / amber / red, or indigo when there's nothing to judge
export const TONE_BADGE: Record<Tone, string> = {
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
  neutral: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
};

export function StatCard({ icon: Icon, label, value, unit, detail, tone = "neutral", chart }: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  tone?: Tone;
  chart?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className={`rounded-lg p-1.5 ${TONE_BADGE[tone]}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="text-sm text-zinc-500">{unit}</span>}
      </div>
      {chart}
      {detail && <p className="truncate text-xs text-zinc-500">{detail}</p>}
    </div>
  );
}