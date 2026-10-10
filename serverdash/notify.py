"""Phone alerts through ntfy (https://ntfy.sh), plus a heartbeat for healthchecks.io.

Rules, so your phone only buzzes when it matters:
- an alert must appear in `confirm_samples` samples in a row (~30 s) before it is sent
- it is sent once; critical ones are re-sent every `repeat_hours` while they last
- after it has been gone for `confirm_samples` samples, a "Resolved" message follows
"""
import re
import socket
import sys
import time

from .utils.http import get, post_json

LEVELS = {"info": 0, "warning": 1, "critical": 2}


def alert_key(a):
    """Same alert even when its numbers change: 'CPU at 83 °C' and 'CPU at 85 °C' share one key."""
    return a["area"] + "|" + re.sub(r"\d+(\.\d+)?", "#", a["text"])


class Notifier:
    def __init__(self, cfg):
        n = cfg["ntfy"]
        self.url, self.topic, self.token = n["url"], n["topic"], n["token"]
        self.min_level = LEVELS[n["min_level"]]
        self.confirm = n["confirm_samples"]
        self.repeat = n["repeat_hours"] * 3600
        self.notify_boot = n["notify_boot"]
        self.healthcheck_url = cfg["healthcheck_url"]
        self.pinged_at = 0
        self.host = socket.gethostname()
        self.tracked = {}  # alert key -> {"alert", "seen", "missing", "sent_at"}

    def send(self, title, message, priority=3, tags=()):
        if not self.topic:
            return False  # alerts are off
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        try:
            # JSON body, not HTTP headers: headers can't carry emoji or non-English text
            post_json(self.url, {"topic": self.topic, "title": title, "message": message,
                                 "priority": priority, "tags": list(tags)}, headers)
            return True
        except OSError as e:
            print(f"serverdash: ntfy send failed: {e}", file=sys.stderr)
            return False

    def test(self):
        if not self.topic:
            print("Set ntfy.topic in /etc/serverdash/config.json first.")
            return False
        ok = self.send(f"Test from {self.host}", "If you can read this on your phone, alerts work.",
                       tags=["tada"])
        print("sent" if ok else "failed (see the message above)")
        return ok

    def boot_check(self, uptime):
        if self.notify_boot and uptime < 600:
            self.send(f"{self.host} is back up",
                      f"The server started {int(uptime // 60)} min ago. "
                      "If you didn't reboot it, this was probably a power cut.",
                      tags=["arrows_counterclockwise"])

    def heartbeat(self):
        """Ping the healthcheck URL every minute. If the pings stop, *it* alerts you."""
        if self.healthcheck_url and time.time() - self.pinged_at >= 60:
            self.pinged_at = time.time()
            try:
                get(self.healthcheck_url, timeout=8)
            except OSError as e:
                print(f"serverdash: healthcheck ping failed: {e}", file=sys.stderr)

    def process(self, alerts):
        """Called once per sample with the current alert list."""
        self.heartbeat()
        now = time.time()
        current = {alert_key(a): a for a in alerts or [] if LEVELS[a["level"]] >= self.min_level}

        # alerts present now: count them, send once confirmed, repeat critical ones
        for key, a in current.items():
            t = self.tracked.setdefault(key, {"seen": 0, "missing": 0, "sent_at": None})
            t["alert"], t["missing"] = a, 0
            t["seen"] += 1
            critical = a["level"] == "critical"
            if t["sent_at"] is None and t["seen"] >= self.confirm:
                if self.send(f"{'🔴' if critical else '🟠'} {a['area']}: {self.host}", a["text"],
                             priority=5 if critical else 4,
                             tags=["rotating_light" if critical else "warning"]):
                    t["sent_at"] = now
            elif t["sent_at"] and critical and self.repeat and now - t["sent_at"] >= self.repeat:
                if self.send(f"🔴 Still: {a['area']} on {self.host}", a["text"],
                             priority=5, tags=["rotating_light"]):
                    t["sent_at"] = now

        # alerts that went away: forget them once confirmed gone, say "Resolved" if we had sent them
        for key in list(self.tracked):
            if key in current:
                continue
            t = self.tracked[key]
            t["missing"] += 1
            if t["missing"] >= self.confirm:
                if t["sent_at"]:
                    self.send(f"✅ Resolved on {self.host}", t["alert"]["text"],
                              priority=2, tags=["white_check_mark"])
                del self.tracked[key]
