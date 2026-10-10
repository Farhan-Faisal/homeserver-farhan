// People and devices: Tailscale peers, SSH, Samba, Jellyfin and Minecraft sessions.
import { h, $ } from "../dom.js";
import { absent, chip, card, secHead } from "../ui.js";
import { fmtBytes, fmtAgo } from "../format.js";

function peerFor(ip, peers) { return peers.find((p) => (p.ips || []).includes(ip)); }
function ipKind(ip) {
  if (!ip) return "unknown";
  if (/^(127\.|::1$|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return "this server";
  if (/^(192\.168\.|10\.)/.test(ip)) return "home network";
  if (/^100\./.test(ip) || ip.startsWith("fd7a:")) return "Tailscale";
  return "internet";
}
export function renderPeople(S) {
  const ts = S.tailscale, peers = ts?.peers || [];
  const conns = S.connections || [], ssh = S.logins || [], smb = S.samba || [], jf = S.jellyfin?.sessions || [];
  const me = ts?.self?.owner_login;
  const usage = new Map();
  const note = (ip, txt) => { if (!ip) return; const k = ip.replace(/:\d+$/, ""); usage.set(k, [...(usage.get(k) || []), txt]); };
  for (const c of conns) if (!["SSH", "Samba"].includes(c.service)) note(c.ip, c.count > 1 ? `${c.service} ×${c.count}` : c.service);
  for (const l of ssh) note(l.from, "SSH");
  for (const s of smb) note(s.ip, `Samba${s.shares?.length ? ` (${s.shares.join(", ")})` : ""}`);
  for (const j of jf) if (j.playing) note(j.ip, `Watching: ${j.playing}`);

  const rows = peers.map((p) => {
    const ips = p.ips || [];
    const using = [...new Set(ips.flatMap((ip) => usage.get(ip) || []))];
    return h("tr", {},
      h("td", {}, h("b", {}, p.host || p.dns || "device"), h("span", { class: "sub" }, `${p.os || ""}${ips[0] ? ` · ${ips[0]}` : ""}`)),
      h("td", {}, p.owner_login === me ? "You" : (p.owner_name || p.owner_login || "–"), h("span", { class: "sub" }, p.owner_login === me ? "" : p.owner_login || "")),
      h("td", { class: "nowrap" }, p.online ? chip("ok", "Online", true) : chip("unknown", `Seen ${fmtAgo(p.last_seen)}`, true)),
      h("td", {}, using.length ? h("div", { class: "badges" }, using.map((u) => h("span", { class: "badge" }, u))) : h("span", { class: "muted" }, "–")),
      h("td", { class: "nowrap" }, p.online ? (p.conn || "idle") : "–"),
      h("td", { class: "num" }, p.rx || p.tx ? `${fmtBytes(p.rx)} up · ${fmtBytes(p.tx)} down` : "–"));
  });
  const devCard = card("Tailscale devices", ts ? `${peers.filter((p) => p.online).length} online · tailnet ${ts.tailnet || ""}` : "Tailscale unavailable",
    peers.length ? h("div", { class: "scroll" }, h("table", {},
      h("thead", {}, h("tr", {}, h("th", {}, "Device"), h("th", {}, "Owner"), h("th", {}, "Status"), h("th", {}, "Using now"), h("th", {}, "Link"), h("th", { class: "num" }, "Traffic with server"))),
      h("tbody", {}, rows))) : h("div", { class: "empty" }, "No devices found."),
    h("div", { class: "small muted", style: "margin-top:8px" }, "“Using now” counts open connections. The Immich app keeps one open while it's in use. Data totals reset when Tailscale restarts."));

  const sshRows = ssh.map((l) => { const p = peerFor(l.from, peers); return h("div", { class: "mrow" },
    h("div", { class: "name" }, l.user, h("span", { class: "sub" }, `from ${p?.host || l.from || "console"}`)), h("div", { class: "val" }, `since ${l.since.slice(11)}`)); });
  const smbRows = smb.map((s) => { const p = peerFor(s.ip, peers); return h("div", { class: "mrow" },
    h("div", { class: "name" }, s.user, h("span", { class: "sub" }, `from ${p?.host || s.ip}`)), h("div", { class: "val" }, `${(s.shares || []).join(", ") || "–"} · ${s.dialect || ""}`)); });
  const jfRows = jf.map((j) => h("div", { class: "mrow" },
    h("div", { class: "name" }, j.user || "?", h("span", { class: "sub" }, `${j.device || ""} · ${j.client || ""}`)),
    h("div", { class: "val" }, j.playing ? `${j.paused ? "Paused" : "Playing"}: ${j.playing}` : `active ${fmtAgo(j.last_activity)}`)));
  const others = conns.filter((c) => !peerFor(c.ip, peers));
  const otherRows = others.map((c) => h("div", { class: "mrow" }, h("div", { class: "name" }, c.service, h("span", { class: "sub" }, `${ipKind(c.ip)} · ${c.ip}`)), h("div", { class: "val" }, `${c.count} connection${c.count > 1 ? "s" : ""}`)));
  const jfEmpty = !S.jellyfin?.ok ? "Jellyfin unreachable." : !("counts" in (S.jellyfin || {})) ? "Add a Jellyfin API key to see who is watching." : "Nobody watching.";
  const hasTs = !absent(S, "tailscale");
  const sess = [card("SSH logins", `${ssh.length}`, sshRows.length ? sshRows : h("div", { class: "empty" }, "Nobody logged in."))];
  if (!absent(S, "samba")) sess.push(card("Network drive", "Samba", smbRows.length ? smbRows : h("div", { class: "empty" }, "No connections.")));
  if (!absent(S, "jellyfin")) sess.push(card("Watching", "Jellyfin", jfRows.length ? jfRows : h("div", { class: "empty" }, jfEmpty)));
  const mc = S.minecraft;
  if (mc) sess.push(card("Playing Minecraft", mc.online != null ? `${mc.online} online` : null,
    mc.players?.length ? mc.players.map((p) => h("div", { class: "mrow" }, h("div", { class: "name" }, p), h("div", { class: "val" }, mc.tps != null ? `${mc.tps.toFixed(1)} TPS` : "")))
      : h("div", { class: "empty" }, mc.state === "running" ? (mc.ok ? "Nobody playing." : "Server starting…") : "Server stopped.")));
  if (otherRows.length) sess.push(hasTs ? card("Outside Tailscale", "connections from other networks", otherRows)
    : card("Connections", "open right now", otherRows));
  $("#people").replaceChildren(secHead("People and devices", hasTs ? `${peers.length} devices on your tailnet` : null),
    ...(hasTs ? [devCard] : []), h("div", { class: "grid", style: "margin-top:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr))" }, sess));
}
