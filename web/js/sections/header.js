// Page header, stale-data banner and the alert list.
import { h, $ } from "../dom.js";
import { icon, chip, overallLevel } from "../ui.js";
import { fmtDur, nowS, fmtAgo } from "../format.js";

export function renderHeader(S) {
  const hst = S.host || {};
  $("#host").textContent = hst.hostname || "Server";
  document.title = `${hst.hostname || "Server"} · Dashboard`;
  const al = S.alerts || [];
  const lv = overallLevel(al);
  const nC = al.filter((a) => a.level === "critical").length, nW = al.filter((a) => a.level === "warning").length;
  const text = lv === "ok" ? "All systems normal" : [nC && `${nC} critical`, nW && `${nW} warning${nW > 1 ? "s" : ""}`].filter(Boolean).join(", ");
  $("#overall").replaceChildren(chip(lv, text));
  const ts = S.tailscale?.self;
  $("#meta").replaceChildren(
    `Updated ${fmtAgo(S.generated_at)} · up ${fmtDur(hst.uptime)}`,
    ts?.ips?.[0] ? ` · Tailscale ${ts.ips[0]}` : "",
    hst.os ? ` · ${hst.os}` : "");
}

export function renderBanner(S, fetchErr) {
  const b = $("#banner");
  const age = S ? nowS() - S.generated_at : Infinity;
  const limit = Math.max(60, (S?.interval || 10) * 4);
  if (fetchErr && !S) {
    b.replaceChildren(h("div", { class: "banner" }, icon("critical"),
      h("div", {}, h("b", {}, "Can't load status.json. "), "Check the collector: ", h("code", {}, "sudo systemctl status serverdash-collector"))));
  } else if (age > limit) {
    b.replaceChildren(h("div", { class: "banner" }, icon("critical"),
      h("div", {}, h("b", {}, `Data is ${fmtDur(age)} old. `), "The collector may have stopped. Check: ",
        h("code", {}, "sudo systemctl status serverdash-collector"), " and ", h("code", {}, "sudo journalctl -u serverdash-collector -n 30"))));
  } else if (fetchErr) {
    b.replaceChildren(h("div", { class: "banner" }, icon("warning"), h("div", {}, "Lost connection to the server. Retrying…")));
  } else b.replaceChildren();
}

export function renderAlerts(S) {
  const al = S.alerts || [];
  const el = $("#alerts");
  if (!al.length) { el.replaceChildren(); return; }
  el.replaceChildren(h("div", { class: "card alerts", style: "margin-bottom:12px", role: "list", "aria-label": "Alerts" },
    al.map((a) => h("div", { class: "alert", role: "listitem" }, chip(a.level, a.level === "critical" ? "Critical" : a.level === "warning" ? "Warning" : "Note"),
      h("span", { class: "area" }, a.area), h("span", {}, a.text)))));
}
