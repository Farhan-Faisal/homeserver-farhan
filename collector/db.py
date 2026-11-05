"""Where every sample goes: one SQLite database, which the API reads.

    latest   one row: the newest full sample as JSON (what the page shows right now)
    metrics  one row per sample: the few numbers the charts need     (kept 30 days)
    rollups  5-minute averages of metrics, plus the hottest CPU reading (kept a year)
    events   each alert, with when it started and when it ended      (kept 90 days)

The collector is the only program that writes here.
"""
import json
import os
import sqlite3
import time

from .alerts import alert_key

BUCKET = 300  # seconds in one rollup (5 minutes)
DAY = 86400
COLUMNS = ("cpu", "mem", "tcpu", "tgpu", "gpu", "rx", "tx")

SCHEMA = """
CREATE TABLE IF NOT EXISTS latest (
    id   INTEGER PRIMARY KEY CHECK (id = 1),  -- only ever one row
    t    INTEGER NOT NULL,                    -- when it was measured (Unix time, seconds)
    data TEXT    NOT NULL                     -- the whole sample, as JSON
);
CREATE TABLE IF NOT EXISTS metrics (
    t    INTEGER PRIMARY KEY,
    cpu  REAL, mem REAL, tcpu REAL, tgpu REAL, gpu REAL, rx REAL, tx REAL
);
CREATE TABLE IF NOT EXISTS rollups (
    t    INTEGER PRIMARY KEY,                 -- start of the 5 minutes
    cpu  REAL, mem REAL, tcpu REAL, tgpu REAL, gpu REAL, rx REAL, tx REAL,
    tcpu_max REAL                             -- an average hides heat spikes, so keep the peak too
);
CREATE TABLE IF NOT EXISTS events (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    key     TEXT    NOT NULL,                 -- the same alert while its numbers change
    level   TEXT    NOT NULL,                 -- critical, warning or info
    area    TEXT    NOT NULL,                 -- Temperature, Storage, Services...
    text    TEXT    NOT NULL,                 -- latest wording, e.g. "CPU at 85 °C"
    started INTEGER NOT NULL,
    ended   INTEGER                           -- empty while it is still happening
);
CREATE INDEX IF NOT EXISTS events_by_end ON events (ended);
"""


def point(s):
    """The few numbers the charts need, picked out of a full sample."""
    gpu = ((s.get("gpu") or {}).get("gpus") or [{}])[0]
    nets = [i for i in s.get("network") or [] if not i["name"].startswith("tailscale")]
    return {
        "t": round(s["generated_at"]),
        "cpu": (s.get("cpu") or {}).get("total"),
        "mem": (s.get("memory") or {}).get("pct"),
        "tcpu": hottest((s.get("temps") or {}).get("cpu"), s.get("cpu_peak")),  # catch 1-second spikes
        "tgpu": gpu.get("temp"),
        "gpu": gpu.get("util"),
        "rx": round(sum(i["rx_bps"] or 0 for i in nets)),  # tailscale0 left out: that traffic
        "tx": round(sum(i["tx_bps"] or 0 for i in nets)),  # also crosses Wi-Fi, so it'd count twice
    }


def hottest(*values):
    known = [v for v in values if v is not None]
    return max(known) if known else None


class Database:
    def __init__(self, cfg):
        path = cfg["database"]
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.keep = cfg["keep_days"]
        self.db = sqlite3.connect(path)
        self.db.execute("PRAGMA journal_mode=WAL")    # the API can read while we write
        self.db.execute("PRAGMA synchronous=NORMAL")  # safe with WAL, and far fewer disk flushes
        self.db.executescript(SCHEMA)
        os.chmod(path, 0o644)  # the API runs as another user and only reads
        self.pruned_at = 0

    def write(self, sample):
        p = point(sample)
        with self.db:  # one transaction: everything from this sample is saved, or nothing is
            self.db.execute("INSERT OR REPLACE INTO latest (id, t, data) VALUES (1, ?, ?)",
                            (p["t"], json.dumps(sample, separators=(",", ":"))))
            self.db.execute(f"INSERT OR REPLACE INTO metrics (t, {', '.join(COLUMNS)}) "
                            f"VALUES (?{', ?' * len(COLUMNS)})",
                            [p["t"]] + [p[c] for c in COLUMNS])
            self.roll_up(p["t"])
            self.track_events(sample.get("alerts"), p["t"])
        if time.time() - self.pruned_at > 3600:
            self.prune()

    def roll_up(self, t):
        """Recompute the 5 minutes this sample falls in, from its rows in metrics.
        Done on every sample, so the current 5 minutes is always up to date."""
        start = t // BUCKET * BUCKET
        averages = ", ".join(f"ROUND(AVG({c}), 1)" for c in COLUMNS)
        self.db.execute(f"INSERT OR REPLACE INTO rollups (t, {', '.join(COLUMNS)}, tcpu_max) "
                        f"SELECT ?, {averages}, MAX(tcpu) FROM metrics WHERE t >= ? AND t < ?",
                        (start, start, start + BUCKET))

    def track_events(self, alerts, t):
        """Open an event when an alert appears, update it while it lasts, close it when it's gone."""
        if alerts is None:
            return  # the alert check itself failed this time: leave events as they are
        current = {alert_key(a): a for a in alerts}
        still_open = dict(self.db.execute("SELECT key, id FROM events WHERE ended IS NULL"))
        for key, a in current.items():
            if key in still_open:
                self.db.execute("UPDATE events SET level = ?, text = ? WHERE id = ?",
                                (a["level"], a["text"], still_open[key]))
            else:
                self.db.execute("INSERT INTO events (key, level, area, text, started) VALUES (?, ?, ?, ?, ?)",
                                (key, a["level"], a["area"], a["text"], t))
        for key, event_id in still_open.items():
            if key not in current:
                self.db.execute("UPDATE events SET ended = ? WHERE id = ?", (t, event_id))

    def prune(self):
        """Delete rows older than keep_days, once an hour."""
        now = time.time()
        with self.db:
            self.db.execute("DELETE FROM metrics WHERE t < ?", (now - self.keep["metrics"] * DAY,))
            self.db.execute("DELETE FROM rollups WHERE t < ?", (now - self.keep["rollups"] * DAY,))
            self.db.execute("DELETE FROM events WHERE ended < ?", (now - self.keep["events"] * DAY,))
        self.pruned_at = now

    def close(self):
        self.db.close()
