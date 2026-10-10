// Overview: the tiles row and the three history charts.
import { $ } from "../dom.js";
import { absent, chip, lvl, meter, tile } from "../ui.js";
import { fmtPct, fmtTemp, fmtBytes, fmtRate } from "../format.js";
import { lineChart, resetCharts } from "../charts.js";

export function renderTiles(S) {
  const th = S.thresholds || {};
  const hst = S.host || {}, cpu = S.cpu || {}, mem = S.memory || {}, t = S.temps || {};
  const g = S.gpu?.gpus?.[0];
  const tiles = [];
  tiles.push(tile("CPU", cpu.total == null ? "–" : Math.round(cpu.total), cpu.total == null ? "" : "%",
    `${hst.cores || "?"} cores · ${hst.threads || "?"} threads${hst.cpu_mhz ? ` · ${(hst.cpu_mhz / 1000).toFixed(1)} GHz` : ""}`,
    meter(cpu.total, "ok", "CPU usage")));
  const memLv = lvl(mem.pct, th.mem_pct);
  tiles.push(tile("Memory", mem.pct == null ? "–" : Math.round(mem.pct), mem.pct == null ? "" : "%",
    `${fmtBytes(mem.used)} of ${fmtBytes(mem.total)}${mem.swap_used > 1e8 ? ` · swap ${fmtBytes(mem.swap_used)}` : ""}`,
    meter(mem.pct, memLv, "Memory usage"), memLv !== "ok" ? chip(memLv, memLv, true) : null));
  const hdd = Object.entries(S.smart || {}).find(([d]) => (S.disks || []).find((x) => x.name === d && x.rotational));
  const cLv = lvl(t.cpu, th.cpu_temp);
  tiles.push(tile("CPU temperature", t.cpu == null ? "–" : Math.round(t.cpu), t.cpu == null ? "" : "°C",
    [t.nvme != null ? `SSD ${fmtTemp(t.nvme)}` : null, hdd?.[1]?.temp != null ? `HDD ${fmtTemp(hdd[1].temp)}` : null].filter(Boolean).join(" · ") || null,
    null, chip(cLv, cLv === "ok" ? "Normal" : cLv === "warning" ? "Hot" : cLv === "critical" ? "Too hot" : "No data", true)));
  if (g) {
    const gLv = lvl(g.temp, th.gpu_temp);
    tiles.push(tile("GPU", g.util == null ? "–" : Math.round(g.util), g.util == null ? "" : "% busy",
      `${fmtTemp(g.temp)} · VRAM ${fmtBytes(g.mem_used)} of ${fmtBytes(g.mem_total)}`,
      meter(g.mem_total ? (100 * g.mem_used) / g.mem_total : 0, "ok", "GPU memory used"),
      chip(gLv, gLv === "ok" ? "Normal" : "Hot", true)));
  } else {
    tiles.push(tile("GPU", "–", "", S.gpu?.error || "No NVIDIA data"));
  }
  const pw = S.power || {}, bat = pw.batteries?.[0];
  if (bat || pw.ac_online != null) {
    const onBat = pw.ac_online === false;
    tiles.push(tile("Power", onBat ? "On battery" : "Mains", "",
      bat ? `Battery ${fmtPct(bat.capacity)} · ${(bat.status || "").toLowerCase()}${bat.health ? ` · health ${fmtPct(bat.health)}` : ""}` : null,
      bat ? meter(bat.capacity, onBat ? lvl(100 - bat.capacity, [70, 85]) : "ok", "Battery charge") : null,
      chip(onBat ? "warning" : "ok", onBat ? "Unplugged" : "Plugged in", true)));
  }
  const net = (S.network || []).filter((i) => !i.name.startsWith("tailscale"));
  const rx = net.reduce((a, i) => a + (i.rx_bps || 0), 0), tx = net.reduce((a, i) => a + (i.tx_bps || 0), 0);
  const wifi = net.find((i) => i.wireless && i.up);
  tiles.push(tile("Network", `↓ ${fmtRate(rx)}`, "", `↑ ${fmtRate(tx)}${wifi ? ` · Wi-Fi ${wifi.ssid || wifi.name}${wifi.signal_dbm != null ? ` ${wifi.signal_dbm} dBm` : ""}` : ""}`));
  const ts = S.tailscale;
  const peers = ts?.peers || [];
  const tsLv = !ts ? "critical" : ts.state === "Running" ? "ok" : "critical";
  if (!absent(S, "tailscale")) tiles.push(tile("Devices", `${peers.filter((p) => p.online).length}`, ` of ${peers.length}`,
    ts ? `Remote access via Tailscale${ts.state === "Running" ? "" : ` (${ts.state})`}` : "Tailscale unavailable", null,
    chip(tsLv, tsLv === "ok" ? "Connected" : "Down", true)));
  const cont = S.containers || [];
  const bad = cont.filter((c) => c.state !== "running" || c.health === "unhealthy").length;
  tiles.push(tile("Containers", `${cont.length - bad}`, ` of ${cont.length} up`,
    `Load ${(hst.load || []).map((v) => (v ?? 0).toFixed(2)).join(" · ")}`, null,
    chip(bad ? "critical" : "ok", bad ? `${bad} down` : "Healthy", true)));
  $("#tiles").replaceChildren(...tiles);
}

export function renderCharts(S, range) {
  resetCharts();
  const hist = (S.history || {})[range] || [];
  const window = range === "long" ? 86400 : 3600, step = range === "long" ? 300 : (S.interval || 10);
  const th = S.thresholds || {};
  const hasGpu = !!S.gpu?.gpus?.length;
  const tempSeries = [{ key: "tcpu", label: "CPU", color: "--s1" }];
  if (hasGpu) tempSeries.push({ key: "tgpu", label: "GPU", color: "--s2" });
  const useSeries = [{ key: "cpu", label: "CPU", color: "--s1" }];
  if (hasGpu) useSeries.push({ key: "gpu", label: "GPU", color: "--s2" });
  useSeries.push({ key: "mem", label: "Memory", color: "--s3" });
  $("#charts").replaceChildren(
    lineChart({ title: "Temperature", sub: range === "long" ? "5-min averages" : null, series: tempSeries, points: hist,
      fmt: (v) => (v == null ? "–" : `${Math.round(v)}°`), autoMin: true, ref: th.cpu_temp?.[0], refLabel: `${th.cpu_temp?.[0]}° warning`, window, step }),
    lineChart({ title: "Usage", sub: "% of capacity", series: useSeries, points: hist,
      fmt: (v) => (v == null ? "–" : `${Math.round(v)}%`), fixedMax: 100, window, step }),
    lineChart({ title: "Network", sub: "home network, excluding Tailscale overhead", points: hist, window, step,
      series: [{ key: "rx", label: "Download", color: "--s1" }, { key: "tx", label: "Upload", color: "--s2" }],
      fmt: fmtRate, axisFmt: (v) => fmtRate(v).replace("/s", "") }));
}
