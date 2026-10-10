// Number, size, rate, duration and time formatting.

const nf = new Intl.NumberFormat();
export const fmtNum = (v) => v == null ? "–" : nf.format(v);
export const fmtPct = (v) => v == null ? "–" : `${Math.round(v)}%`;
export const fmtTemp = (v) => v == null ? "–" : `${Math.round(v)} °C`;
export function fmtBytes(b) {
  if (b == null || isNaN(b)) return "–";
  const u = ["B", "KiB", "MiB", "GiB", "TiB"]; let i = 0;
  while (Math.abs(b) >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i === 0 || b >= 100 ? 0 : 1)} ${u[i]}`;
}
export function fmtRate(v) {
  if (v == null || isNaN(v)) return "–";
  const u = ["B/s", "KB/s", "MB/s", "GB/s"]; let i = 0;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return `${v.toFixed(i === 0 || v >= 100 ? 0 : 1)} ${u[i]}`;
}
export function fmtDur(sec) {
  sec = Math.max(0, sec || 0);
  const d = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  if (d) return `${d} d ${hh} h`;
  if (hh) return `${hh} h ${m} min`;
  if (m) return `${m} min`;
  return `${Math.round(sec)} s`;
}
export const nowS = () => Date.now() / 1000;
export function fmtAgo(t) {
  if (!t) return "–";
  const s = nowS() - t;
  return s < 45 ? "just now" : `${fmtDur(s)} ago`;
}
export const fmtClock = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (t) => new Date(t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
