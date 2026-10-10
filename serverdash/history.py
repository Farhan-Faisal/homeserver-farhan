"""Chart data: the last hour at full detail, and the last 24 hours as 5-minute averages.

Saved to disk every 5 minutes (and on shutdown) so a restart doesn't blank the charts.
"""
import json
import time
from collections import deque

from .utils.files import write_json

KEYS = ("cpu", "mem", "tcpu", "tgpu", "gpu", "rx", "tx")
BUCKET = 300  # seconds per 24-hour point (5 minutes)


def point(s):
    """The few numbers the charts need, picked out of a full sample."""
    gpu = ((s.get("gpu") or {}).get("gpus") or [{}])[0]
    nets = [i for i in s.get("network") or [] if not i["name"].startswith("tailscale")]
    return {
        "t": round(s["generated_at"]),
        "cpu": (s.get("cpu") or {}).get("total"),
        "mem": (s.get("memory") or {}).get("pct"),
        "tcpu": (s.get("temps") or {}).get("cpu"),
        "tgpu": gpu.get("temp"),
        "gpu": gpu.get("util"),
        "rx": round(sum(i["rx_bps"] or 0 for i in nets)),  # tailscale0 left out: that traffic
        "tx": round(sum(i["tx_bps"] or 0 for i in nets)),  # also crosses Wi-Fi, so it'd count twice
    }


def average(points, t):
    avg = {"t": t}
    for key in KEYS:
        values = [p[key] for p in points if p[key] is not None]
        avg[key] = round(sum(values) / len(values), 1) if values else None
    return avg


class History:
    def __init__(self, cfg):
        self.path = cfg["history_file"]
        self.short = deque(maxlen=3600 // cfg["interval_seconds"])  # 1 hour of samples (360)
        self.long = deque(maxlen=86400 // BUCKET)                   # 24 h of 5-min averages (288)
        self.bucket, self.bucket_start = [], None                   # samples in the current 5 minutes
        self.saved_at = time.time()
        self.load()

    def load(self):
        try:
            with open(self.path) as f:
                saved = json.load(f)
        except (OSError, ValueError):
            return  # first run, or a damaged file: start empty
        now = time.time()
        self.short.extend(p for p in saved.get("short", []) if p["t"] > now - 3600)
        self.long.extend(p for p in saved.get("long", []) if p["t"] > now - 86400)

    def add(self, sample):
        p = point(sample)
        self.short.append(p)
        start = p["t"] // BUCKET * BUCKET  # start of the 5-minute slot this sample is in
        if self.bucket and start != self.bucket_start:  # previous slot is complete: average it
            self.long.append(average(self.bucket, self.bucket_start + BUCKET // 2))
            self.bucket = []
        self.bucket_start = start
        self.bucket.append(p)
        if time.time() - self.saved_at > 300:
            self.save()

    def save(self):
        write_json(self.path, self.export())
        self.saved_at = time.time()

    def export(self):
        return {"short": list(self.short), "long": list(self.long)}
