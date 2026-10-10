"""Who is using the server: Tailscale devices, open connections, SSH logins, Samba sessions."""
import json
import re
import shutil
from collections import Counter

from ..utils.commands import run
from ..utils.times import epoch


def tailscale():
    if not shutil.which("tailscale"):
        return None  # Tailscale not installed
    d = json.loads(run("tailscale", "status", "--json"))
    users = d.get("User") or {}

    def device(p):
        owner = users.get(str(p.get("UserID"))) or {}
        if p.get("CurAddr"):
            link = "direct"                    # talking straight to each other
        elif p.get("Relay"):
            link = f"relay ({p['Relay']})"     # going through a Tailscale relay server (slower)
        else:
            link = None                        # no traffic lately
        return {
            "host": p.get("HostName"),
            "dns": (p.get("DNSName") or "").split(".")[0] or None,
            "os": p.get("OS"),
            "ips": p.get("TailscaleIPs") or [],
            "online": bool(p.get("Online")),
            "last_seen": epoch(p.get("LastSeen")),
            "owner_login": owner.get("LoginName"),
            "owner_name": owner.get("DisplayName"),
            "conn": link,
            "rx": p.get("RxBytes"),
            "tx": p.get("TxBytes"),
        }

    peers = [device(p) for p in (d.get("Peer") or {}).values()]
    peers.sort(key=lambda p: (not p["online"], (p["owner_name"] or "").lower(), p["host"] or ""))
    return {
        "state": d.get("BackendState"),   # "Running" when remote access works
        "tailnet": (d.get("CurrentTailnet") or {}).get("Name"),
        "self": device(d.get("Self") or {}),
        "peers": peers,
    }


def established(pid=None):
    """[(local port, peer IP)] for every open TCP connection.

    With a pid, look inside that process's network namespace, i.e. inside its container.
    """
    cmd = ["ss", "-Htn", "state", "established"]
    if pid:
        cmd = ["nsenter", "-t", str(pid), "-n", *cmd]
    pairs = []
    for line in run(*cmd).splitlines():
        local, peer = line.split()[2:4]                # e.g. 172.18.0.5:2283  100.101.7.9:51022
        port = local.rsplit(":", 1)[1]
        ip = peer.rsplit(":", 1)[0].strip("[]").removeprefix("::ffff:")
        pairs.append((port, ip))
    return pairs


def app_containers(app_ports):
    """{pid: {container port: app name}} for running containers that publish one of app_ports."""
    ids = run("docker", "ps", "--quiet").split()
    if not ids:
        return {}
    result = {}
    for c in json.loads(run("docker", "inspect", *ids)):
        ports = {}
        for container_port, bindings in (c["NetworkSettings"]["Ports"] or {}).items():
            for b in bindings or []:
                if b["HostPort"] in app_ports:
                    ports[container_port.split("/")[0]] = app_ports[b["HostPort"]]
        if ports:
            result[c["State"]["Pid"]] = ports
    return result


def connections(cfg):
    host_ports = cfg["host_ports"]  # programs on the server itself (SSH, Samba)
    counts = Counter()              # (service, ip) -> number of open connections

    for port, ip in established():
        if port in host_ports:
            counts[(host_ports[port], ip)] += 1

    # Docker apps: their connections only exist inside the container's own network
    for pid, ports in app_containers(cfg["app_ports"]).items():
        for port, ip in established(pid):
            if port in ports:
                counts[(ports[port], ip)] += 1

    return [{"service": s, "ip": ip, "count": n} for (s, ip), n in sorted(counts.items())]


def logins():
    """Logged-in users, from `who`: 'farhan  pts/0  2026-10-10 09:12 (100.101.7.9)'."""
    result = []
    for line in run("who").splitlines():
        m = re.match(r"(\S+)\s+\S+\s+(\d{4}-\d\d-\d\d \d\d:\d\d)\s*(?:\((.*)\))?", line)
        if m:
            result.append({"user": m.group(1), "since": m.group(2), "from": m.group(3)})
    return result


def samba():
    if not shutil.which("smbstatus"):
        return None  # Samba not installed
    d = json.loads(run("smbstatus", "--json"))

    shares = {}  # ip -> {share names}, from the list of mounted shares ("tree connects")
    for t in (d.get("tcons") or {}).values():
        if t["service"] != "IPC$":  # IPC$ is Samba's internal share, not a folder
            shares.setdefault(t["machine"], set()).add(t["service"])

    return [{
        "user": s["username"],
        "ip": s["remote_machine"],
        "dialect": s.get("session_dialect"),
        "shares": sorted(shares.get(s["remote_machine"], [])),
    } for s in (d.get("sessions") or {}).values()]
