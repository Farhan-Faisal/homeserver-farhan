// Entry point: fetch status.json every 5 s, re-render when it changes, wire the controls.
// Each section lives in js/sections/ and renders from the sample S alone.
import { $, store } from "./dom.js";
import { drawCharts } from "./charts.js";
import { renderHeader, renderBanner, renderAlerts } from "./sections/header.js";
import { renderTiles, renderCharts } from "./sections/overview.js";
import { renderPeople } from "./sections/people.js";
import { renderStorage } from "./sections/storage.js";
import { renderServices } from "./sections/services.js";
import { renderHardware } from "./sections/hardware.js";

const POLL_MS = 5000;
let S = null, lastGen = 0, range = store.get("sd-range", "short");

function render() {
  renderHeader(S); renderAlerts(S); renderTiles(S); renderCharts(S, range);
  renderPeople(S); renderStorage(S); renderServices(S); renderHardware(S);
  $("#footer").replaceChildren(`Read-only view. Refreshes every ${S.interval || 10} s · collected in ${S.collect_ms ?? "–"} ms · data from /opt/serverdash/www/status.json`);
  drawCharts();
}

async function load() {
  try {
    const r = await fetch(`status.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    $("#main").classList.remove("loading");
    if (data.generated_at !== lastGen) { S = data; lastGen = data.generated_at; render(); }
    else renderHeader(S);
    renderBanner(S, false);
  } catch (e) {
    if (S) $("#main").classList.add("loading");
    renderBanner(S, true);
  }
}

// chart range: 1 hour (full resolution) or 24 hours (5-minute averages)
document.querySelectorAll("[data-range]").forEach((b) => {
  b.setAttribute("aria-pressed", String(b.dataset.range === range));
  b.addEventListener("click", () => {
    range = b.dataset.range; store.set("sd-range", range);
    document.querySelectorAll("[data-range]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    if (S) { renderCharts(S, range); drawCharts(); }
  });
});

// theme: auto (follow the OS) → light → dark
const themes = ["auto", "light", "dark"];
let theme = store.get("sd-theme", "auto");
function applyTheme() {
  if (theme === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
  $("#theme").textContent = `Theme: ${theme}`;
  if (S) drawCharts();
}
$("#theme").addEventListener("click", () => { theme = themes[(themes.indexOf(theme) + 1) % 3]; store.set("sd-theme", theme); applyTheme(); });

applyTheme();
load();
setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
