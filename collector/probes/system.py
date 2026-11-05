"""Host basics: identity, uptime, CPU and memory.

Everything here comes from files the Linux kernel exposes under /proc and /sys,
so it is fast and safe to run every 10 s.
"""
import os
import socket
import time


def host():
    with open("/proc/uptime") as f:
        uptime = float(f.read().split()[0])

    os_name = None
    with open("/etc/os-release") as f:
        for line in f:
            if line.startswith("PRETTY_NAME="):
                os_name = line.split("=", 1)[1].strip().strip('"')

    model, threads, mhz, cores = None, 0, [], set()
    with open("/proc/cpuinfo") as f:
        for line in f:
            if ":" not in line:
                continue
            key, value = [x.strip() for x in line.split(":", 1)]
            if key == "model name":
                model = value
            elif key == "processor":
                threads += 1
            elif key == "cpu MHz":
                mhz.append(float(value))
            elif key == "core id":
                cores.add(value)

    return {
        "hostname": socket.gethostname(),
        "os": os_name,
        "kernel": os.uname().release,
        "uptime": uptime,
        "boot_time": time.time() - uptime,
        "load": list(os.getloadavg()),
        "cpu_model": model,
        "cores": len(cores) or None,
        "threads": threads,
        "cpu_mhz": round(sum(mhz) / len(mhz)) if mhz else None,
        "reboot_required": os.path.exists("/var/run/reboot-required"),
    }


def memory():
    info = {}
    with open("/proc/meminfo") as f:
        for line in f:
            key, value = line.split(":")
            info[key] = int(value.split()[0]) * 1024  # kB -> bytes

    total, avail = info["MemTotal"], info["MemAvailable"]
    return {
        "total": total,
        "used": total - avail,
        "pct": round(100 * (total - avail) / total, 1),
        "swap_used": info["SwapTotal"] - info["SwapFree"],
    }


class Cpu:
    """CPU % = share of time that was not idle between two readings of /proc/stat."""

    def __init__(self):
        self.prev = None

    def read(self):
        with open("/proc/stat") as f:
            fields = [int(x) for x in f.readline().split()[1:9]]
        idle = fields[3] + fields[4]  # idle + iowait
        return sum(fields), idle

    def sample(self):
        total, idle = self.read()
        prev, self.prev = self.prev, (total, idle)
        if prev is None or total == prev[0]:
            return None  # first call: nothing to compare against yet
        busy = 1 - (idle - prev[1]) / (total - prev[0])
        return {"total": round(100 * busy, 1)}
