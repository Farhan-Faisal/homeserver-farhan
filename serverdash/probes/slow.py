"""Slow probes: drive health, folder sizes, pending updates.

Each one takes seconds to minutes, so none of them may run in the 10-second
loop. A background thread runs them on their own schedule (built next).
"""
import json
import os
import subprocess

from .storage import physical_disks


def smart():
    """Health of every drive, from the drive's own self-monitoring (SMART)."""
    result = {}
    for disk in physical_disks():
        # --nocheck=standby: if the HDD has spun down, skip it instead of waking it up
        out = subprocess.run(["smartctl", "--json", "--info", "--health", "--attributes",
                              "--nocheck=standby", f"/dev/{disk}"],
                             capture_output=True, text=True, timeout=60).stdout
        d = json.loads(out)
        if "smart_status" not in d:
            continue  # asleep, or a USB adapter that doesn't pass SMART through

        info = {
            "model": d.get("model_name"),
            "passed": d["smart_status"]["passed"],               # the drive's own verdict
            "temp": (d.get("temperature") or {}).get("current"),
            "power_on_hours": (d.get("power_on_time") or {}).get("hours"),
        }

        # HDDs and SATA SSDs report numbered attributes
        attrs = {a["id"]: a["raw"]["value"] for a in (d.get("ata_smart_attributes") or {}).get("table", [])}
        info["reallocated"] = attrs.get(5)      # bad sectors already swapped for spares
        info["pending"] = attrs.get(197)        # unstable sectors waiting to be swapped
        info["uncorrectable"] = attrs.get(198)  # sectors that could not be read at all

        # NVMe SSDs report a health log instead
        nvme = d.get("nvme_smart_health_information_log")
        if nvme:
            info["percentage_used"] = nvme["percentage_used"]               # wear, % of rated life
            info["media_errors"] = nvme["media_errors"]
            info["written_bytes"] = nvme["data_units_written"] * 512_000    # 1 unit = 1000 x 512 bytes

        result[disk] = info
    return result


def du(path):
    """Total size of a folder in bytes (None if it doesn't exist)."""
    if not os.path.isdir(path):
        return None
    # -s: total only   -x: don't cross into other drives mounted inside   -B1: count in bytes
    out = subprocess.run(["du", "-s", "-x", "-B1", path],
                         capture_output=True, text=True, timeout=1800).stdout
    return int(out.split()[0])


def folders(cfg):
    return {"folders": [{"path": p, "bytes": du(p)} for p in cfg["folders"]]}


def updates():
    # Ubuntu's own update counter (the one behind the login message); prints "12;3" to stderr
    err = subprocess.run(["/usr/lib/update-notifier/apt-check"],
                         capture_output=True, text=True, timeout=120).stderr
    total, security = err.strip().split(";")[:2]
    return {"total": int(total), "security": int(security)}
