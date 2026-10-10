// Storage: drive composition, volumes, Immich per-person usage, drive health.
import { h, $ } from "../dom.js";
import { chip, lvl, meter, card, secHead, hint } from "../ui.js";
import { fmtNum, fmtPct, fmtTemp, fmtBytes, fmtRate, fmtAgo } from "../format.js";
import { stackBar } from "../charts.js";

export function renderStorage(S) {
  const th = S.thresholds || {};
  const fss = S.filesystems || [];
  const disks = S.disks || [];
  const blocks = [];
  // HDD composition
  const hddFs = fss.find((f) => f.mount === S.page?.data_mount) || fss.find((f) => disks.find((d) => d.name === f.disk && d.rotational));
  const loop = fss.find((f) => f.backing_file);
  const fold = S.folders;
  if (hddFs) {
    const files = fold?.folders?.filter((f) => !f.path.includes("/media")).reduce((a, f) => a + (f.bytes || 0), 0) || 0;
    const media = fold?.folders?.filter((f) => f.path.includes("/media")).reduce((a, f) => a + (f.bytes || 0), 0) || 0;
    const imm = loop?.backing_file?.startsWith(hddFs.mount) ? loop.backing_allocated || 0 : 0;
    const other = Math.max(0, hddFs.used - imm - files - media);
    const parts = [
      { label: "Immich photos", bytes: imm, color: "--s1" },
      { label: "Files (Samba)", bytes: files, color: "--s2" },
      { label: "Media (Jellyfin)", bytes: media, color: "--s3" },
      { label: "Other / system", bytes: other, color: "--other" },
      { label: "Free", bytes: hddFs.avail, color: "--track" },
    ];
    const [bar, legend] = stackBar(parts, hddFs.used + hddFs.avail, "Hard drive usage by category");
    blocks.push(card("Hard drive", `${fmtBytes(hddFs.used)} used of ${fmtBytes(hddFs.total)}`, bar, legend,
      fold ? h("div", { class: "small muted", style: "margin-top:10px" }, `Folder sizes measured ${fmtAgo(S.slow_at?.folders)}, every 30 min.`)
        : h("div", { class: "small muted", style: "margin-top:10px" }, "Measuring folder sizes in the background…"),
      loop ? h("div", { class: "small muted" }, `Immich has a ${fmtBytes(loop.backing_size)} cap; its image file currently takes ${fmtBytes(loop.backing_allocated)} on the drive.`) : null));
  }
  // file systems
  blocks.push(card("Volumes", null, fss.map((f) => {
    const l = lvl(f.pct, th.disk_pct);
    return h("div", { class: "mrow" },
      h("div", { class: "name" }, f.label || f.mount, h("span", { class: "sub" }, `${f.mount} · ${f.device.replace("/dev/", "")}`)),
      h("div", { class: "val" }, `${fmtBytes(f.used)} of ${fmtBytes(f.total)} · ${fmtBytes(f.avail)} free`),
      meter(f.pct, l, `${f.mount} used`),
      l === "warning" || l === "critical" ? h("div", { class: "note" }, chip(l, `${Math.round(f.pct)}% full`, true)) : null);
  })));
  // immich users
  const im = S.immich;
  if (im) {
    const users = im.users || [];
    const immFs = loop;
    const rows = users.map((u) => {
      const pct = u.quota ? (100 * (u.usage || 0)) / u.quota : immFs ? (100 * (u.usage || 0)) / immFs.total : 0;
      const l = u.quota ? lvl(pct, th.quota_pct) : "none";
      const counts = u.photos != null ? `${fmtNum(u.photos)} photos · ${fmtNum(u.videos)} videos` : null;
      return h("div", { class: "mrow" },
        h("div", { class: "name" }, u.name || u.label || "user", h("span", { class: "sub" }, [u.email, u.label && `folder ${u.label}`].filter(Boolean).join(" · "))),
        h("div", { class: "val" }, u.quota ? `${fmtBytes(u.usage)} of ${fmtBytes(u.quota)}` : `${fmtBytes(u.usage)} · no quota`),
        meter(pct, l, `${u.name} storage`),
        h("div", { class: "note" }, counts, !u.quota && !u.from_folder ? [counts ? " · " : "", "No quota set: this account can fill the whole Immich space."] : null));
    });
    const noKey = (im.errors || []).some((e) => e.startsWith("no API key"));
    blocks.push(card("Immich storage by person", im.totals ? `${fmtNum(im.totals.photos)} photos · ${fmtNum(im.totals.videos)} videos · ${fmtBytes(im.totals.usage)}` : null,
      rows.length ? rows : h("div", { class: "empty" }, im.ok ? "No per-user data yet." : "Immich is not responding."),
      noKey ? hint("For names, quotas and photo counts, create an Immich API key (Account settings → API keys, with the ", h("code", {}, "server.statistics"), " and ", h("code", {}, "adminUser.read"), " permissions) and add it to ", h("code", {}, "/etc/serverdash/config.json"), ".")
        : (im.errors || []).length ? hint(im.errors.join(" · ")) : null));
  }
  // drives
  const io = S.disk_io || {};
  const sm = S.smart || {};
  blocks.push(card("Drives", sm._error ? sm._error : `Health checked ${fmtAgo(S.slow_at?.smart)}`, disks.map((d) => {
    const s = sm[d.name] || {};
    const health = s.passed === true ? chip("ok", "Healthy", true) : s.passed === false ? chip("critical", "Failing", true) : chip("unknown", "Unknown", true);
    const facts = [];
    if (s.temp != null) facts.push(["Temperature", fmtTemp(s.temp)]);
    if (s.power_on_hours != null) facts.push(["Powered on", `${fmtNum(s.power_on_hours)} h (${(s.power_on_hours / 8766).toFixed(1)} yr)`]);
    if (s.percentage_used != null) facts.push(["Wear", `${s.percentage_used}% of rated life`]);
    if (s.written_bytes != null) facts.push(["Written", fmtBytes(s.written_bytes)]);
    if (s.reallocated != null) facts.push(["Bad sectors", `${s.reallocated} reallocated · ${s.pending ?? 0} pending`]);
    const x = io[d.name];
    if (x) facts.push(["Activity now", `read ${fmtRate(x.read_bps)} · write ${fmtRate(x.write_bps)} · ${fmtPct(x.util)} busy`]);
    return h("div", { class: "mrow" },
      h("div", { class: "name" }, s.model || d.model || d.name, h("span", { class: "sub" }, `${d.name} · ${d.rotational ? "HDD" : "SSD"} · ${fmtBytes(d.size)}`)),
      h("div", { class: "val" }, health),
      h("dl", { class: "kv note", style: "margin-top:6px" }, facts.map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));
  })));
  $("#storage").replaceChildren(secHead("Storage"), h("div", { class: "grid g-2" }, blocks));
}
