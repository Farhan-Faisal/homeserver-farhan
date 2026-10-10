// Shared building blocks: status icons and chips, meters, cards, tiles.
import { h, sv } from "./dom.js";

export function icon(level) {
  const svg = sv("svg", { viewBox: "0 0 16 16", class: `ic ic-${level}`, "aria-hidden": "true" });
  if (level === "warning" || level === "serious") {
    svg.append(sv("path", { class: "fill", d: "M8 1.6 15.2 14.2H.8z" }), sv("path", { class: "mark", d: "M8 6.2v3.6M8 11.9v.1" }));
  } else {
    svg.append(sv("circle", { class: "fill", cx: 8, cy: 8, r: 7 }));
    const d = { ok: "M4.8 8.3l2.2 2.2 4.2-4.5", critical: "M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8",
                info: "M8 7.3v4M8 4.7v.2", unknown: "M5.2 8h5.6" }[level] || "M5.2 8h5.6";
    svg.append(sv("path", { class: "mark", d }));
  }
  return svg;
}
export const chip = (level, text, bare) => h("span", { class: `chip${bare ? " bare" : ""}` }, icon(level), h("span", {}, text));
export function lvl(v, pair) {
  if (v == null || !pair) return "unknown";
  return v >= pair[1] ? "critical" : v >= pair[0] ? "warning" : "ok";
}
export function meter(pct, level, label) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const cls = level === "warning" || level === "critical" || level === "none" ? ` m-${level}` : "";
  return h("div", { class: `meter${cls}`, role: "meter", "aria-valuemin": 0, "aria-valuemax": 100,
    "aria-valuenow": Math.round(p), "aria-label": label || null },
    h("div", { class: "fill", style: `width:${p}%` }));
}
export function card(title, sub, ...body) {
  return h("div", { class: "card" }, title ? h("h3", {}, title, sub ? h("span", { class: "sub" }, sub) : null) : null, ...body);
}
export function secHead(title, sub) {
  return h("div", { class: "sec-head" }, h("h2", {}, title), sub ? h("span", { class: "sub" }, sub) : null);
}
export const hint = (...kids) => h("div", { class: "hint" }, ...kids);

export function tile(label, value, unit, subline, extra, status) {
  return h("div", { class: "card tile" },
    h("div", { class: "label" }, h("span", {}, label), status || null),
    h("div", { class: "value" }, value, unit ? h("small", {}, unit) : null),
    extra || null,
    subline ? h("div", { class: "subline" }, subline) : null);
}

// A probe the server doesn't have (no Samba, no Tailscale...) is null with no error.
// Those sections are hidden; null *with* an error means "installed but broken" and is shown.
export const absent = (S, key) => S[key] == null && !(S.errors || {})[key];

export function overallLevel(alerts) {
  if (!alerts) return "unknown";
  if (alerts.some((a) => a.level === "critical")) return "critical";
  if (alerts.some((a) => a.level === "warning")) return "warning";
  return "ok";
}
