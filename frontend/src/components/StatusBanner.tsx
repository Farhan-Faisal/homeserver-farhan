"use client";
import { CircleCheck, CircleX, Loader, TriangleAlert, type LucideIcon } from "lucide-react";
import { useNow } from "@/lib/api";
import { fmtDuration } from "@/lib/format";
import type { Status } from "@/lib/types";
import { TONE_BADGE, type Tone } from "./StatCard";

const ORDER = { critical: 0, warning: 1, info: 2 };

// One sentence that says whether the server is fine. Old data counts as a problem too.
export function StatusBanner({ status, error }: { status: Status | null; error: string | null }) {
  const now = useNow();
  const alerts = [...(status?.alerts ?? [])].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  const worst = alerts.find((a) => a.level !== "info");
  const age = status ? now - status.generated_at : 0;

  let tone: Tone = "ok", Icon: LucideIcon = CircleCheck, title = "Everything's running", sub = "";
  if (error) {
    tone = "critical"; Icon = CircleX; title = "Can't reach the API"; sub = error;
  } else if (!status) {
    tone = "neutral"; Icon = Loader; title = "Loading…";
  } else if (age > 60) {
    tone = "critical"; Icon = CircleX; title = `No new data for ${fmtDuration(age)}`; sub = "The collector may have stopped.";
  } else if (worst) {
    tone = worst.level === "critical" ? "critical" : "warning"; Icon = TriangleAlert; title = worst.text;
    sub = alerts.length > 1 ? `${alerts.length - 1} more below` : "";
  } else {
    sub = `Up for ${fmtDuration(status.host?.uptime ?? 0)}`;
  }

  return (
    <div className="mb-6 flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className={`rounded-xl p-3 ${TONE_BADGE[tone]}`}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold">{title}</p>
        {sub && <p className="truncate text-sm text-zinc-500">{sub}</p>}
      </div>
      {status && !error && (
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
          <span className={`size-2 rounded-full ${age > 60 ? "bg-red-500" : "bg-emerald-500"}`} />
          {age < 15 ? "live" : `${fmtDuration(age)} ago`}
        </span>
      )}
    </div>
  );
}