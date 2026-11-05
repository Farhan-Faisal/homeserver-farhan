import type { Range } from "./types";

export const fmtPct = (v?: number | null) => (v == null ? "–" : `${Math.round(v)}%`);

// 1536 -> "1.5 KiB"
export function fmtBytes(b?: number | null): string {
  if (b == null) return "–";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i === 0 || b >= 100 ? 0 : 1)} ${units[i]}`;
}

// bytes per second -> "2.3 MB/s"
export function fmtRate(v?: number | null): string {
  if (v == null) return "–";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let i = 0;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return `${v.toFixed(i === 0 || v >= 100 ? 0 : 1)} ${units[i]}`;
}

// seconds -> "3 d 4 h", "2 h 5 min", "40 s"
export function fmtDuration(sec: number): string {
  sec = Math.max(0, sec);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min`;
  return `${Math.round(sec)} s`;
}

// a chart's time labels: clock times for short ranges, dates for long ones
export function fmtTick(t: number, range: Range): string {
  const d = new Date(t * 1000);
  if (range === "1h" || range === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "1y") return d.toLocaleDateString([], { month: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export const fmtWhen = (t: number) =>
  new Date(t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });