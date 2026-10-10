// Services: app cards, containers and systemd units.
import { h, $ } from "../dom.js";
import { absent, chip, card, secHead, hint } from "../ui.js";
import { fmtNum, fmtBytes, fmtDur, nowS } from "../format.js";

function containerStatus(c) {
  if (c.state === "running") {
    if (c.health === "unhealthy") return chip("critical", "Unhealthy", true);
    if (c.health === "starting") return chip("info", "Starting", true);
    return chip("ok", c.health === "healthy" ? "Healthy" : "Running", true);
  }
  if (c.state === "restarting") return chip("critical", "Restart loop", true);
  return chip("critical", `${c.state}${c.exit_code ? ` (exit ${c.exit_code})` : ""}`, true);
}
export function renderServices(S) {
  const host = location.hostname || "localhost";
  const apps = [];
  const im = S.immich, jf = S.jellyfin;
  const page = S.page || {}, ports = page.ports || {}, access = page.access || {};
  const reach = (app) => access[app] ? [h("dt", {}, "Who can reach it"), h("dd", {}, access[app])] : null;
  if (im) apps.push(card("Immich", im.version ? `v${im.version}` : null,
    h("dl", { class: "kv" },
      h("dt", {}, "Status"), h("dd", {}, im.ok ? chip("ok", "Responding", true) : chip("critical", "Not responding", true)),
      h("dt", {}, "Response"), h("dd", {}, im.latency_ms != null ? `${Math.round(im.latency_ms)} ms` : "–"),
      h("dt", {}, "Library"), h("dd", {}, im.totals ? `${fmtNum(im.totals.photos)} photos · ${fmtNum(im.totals.videos)} videos` : "–"),
      reach("immich")),
    h("div", { class: "app-actions" }, h("a", { href: `http://${host}:${ports.immich}`, target: "_blank", rel: "noopener" }, "Open Immich"))));
  if (jf) apps.push(card("Jellyfin", jf.version ? `v${jf.version}` : null,
    h("dl", { class: "kv" },
      h("dt", {}, "Status"), h("dd", {}, jf.ok ? chip("ok", "Responding", true) : chip("critical", "Not responding", true)),
      h("dt", {}, "Response"), h("dd", {}, jf.latency_ms != null ? `${Math.round(jf.latency_ms)} ms` : "–"),
      h("dt", {}, "Library"), h("dd", {}, jf.counts ? `${fmtNum(jf.counts.movies)} movies · ${fmtNum(jf.counts.series)} shows · ${fmtNum(jf.counts.songs)} songs` : "Add an API key to see counts"),
      h("dt", {}, "Streaming now"), h("dd", {}, `${(jf.sessions || []).filter((s) => s.playing).length}`),
      reach("jellyfin")),
    h("div", { class: "app-actions" }, h("a", { href: `http://${host}:${ports.jellyfin}`, target: "_blank", rel: "noopener" }, "Open Jellyfin"))));
  const mc = S.minecraft;
  if (mc) {
    const tl = mc.tps == null ? "unknown" : mc.tps >= 18 ? "ok" : mc.tps >= 15 ? "warning" : "critical";
    apps.push(card("Minecraft", mc.container,
      h("dl", { class: "kv" },
        h("dt", {}, "Status"), h("dd", {}, mc.state !== "running" ? chip("critical", mc.state, true) : mc.ok ? chip("ok", "Running", true) : chip("info", "Starting", true)),
        h("dt", {}, "Ticks"), h("dd", {}, mc.tps != null ? [chip(tl, `${mc.tps.toFixed(1)} TPS`, true), ` · ${mc.mspt?.toFixed(1)} ms of 50 ms`] : "–"),
        h("dt", {}, "Players"), h("dd", {}, mc.online != null ? `${mc.online} of ${mc.max}${mc.players.length ? ": " + mc.players.join(", ") : ""}` : "–"),
        h("dt", {}, "Address"), h("dd", {}, h("code", {}, `${host}`), ` (port ${ports.minecraft})`))));
  }
  const smbUnit = (S.systemd?.units || []).find((u) => u.unit === "smbd");
  if (!absent(S, "samba")) apps.push(card("Samba", "network drive",
    h("dl", { class: "kv" },
      h("dt", {}, "Status"), h("dd", {}, smbUnit?.active === "active" ? chip("ok", "Running", true) : chip("critical", smbUnit ? smbUnit.active : "Not found", true)),
      h("dt", {}, "Connected"), h("dd", {}, `${(S.samba || []).length} session${(S.samba || []).length === 1 ? "" : "s"}`),
      page.samba_share ? [h("dt", {}, "Address"), h("dd", {}, h("code", {}, `smb://${host}/${page.samba_share}`))] : null,
      reach("samba"))));

  const cont = S.containers || [];
  const groups = {};
  for (const c of cont) (groups[c.project || "other"] ||= []).push(c);
  const crows = [];
  for (const [g, list] of Object.entries(groups)) {
    crows.push(h("tr", { class: "group" }, h("td", { colspan: 7 }, g)));
    for (const c of list) {
      const ports = [...new Set((c.ports || []).map((p) => p.host_port))].join(", ") || (c.network_mode === "host" ? "host network" : "internal");
      crows.push(h("tr", {},
        h("td", {}, h("b", {}, c.name), h("span", { class: "sub" }, c.image)),
        h("td", { class: "nowrap" }, containerStatus(c)),
        h("td", { class: "num" }, c.state === "running" && c.started_at ? fmtDur(nowS() - c.started_at) : "–"),
        h("td", { class: "num" }, c.restarts ? `${c.restarts}` : "0"),
        h("td", { class: "num" }, c.cpu != null ? `${c.cpu.toFixed(1)}%` : "–"),
        h("td", { class: "num" }, c.mem != null ? fmtBytes(c.mem) : "–"),
        h("td", { class: "num" }, ports)));
    }
  }
  const contCard = card("Containers", `${cont.length} total`, cont.length ? h("div", { class: "scroll" }, h("table", {},
    h("thead", {}, h("tr", {}, h("th", {}, "Container"), h("th", {}, "Status"), h("th", { class: "num" }, "Up for"), h("th", { class: "num" }, "Restarts"),
      h("th", { class: "num" }, "CPU"), h("th", { class: "num" }, "Memory"), h("th", { class: "num" }, "Ports"))),
    h("tbody", {}, crows))) : h("div", { class: "empty" }, S.containers == null ? "Docker unavailable." : "No containers."));

  const units = S.systemd?.units || [];
  const crit = S.critical_units || [];
  const urows = units.map((u) => {
    const ok = u.active === "active";
    const lv = ok ? "ok" : u.active === "failed" || crit.includes(u.unit) ? "critical" : "unknown";
    return h("tr", {},
      h("td", {}, h("b", {}, u.unit), h("span", { class: "sub" }, u.description || "")),
      h("td", { class: "nowrap" }, chip(lv, ok ? (u.sub === "running" ? "Running" : u.sub) : u.active, true)),
      h("td", { class: "num" }, ok && u.since ? fmtDur(nowS() - u.since) : "–"),
      h("td", { class: "num" }, u.restarts != null ? `${u.restarts}` : "–"));
  });
  const failed = S.systemd?.failed || [];
  const unitCard = card("System services", failed.length ? `${failed.length} failed unit${failed.length > 1 ? "s" : ""}` : "no failed units",
    h("div", { class: "scroll" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Service"), h("th", {}, "Status"), h("th", { class: "num" }, "Up for"), h("th", { class: "num" }, "Restarts"))),
      h("tbody", {}, urows))),
    failed.length ? hint("Failed: ", failed.join(", "), ". Inspect with ", h("code", {}, "systemctl status <name>")) : null);

  $("#services").replaceChildren(secHead("Services"),
    h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr))" }, apps),
    h("div", { class: "grid", style: "margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr))" }, contCard, unitCard));
}
