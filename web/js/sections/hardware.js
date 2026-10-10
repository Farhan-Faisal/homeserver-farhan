// Hardware: every temperature sensor, the GPU, and system facts.
import { h, $ } from "../dom.js";
import { icon, chip, lvl, meter, card, secHead, hint } from "../ui.js";
import { fmtNum, fmtPct, fmtTemp, fmtBytes, fmtDur, fmtDateTime } from "../format.js";

export function renderHardware(S) {
  const th = S.thresholds || {};
  const t = S.temps || {};
  const blocks = [];
  const groups = {}, byGroup = {};
  for (const s of t.sensors || []) (byGroup[s.group] ||= []).push(s);
  for (const [g, list] of Object.entries(byGroup)) {
    if (list.length === 1 && /^temp\d+$/.test(list[0].label)) (groups["Other sensors"] ||= []).push({ ...list[0], label: g });
    else groups[g] = list;
  }
  const pairFor = (g, s) => g === "CPU" ? th.cpu_temp : g === "NVMe SSD" ? th.nvme_temp : s.crit ? [s.high || s.crit - 10, s.crit] : null;
  const order = ["CPU", "NVMe SSD", "Other sensors"];
  const gnames = Object.keys(groups).sort((a, b) => ((order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)));
  const sm = S.smart || {};
  const hdd = (S.disks || []).filter((d) => d.rotational && sm[d.name]?.temp != null);
  const g0 = S.gpu?.gpus?.[0];
  const trow = (name, temp, scale, l, aria) => h("div", { class: "trow" }, h("div", { class: "name" }, name),
    meter((100 * temp) / scale, l === "unknown" ? "ok" : l, aria),
    h("div", { class: "val" }, l === "warning" || l === "critical" ? icon(l) : null, " ", fmtTemp(temp)));
  const tgroup = (name, rows) => [h("div", { class: "tgroup" }, name), rows];
  blocks.push(card("Temperatures", "all sensors", gnames.map((g) => {
    const list = groups[g];
    const cores = g === "CPU" ? list.filter((s) => /^Core /.test(s.label)) : [];
    const rest = list.filter((s) => !cores.includes(s));
    const rows = rest.map((s) => { const pair = pairFor(g, s); return trow(s.label, s.temp, Math.max(100, s.crit || 0), lvl(s.temp, pair), `${g} ${s.label} temperature`); });
    if (cores.length) {
      const hot = cores.reduce((a, b) => (b.temp > a.temp ? b : a));
      const cool = Math.min(...cores.map((c) => c.temp));
      rows.push(trow(`${cores.length} cores · hottest ${hot.label.replace("Core ", "#")}`, hot.temp, 100, lvl(hot.temp, th.cpu_temp), "Hottest CPU core"));
      rows.push(h("div", { class: "small muted" }, `Cores range ${Math.round(cool)}–${Math.round(hot.temp)} °C`));
    }
    return tgroup(g, rows);
  }),
    g0 ? tgroup("GPU", trow(g0.name, g0.temp, 100, lvl(g0.temp, th.gpu_temp), "GPU temperature")) : null,
    hdd.length ? tgroup("Hard drive", hdd.map((d) => trow(sm[d.name].model || d.name, sm[d.name].temp, 70, lvl(sm[d.name].temp, th.hdd_temp), "Hard drive temperature"))) : null,
    (t.fans || []).length ? tgroup("Fans", t.fans.map((f) => h("div", { class: "trow" }, h("div", { class: "name" }, f.label), h("div", {}), h("div", { class: "val" }, `${fmtNum(f.rpm)} rpm`)))) : null));

  if (S.gpu?.gpus?.length) {
    const g = g0;
    const procs = S.gpu.processes || [];
    blocks.push(card("GPU", g.name,
      h("dl", { class: "kv" },
        h("dt", {}, "Busy"), h("dd", {}, `${fmtPct(g.util)} compute · ${fmtPct(g.mem_util)} memory bandwidth`),
        h("dt", {}, "VRAM"), h("dd", {}, `${fmtBytes(g.mem_used)} of ${fmtBytes(g.mem_total)}`),
        h("dt", {}, "Temperature"), h("dd", {}, fmtTemp(g.temp)),
        h("dt", {}, "Power"), h("dd", {}, g.power_w != null ? `${g.power_w.toFixed(1)} W${g.power_limit_w ? ` of ${Math.round(g.power_limit_w)} W` : ""}` : "not reported by this laptop GPU"),
        h("dt", {}, "Clock"), h("dd", {}, g.clock_mhz != null ? `${fmtNum(g.clock_mhz)} MHz${g.clock_max_mhz ? ` (max ${fmtNum(g.clock_max_mhz)})` : ""} · state ${g.pstate || "–"}` : "–"),
        h("dt", {}, "Driver"), h("dd", {}, `${g.driver || "–"}${g.compute_cap ? ` · compute ${g.compute_cap}` : ""}`)),
      h("div", { style: "margin-top:12px", class: "small muted" }, "Processes using the GPU"),
      procs.length ? h("div", { class: "scroll" }, h("table", {}, h("tbody", {}, procs.map((p) => h("tr", {},
        h("td", {}, h("b", {}, p.name), h("span", { class: "sub" }, `pid ${p.pid}${p.container ? ` · container ${p.container}` : ""}`)),
        h("td", { class: "num" }, fmtBytes(p.mem)))))))
        : h("div", { class: "empty" }, "Idle: nothing is using the GPU."),
      g.compute_cap && g.compute_cap.startsWith("6.") ? hint("Pascal card: use CUDA 12.x builds, e.g. PyTorch cu126 with torch < 2.15.") : null));
  }

  const hst = S.host || {}, pw = S.power || {}, up = S.updates || {};
  const bat = pw.batteries?.[0];
  blocks.push(card("System", null,
    h("dl", { class: "kv" },
      h("dt", {}, "CPU"), h("dd", {}, hst.cpu_model || "–"),
      h("dt", {}, "OS"), h("dd", {}, `${hst.os || "–"} · kernel ${hst.kernel || "–"}`),
      h("dt", {}, "Booted"), h("dd", {}, hst.boot_time ? `${fmtDateTime(hst.boot_time)} (${fmtDur(hst.uptime)} ago)` : "–"),
      h("dt", {}, "Load"), h("dd", {}, `${(hst.load || []).map((v) => (v ?? 0).toFixed(2)).join(" · ")} (1, 5, 15 min) on ${hst.threads || "?"} threads`),
      h("dt", {}, "Updates"), h("dd", {}, up.total == null ? "checking…" : `${up.total} pending${up.security != null ? `, ${up.security} security` : ""}`),
      h("dt", {}, "Reboot"), h("dd", {}, hst.reboot_required ? chip("info", "Needed for updates", true) : "Not needed"),
      bat ? [h("dt", {}, "Battery"), h("dd", {}, `${fmtPct(bat.capacity)} · ${bat.status || ""}${bat.health ? ` · health ${fmtPct(bat.health)}` : ""}${bat.cycles ? ` · ${bat.cycles} cycles` : ""}${bat.power_w ? ` · ${bat.power_w} W` : ""}`)] : null,
      ...(S.network || []).filter((i) => i.up).map((i) => [h("dt", {}, i.name), h("dd", {},
        [(i.addrs || []).join(", "), i.ssid ? `Wi-Fi “${i.ssid}”` : null, i.signal_dbm != null ? `${i.signal_dbm} dBm` : null, i.bitrate_mbps ? `${i.bitrate_mbps} Mbit/s link` : null].filter(Boolean).join(" · ") || "–")])),
    Object.keys(S.errors || {}).length ? hint("Collector problems: ", Object.entries(S.errors).map(([k, v]) => `${k}: ${v}`).join(" · ")) : null));
  $("#hardware").replaceChildren(secHead("Hardware"), h("div", { class: "grid g-3" }, blocks));
}
