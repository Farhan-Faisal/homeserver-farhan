"""NVIDIA GPU: load, VRAM, temperature, and which processes are using it.

Everything comes from nvidia-smi. With nvidia-persistenced running, each call
takes a few tens of milliseconds; without it the driver wakes up every time.
"""
import csv
import io
import os
import re
import shutil
import subprocess

FIELDS = ["name", "temperature.gpu", "utilization.gpu", "utilization.memory",
          "memory.used", "memory.total", "power.draw", "power.limit",
          "clocks.sm", "clocks.max.sm", "pstate", "driver_version", "compute_cap"]
MIB = 1024 ** 2


def smi(*args):
    """Run nvidia-smi and return its CSV output as a list of rows."""
    out = subprocess.run(["nvidia-smi", *args, "--format=csv,noheader,nounits"],
                         capture_output=True, text=True, timeout=10, check=True).stdout
    return [[v.strip() for v in row] for row in csv.reader(io.StringIO(out))]


def number(v):
    """'45' -> 45.0, and '[N/A]' or '[Not Supported]' -> None."""
    try:
        return float(v)
    except ValueError:
        return None


def container_of(pid):
    """Name of the Docker container a process runs in, or None if it isn't in one."""
    try:
        with open(f"/proc/{pid}/cgroup") as f:
            m = re.search(r"docker[-/]([0-9a-f]{64})", f.read())
    except OSError:
        return None  # the process exited in the meantime
    if not m:
        return None
    name = subprocess.run(["docker", "inspect", "--format", "{{.Name}}", m.group(1)],
                          capture_output=True, text=True, timeout=10).stdout
    return name.strip().lstrip("/") or m.group(1)[:12]


def gpu():
    if not shutil.which("nvidia-smi"):
        return None  # no NVIDIA driver installed

    gpus = []
    for row in smi("--query-gpu=" + ",".join(FIELDS)):
        d = dict(zip(FIELDS, row))
        gpus.append({
            "name": d["name"],
            "temp": number(d["temperature.gpu"]),
            "util": number(d["utilization.gpu"]),
            "mem_util": number(d["utilization.memory"]),
            "mem_used": number(d["memory.used"]) * MIB,
            "mem_total": number(d["memory.total"]) * MIB,
            "power_w": number(d["power.draw"]),
            "power_limit_w": number(d["power.limit"]),
            "clock_mhz": number(d["clocks.sm"]),
            "clock_max_mhz": number(d["clocks.max.sm"]),
            "pstate": d["pstate"],
            "driver": d["driver_version"],
            "compute_cap": d["compute_cap"],
        })

    processes = []
    for pid, name, mem in smi("--query-compute-apps=pid,process_name,used_memory"):
        processes.append({
            "pid": int(pid),
            "name": os.path.basename(name),
            "mem": number(mem) * MIB,
            "container": container_of(pid),
        })

    return {"gpus": gpus, "processes": processes}
