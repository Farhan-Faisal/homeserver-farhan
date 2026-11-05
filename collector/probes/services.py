"""Docker containers and systemd services: what is running and what is broken."""
import json
import re
import time

from ..utils.commands import run
from ..utils.files import read
from ..utils.times import epoch

# docker stats prints sizes like "1.5GiB"; multipliers to turn them into bytes
SIZES = {"B": 1, "KIB": 1024, "MIB": 1024 ** 2, "GIB": 1024 ** 3, "TIB": 1024 ** 4,
         "KB": 1e3, "MB": 1e6, "GB": 1e9, "TB": 1e12}


def size(text):
    """'1.5GiB' -> 1610612736.0"""
    m = re.fullmatch(r"([\d.]+)\s*([a-zA-Z]+)", text.strip())
    return float(m.group(1)) * SIZES[m.group(2).upper()] if m else None


def containers():
    ids = run("docker", "ps", "--all", "--quiet", "--no-trunc").split()
    if not ids:
        return []
    details = json.loads(run("docker", "inspect", *ids))

    # live CPU and memory, running containers only (takes ~2 s: docker measures for a moment)
    usage = {}
    for line in run("docker", "stats", "--no-stream", "--format", "{{json .}}", timeout=30).splitlines():
        s = json.loads(line)
        try:
            usage[s["Name"]] = {"cpu": float(s["CPUPerc"].rstrip("%")),
                                "mem": size(s["MemUsage"].split("/")[0])}
        except ValueError:
            pass  # a container that is just starting shows "--"

    result = []
    for c in details:
        name = c["Name"].lstrip("/")
        state = c["State"]

        ports = []
        for container_port, bindings in (c["NetworkSettings"]["Ports"] or {}).items():
            for b in bindings or []:
                port = {"container": container_port, "host_port": b["HostPort"]}
                if port not in ports:  # Docker lists each port twice (IPv4 and IPv6)
                    ports.append(port)

        result.append({
            "name": name,
            "image": c["Config"]["Image"],
            "project": (c["Config"]["Labels"] or {}).get("com.docker.compose.project"),
            "state": state["Status"],                         # running, exited, restarting...
            "health": (state.get("Health") or {}).get("Status"),  # healthy, unhealthy, starting, or None
            "exit_code": state["ExitCode"],
            "restarts": c["RestartCount"],
            "started_at": epoch(state["StartedAt"]),
            "network_mode": c["HostConfig"]["NetworkMode"],
            "ports": ports,
            **usage.get(name, {}),                            # adds "cpu" and "mem" if running
        })

    result.sort(key=lambda c: (c["project"] or "~", c["name"]))
    return result


def systemd(cfg):
    props = "Id,Description,LoadState,ActiveState,SubState,ActiveEnterTimestampMonotonic,NRestarts"
    out = run("systemctl", "show", f"--property={props}", *[u + ".service" for u in cfg["units"]])

    boot = time.time() - float(read("/proc/uptime").split()[0])

    units = []
    for block in out.strip().split("\n\n"):  # one block of KEY=value lines per unit
        p = dict(line.split("=", 1) for line in block.splitlines())
        if p["LoadState"] != "loaded":
            continue  # not installed on this machine
        entered = int(p["ActiveEnterTimestampMonotonic"])  # µs after boot it last started
        units.append({
            "unit": p["Id"].removesuffix(".service"),
            "description": p["Description"],
            "active": p["ActiveState"],   # active, inactive, failed
            "sub": p["SubState"],         # running, exited, dead...
            "since": boot + entered / 1e6 if entered else None,
            "restarts": int(p["NRestarts"]),
        })

    # Some services start on demand: a .socket unit listens and starts the service when someone
    # connects (Ubuntu does this for ssh). Until then the service is "inactive" but working.
    idle = [u for u in units if u["active"] == "inactive"]
    if idle:
        out = run("systemctl", "show", "--property=Id,LoadState,ActiveState", *[u["unit"] + ".socket" for u in idle])
        listening = set()
        for block in out.strip().split("\n\n"):
            p = dict(line.split("=", 1) for line in block.splitlines())
            if p.get("LoadState") == "loaded" and p.get("ActiveState") == "active":
                listening.add(p["Id"].removesuffix(".socket"))
        for u in idle:
            u["on_demand"] = u["unit"] in listening

    # every failed unit on the system, not just the ones listed above
    failed = [line.split()[0] for line in
              run("systemctl", "--failed", "--no-legend", "--plain").splitlines() if line.strip()]

    return {"units": units, "failed": failed}
