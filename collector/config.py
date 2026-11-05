"""Settings: built-in defaults, overridden by /etc/serverdash/config.json.

The defaults here are generic: every app is off and nothing assumes a disk layout.
Everything specific to one server (its apps, folders, labels) and every secret
(API keys) goes in the JSON file, which only needs the keys you change.
"""
import json
import os

PATH = os.environ.get("SERVERDASH_CONFIG", "/etc/serverdash/config.json")

DEFAULTS = {
    # __main__.py: the loop
    "interval_seconds": 10,
    # db.py: where samples are saved, and how many days of each kind to keep
    "database": "/var/lib/serverdash/serverdash.db",
    "keep_days": {"metrics": 30, "rollups": 365, "events": 90},
    # background.py: seconds between runs of each slow probe
    "slow_every": {"smart": 3600, "updates": 3600, "folders": 1800},

    # storage.py: friendly names for mount points
    "mount_labels": {"/": "System", "/boot/efi": "Boot partition"},
    # services.py: systemd services to show (ones that aren't installed are skipped)
    "units": ["ssh", "tailscaled", "docker", "containerd", "smbd",
              "nvidia-persistenced", "unattended-upgrades", "cron", "serverdash-collector"],
    # people.py: ports to watch for connections
    "host_ports": {"22": "SSH", "445": "Samba"},
    "app_ports": {"2283": "Immich", "8096": "Jellyfin"},
    # slow.py: folders to measure for the hard-drive bar (paths with "/media" count as media)
    "folders": [],
    # apps.py: an empty url or container name means "not installed here"
    "immich": {"url": "", "api_key": ""},
    "jellyfin": {"url": "", "api_key": ""},
    "minecraft_container": "",

    # the web page: copied into every sample, for the page to use
    "page": {
        "data_mount": "",       # the big data drive, for the hard-drive bar ("" = first HDD found)
        "samba_share": "",      # shown as smb://<host>/<share> ("" = don't show an address)
        "ports": {"immich": 2283, "jellyfin": 8096, "minecraft": 25565},  # for the "Open" links
        "access": {},           # "Who can reach it" note per app, e.g. {"immich": "Family, via Tailscale"}
    },

    # alerts.py: [warning, critical]
    "thresholds": {
        "cpu_temp": [80, 90],
        "gpu_temp": [80, 87],
        "nvme_temp": [65, 75],
        "hdd_temp": [50, 55],
        "disk_pct": [85, 95],
        "quota_pct": [85, 95],
        "mem_pct": [90, 95],
        "battery_pct": [30, 15],    # lower is worse
        "minecraft_tps": [18, 15],  # lower is worse
    },
    "critical_units": ["ssh", "tailscaled", "docker", "smbd"],  # down = critical alert

}


def merge(base, override):
    """Copy of base with override's values on top. Nested dicts are merged key by key."""
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge(result[key], value)
        else:
            result[key] = value
    return result


def load(path=PATH):
    try:
        with open(path) as f:
            user = json.load(f)
    except FileNotFoundError:
        user = {}  # no file: run on defaults
    return merge(DEFAULTS, user)
