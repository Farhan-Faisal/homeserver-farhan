import type { Tone } from "@/components/StatCard";

// Where a value sits against [warning, critical] limits from the collector's thresholds.
export function toneOf(value: number | null | undefined, limits?: [number, number]): Tone {
  if (value == null || !limits) return "neutral";
  return value >= limits[1] ? "critical" : value >= limits[0] ? "warning" : "ok";
}
