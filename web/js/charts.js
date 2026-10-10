// Hand-drawn SVG charts: line charts with hover/keyboard tooltips, and a stacked bar.
// Charts redraw on resize through one ResizeObserver.
import { h, sv } from "./dom.js";
import { card } from "./ui.js";
import { fmtBytes, fmtClock, fmtDateTime, nowS } from "./format.js";
import { showTip, hideTip } from "./tooltip.js";

function niceStep(range, count) {
  const raw = range / count, mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}
const charts = [];
export function lineChart(o) {
  // o: {title, sub, series:[{key,label,color}], points, fmt, axisFmt, yMin, yMax, fixedMax, ref, refLabel, window, step}
  const box = h("div", { class: "chart-box" });
  const legend = o.series.length > 1
    ? h("div", { class: "legend" }, o.series.map((s) => h("span", {}, h("i", { class: "lkey", style: `background:var(${s.color})` }), s.label)))
    : null;
  const pts = o.points;
  const last = [...pts].reverse().find((p) => o.series.some((s) => p[s.key] != null));
  const table = h("details", { class: "data" }, h("summary", {}, "Show data"),
    h("div", { class: "scroll" }, h("table", {},
      h("thead", {}, h("tr", {}, h("th", {}, "Time"), o.series.map((s) => h("th", { class: "num" }, s.label)))),
      h("tbody", {}, pts.slice(-10).reverse().map((p) => h("tr", {},
        h("td", {}, o.window > 4000 ? fmtDateTime(p.t) : fmtClock(p.t)),
        o.series.map((s) => h("td", { class: "num" }, o.fmt(p[s.key])))))))));
  const c = card(o.title, o.sub, legend, box, table);
  const chart = { box, draw: (W) => drawLine(box, W, o, last) };
  charts.push(chart);
  return c;
}
function drawLine(box, W, o, last) {
  const H = 170, ml = 44, mr = 64, mt = 10, mb = 22;
  const pw = Math.max(40, W - ml - mr), ph = H - mt - mb;
  const pts = o.points;
  const tMax = pts.length ? pts[pts.length - 1].t : nowS();
  const tMin = tMax - o.window;
  const vals = [];
  for (const p of pts) for (const s of o.series) if (p[s.key] != null) vals.push(p[s.key]);
  let yMin = o.yMin ?? 0, yMax;
  if (o.fixedMax != null) yMax = o.fixedMax;
  else {
    let hi = vals.length ? Math.max(...vals) : 1;
    if (o.ref != null) hi = Math.max(hi, o.ref + 3);
    if (o.yMin == null && vals.length && o.autoMin) yMin = Math.max(0, Math.floor((Math.min(...vals) - 8) / 10) * 10);
    const step = niceStep(Math.max(hi - yMin, 1e-9), 3);
    yMax = Math.ceil(hi / step) * step;
    if (yMax <= yMin) yMax = yMin + step;
  }
  const step = niceStep(yMax - yMin, 3);
  const x = (t) => ml + ((t - tMin) / o.window) * pw;
  const y = (v) => mt + ph - ((v - yMin) / (yMax - yMin)) * ph;
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, height: H, tabindex: 0, role: "img",
    "aria-label": `${o.title}. Latest: ${o.series.map((s) => `${s.label} ${o.fmt(last?.[s.key])}`).join(", ")}` });
  for (let v = yMin; v <= yMax + 1e-9; v += step) {
    svg.append(sv("line", { x1: ml, x2: ml + pw, y1: y(v), y2: y(v), style: `stroke:var(${v === yMin ? "--axis" : "--grid"});stroke-width:1` }));
    svg.append(sv("text", { x: ml - 8, y: y(v) + 4, "text-anchor": "end", class: "axis-text" }, (o.axisFmt || o.fmt)(v)));
  }
  const nTicks = W < 420 ? 2 : 4;
  for (let i = 0; i <= nTicks; i++) {
    const t = tMin + (o.window * i) / nTicks;
    const lab = i === nTicks ? "now" : (o.window > 4000 ? fmtDateTime(t).replace(/^[A-Za-z]{3} \d+, /, "") : fmtClock(t));
    svg.append(sv("text", { x: x(t), y: H - 4, "text-anchor": i === 0 ? "start" : i === nTicks ? "end" : "middle", class: "axis-text" }, lab));
  }
  if (o.ref != null && o.ref <= yMax && o.ref >= yMin) {
    svg.append(sv("line", { x1: ml, x2: ml + pw, y1: y(o.ref), y2: y(o.ref), style: "stroke:var(--serious);stroke-width:1;opacity:.7" }));
    svg.append(sv("text", { x: ml + 4, y: y(o.ref) - 4, class: "axis-text" }, o.refLabel));
  }
  const gap = (o.step || 10) * 3.5;
  for (const s of o.series) {
    let d = "", prevT = null;
    for (const p of pts) {
      const v = p[s.key];
      if (v == null || p.t < tMin) { prevT = null; continue; }
      d += `${prevT == null || p.t - prevT > gap ? "M" : "L"}${x(p.t).toFixed(1)},${y(Math.min(Math.max(v, yMin), yMax)).toFixed(1)}`;
      prevT = p.t;
    }
    if (d) svg.append(sv("path", { d, style: `fill:none;stroke:var(${s.color});stroke-width:2;stroke-linejoin:round;stroke-linecap:round` }));
  }
  // end dots and direct labels (skipped if labels would collide; the legend carries identity)
  const ends = o.series.map((s) => ({ s, v: last?.[s.key] })).filter((e) => e.v != null);
  const ys = ends.map((e) => y(Math.min(Math.max(e.v, yMin), yMax))).sort((a, b) => a - b);
  const collide = ys.some((v, i) => i && v - ys[i - 1] < 14);
  for (const e of ends) {
    const ey = y(Math.min(Math.max(e.v, yMin), yMax)), ex = x(last.t);
    svg.append(sv("circle", { cx: ex, cy: ey, r: 4, style: `fill:var(${e.s.color});stroke:var(--surface);stroke-width:2` }));
    if (!collide) svg.append(sv("text", { x: ex + 9, y: ey + 4, class: "end-text" }, o.fmt(e.v)));
  }
  // hover layer: crosshair snaps to nearest sample, one tooltip lists every series
  const cross = sv("line", { y1: mt, y2: mt + ph, style: "stroke:var(--axis);stroke-width:1;display:none" });
  const dots = o.series.map((s) => sv("circle", { r: 4, style: `fill:var(${s.color});stroke:var(--surface);stroke-width:2;display:none` }));
  svg.append(cross, ...dots);
  const visible = pts.filter((p) => p.t >= tMin);
  let idx = -1;
  const show = (i, cx, cy) => {
    if (!visible.length) return;
    idx = Math.max(0, Math.min(visible.length - 1, i));
    const p = visible[idx], px = x(p.t);
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.style.display = "";
    o.series.forEach((s, k) => {
      const v = p[s.key];
      if (v == null) { dots[k].style.display = "none"; return; }
      dots[k].setAttribute("cx", px); dots[k].setAttribute("cy", y(Math.min(Math.max(v, yMin), yMax))); dots[k].style.display = "";
    });
    if (cx == null) { const r = svg.getBoundingClientRect(); cx = r.left + px * (r.width / W); cy = r.top + mt; }
    showTip(cx, cy, [h("div", { class: "t" }, o.window > 4000 ? fmtDateTime(p.t) : new Date(p.t * 1000).toLocaleTimeString()),
      ...o.series.map((s) => h("div", { class: "r" }, h("i", { class: "lkey", style: `background:var(${s.color})` }), h("b", {}, o.fmt(p[s.key])), h("span", {}, s.label)))]);
  };
  const hide = () => { cross.style.display = "none"; dots.forEach((d) => (d.style.display = "none")); hideTip(); };
  const nearest = (t) => {
    let lo = 0, hi = visible.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (visible[m].t < t) lo = m + 1; else hi = m; }
    return lo > 0 && Math.abs(visible[lo - 1].t - t) < Math.abs(visible[lo].t - t) ? lo - 1 : lo;
  };
  svg.addEventListener("pointermove", (ev) => {
    const r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) * (W / r.width);
    if (sx < ml - 4 || sx > ml + pw + 8) { hide(); return; }
    show(nearest(tMin + ((sx - ml) / pw) * o.window), ev.clientX, ev.clientY);
  });
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("blur", hide);
  svg.addEventListener("focus", () => show(visible.length - 1));
  svg.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowLeft") { show(idx - 1); ev.preventDefault(); }
    if (ev.key === "ArrowRight") { show(idx + 1); ev.preventDefault(); }
    if (ev.key === "Escape") hide();
  });
  if (visible.length < 2) {
    svg.append(sv("text", { x: ml + pw / 2, y: mt + ph / 2, "text-anchor": "middle", class: "axis-text" },
      o.window > 4000 ? "24-hour history fills in over the next day" : "Collecting history…"));
  }
  box.replaceChildren(svg);
}
const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const c = charts.find((c) => c.box === e.target);
    if (c) c.draw(Math.round(e.contentRect.width));
  }
});
export function resetCharts() { charts.length = 0; ro.disconnect(); }
export function drawCharts() {
  for (const c of charts) { c.draw(Math.round(c.box.clientWidth) || 360); ro.observe(c.box); }
}

// ------------------------------------------------------------------ stacked bar
export function stackBar(parts, total, label) {
  const bar = h("div", { class: "stack", role: "img", "aria-label": label });
  const legend = h("div", { class: "slegend" });
  for (const p of parts) {
    if (!p.bytes || p.bytes <= 0) continue;
    const pct = (100 * p.bytes) / total;
    const seg = h("div", { style: `flex:${p.bytes} 1 0;background:var(${p.color})` });
    const text = () => [h("div", { class: "t" }, p.label), h("div", { class: "r" }, h("b", {}, fmtBytes(p.bytes)), h("span", {}, `${pct.toFixed(1)}%`))];
    seg.addEventListener("pointermove", (ev) => showTip(ev.clientX, ev.clientY, text()));
    seg.addEventListener("pointerleave", hideTip);
    bar.append(seg);
    legend.append(h("div", {}, h("i", { class: "swatch", style: `background:var(${p.color})` }),
      h("span", {}, p.label), h("b", {}, fmtBytes(p.bytes)), h("span", { class: "muted" }, `${pct.toFixed(0)}%`)));
  }
  return [bar, legend];
}
