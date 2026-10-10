"""Turn one sample into a list of problems, worst first.

Each alert is {"level": "critical" | "warning" | "info", "area": "...", "text": "..."}.
The page shows them at the top; notify.py decides which ones reach your phone.
"""
import time

ORDER = {"critical": 0, "warning": 1, "info": 2}
SECTOR_PROBLEMS = {
    "reallocated": "reallocated sectors",
    "pending": "pending sectors",
    "uncorrectable": "unreadable sectors",
    "media_errors": "media errors",
}


def level(value, pair, lower_is_worse=False):
    """Compare a value to a [warning, critical] pair. Returns "critical", "warning" or None."""
    if value is None:
        return None
    warn, crit = pair
    if lower_is_worse:  # battery %, Minecraft TPS
        return "critical" if value <= crit else "warning" if value <= warn else None
    return "critical" if value >= crit else "warning" if value >= warn else None


def alerts(s, cfg):
    th = cfg["thresholds"]
    found = []

    def add(lvl, area, text):
        found.append({"level": lvl, "area": area, "text": text})

    # --- temperatures
    t = s.get("temps") or {}
    if lvl := level(t.get("cpu"), th["cpu_temp"]):
        add(lvl, "Temperature", f"CPU at {t['cpu']:.0f} °C")
    if lvl := level(t.get("nvme"), th["nvme_temp"]):
        add(lvl, "Temperature", f"SSD at {t['nvme']:.0f} °C")
    for g in (s.get("gpu") or {}).get("gpus", []):
        if lvl := level(g["temp"], th["gpu_temp"]):
            add(lvl, "Temperature", f"GPU at {g['temp']:.0f} °C")

    # --- drive health (SMART)
    hdds = {d["name"] for d in s.get("disks") or [] if d["rotational"]}
    for disk, sm in (s.get("smart") or {}).items():
        if sm["passed"] is False:
            add("critical", "Drive health", f"{disk}: SMART health check FAILED, back it up and replace it")
        for key, words in SECTOR_PROBLEMS.items():
            if sm.get(key):
                add("warning", "Drive health", f"{disk}: {sm[key]} {words}")
        if disk in hdds and (lvl := level(sm["temp"], th["hdd_temp"])):
            add(lvl, "Temperature", f"Hard drive at {sm['temp']} °C")

    # --- space
    for fs in s.get("filesystems") or []:
        if lvl := level(fs["pct"], th["disk_pct"]):
            add(lvl, "Storage", f"{fs['label'] or fs['mount']} is {fs['pct']:.0f}% full")
    for u in (s.get("immich") or {}).get("users", []):
        if u["quota"]:
            pct = 100 * u["usage"] / u["quota"]
            if lvl := level(pct, th["quota_pct"]):
                add(lvl, "Storage", f"{u['name']} is at {pct:.0f}% of their Immich quota")
    m = s.get("memory") or {}
    if lvl := level(m.get("pct"), th["mem_pct"]):
        add(lvl, "Memory", f"Memory {m['pct']:.0f}% used")

    # --- services
    for c in s.get("containers") or []:
        if c["state"] != "running":
            add("critical", "Services", f"Container {c['name']} is {c['state']}")
        elif c["health"] == "unhealthy":
            add("critical", "Services", f"Container {c['name']} is unhealthy")
        elif c["restarts"] and c["started_at"] and time.time() - c["started_at"] < 600:
            add("warning", "Services", f"Container {c['name']} restarted in the last 10 minutes")
    sysd = s.get("systemd") or {}
    for u in sysd.get("units", []):
        if u["active"] != "active" and u["unit"] in cfg["critical_units"]:
            add("critical", "Services", f"{u['unit']} is {u['active']}")
    for name in sysd.get("failed", []):
        add("warning", "Services", f"Failed unit: {name}")
    for key, name in (("immich", "Immich"), ("jellyfin", "Jellyfin")):
        app = s.get(key)
        if app and not app["ok"]:
            add("critical", "Services", f"{name} is not responding")
    mc = s.get("minecraft")
    if mc and mc["state"] == "running":
        if not mc["ok"]:
            add("warning", "Services", "Minecraft is running but not answering (still starting?)")
        elif lvl := level(mc["tps"], th["minecraft_tps"], lower_is_worse=True):
            add(lvl, "Services", f"Minecraft lagging: {mc['tps']:.1f} TPS")

    # --- remote access
    ts = s.get("tailscale")
    if "tailscale" in s.get("errors", {}):  # installed, but `tailscale status` failed
        add("critical", "Network", "Tailscale status unavailable")
    elif ts and ts["state"] != "Running":
        add("critical", "Network", f"Tailscale is {ts['state']}: remote access is down")

    # --- power (the battery is the server's UPS)
    p = s.get("power") or {}
    if p.get("ac_online") is False:
        add("warning", "Power", "Running on battery: charger unplugged or power cut")
        for b in p["batteries"]:
            if lvl := level(b["capacity"], th["battery_pct"], lower_is_worse=True):
                add(lvl, "Power", f"Battery at {b['capacity']:.0f}%")

    # --- maintenance notes
    if (s.get("host") or {}).get("reboot_required"):
        add("info", "System", "Reboot needed to finish installing updates")
    if (s.get("updates") or {}).get("security"):
        add("info", "System", f"{s['updates']['security']} security updates pending")

    found.sort(key=lambda a: ORDER[a["level"]])
    return found
