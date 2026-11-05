import type { ReactNode } from "react";
import { TONE_BADGE, type Tone } from "./StatCard";

// A small coloured label: "Running", "Healthy", "41 °C"...
export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_BADGE[tone]}`}>
      {children}
    </span>
  );
}
