"""Network interfaces: addresses, Wi-Fi, and live upload/download speed."""
import json
import os
import re
import subprocess
import time

from ..utils.files import read

# virtual interfaces made by the kernel and Docker; not interesting on the page
SKIP = ("lo", "docker", "br-", "veth", "virbr")


def addresses():
    """{interface: [IPs]} from `ip -j addr`, global addresses only (no 127.x or fe80::)."""
    out = subprocess.run(["ip", "-j", "addr", "show"],
                         capture_output=True, text=True, timeout=10, check=True).stdout
    return {i["ifname"]: [a["local"] for a in i.get("addr_info", []) if a.get("scope") == "global"]
            for i in json.loads(out)}


def wifi(name):
    """Network name, signal strength and link speed of a Wi-Fi interface, from `iw`."""
    out = subprocess.run(["iw", "dev", name, "link"], capture_output=True, text=True, timeout=10).stdout
    ssid = re.search(r"SSID: (.+)", out)
    signal = re.search(r"signal: (-?\d+) dBm", out)
    rate = re.search(r"tx bitrate: ([\d.]+) MBit", out)
    return {
        "ssid": ssid.group(1).strip() if ssid else None,
        "signal_dbm": int(signal.group(1)) if signal else None,
        "bitrate_mbps": float(rate.group(1)) if rate else None,
    }


class Network:
    """Per-interface details, plus speeds from two readings of /proc/net/dev."""

    def __init__(self):
        self.prev = None

    def counters(self):
        """{interface: (bytes received, bytes sent)} since boot."""
        totals = {}
        with open("/proc/net/dev") as f:
            for line in f.readlines()[2:]:  # the first two lines are column headers
                name, data = line.split(":", 1)
                name = name.strip()
                if not name.startswith(SKIP):
                    x = data.split()
                    totals[name] = (int(x[0]), int(x[8]))
        return time.monotonic(), totals

    def sample(self):
        now, totals = self.counters()
        prev, self.prev = self.prev, (now, totals)
        ips = addresses()

        result = []
        for name, (rx, tx) in totals.items():
            iface = {
                "name": name,
                "up": read(f"/sys/class/net/{name}/operstate") in ("up", "unknown"),
                "addrs": ips.get(name, []),
                "wireless": os.path.isdir(f"/sys/class/net/{name}/wireless"),
                "rx_bps": None,
                "tx_bps": None,
            }
            if prev and name in prev[1]:
                seconds = now - prev[0]
                rx0, tx0 = prev[1][name]
                iface["rx_bps"] = max(0, rx - rx0) / seconds  # max(0): counters reset if the
                iface["tx_bps"] = max(0, tx - tx0) / seconds  # interface is recreated
            if iface["wireless"]:
                iface.update(wifi(name))
            result.append(iface)

        return result
