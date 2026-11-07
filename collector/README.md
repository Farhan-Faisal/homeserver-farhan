# serverdash collector

Measures the server every 10 seconds (hardware, drives, containers, services, who's connected and the apps) and saves it all to a SQLite database that the API reads.

Plain Python 3, standard library only: no pip packages. It reads `/proc` and `/sys` and calls the system's own tools (`sensors`, `nvidia-smi`, `docker`, `tailscale`, `smbstatus`, `smartctl`...).

## Folder structure

```
collector/
├── README.md
├── install.sh                  # installs or updates the collector and its systemd service
├── config.example.json         # every setting, with comments; copy to /etc/serverdash/config.json
├── __init__.py
├── __main__.py                 # the loop (python3 -m collector)
├── alerts.py
├── background.py
├── config.py
├── db.py
├── deploy/
│   ├── serverdash-collector            # the command the service runs: python3 -m collector
│   └── serverdash-collector.service    # systemd unit
├── probes/                     # one file per area; each returns plain dicts and lists
│   ├── system.py
│   ├── gpu.py
│   ├── sensors.py
│   ├── peak.py
│   ├── services.py
│   ├── storage.py
│   ├── network.py
│   ├── people.py
│   ├── apps.py
│   └── slow.py
└── utils/                      # small helpers
    ├── commands.py             # run a command and return its output
    ├── files.py                # read a file, or a number from one
    ├── http.py                 # GET a URL, or its JSON
    └── times.py                # ISO dates to Unix time
```

### What each file collects

| File | Collects | From | How often |
|---|---|---|---|
| `probes/system.py` | Hostname, OS, kernel, uptime, load, CPU model and cores, CPU %, memory, whether a restart is needed | `/proc`, `/etc/os-release` | every 10 s |
| `probes/gpu.py` | NVIDIA GPU load, VRAM, temperature, clocks, power, which processes (and containers) use it | `nvidia-smi` | every 10 s |
| `probes/sensors.py` | Every temperature sensor, fan speeds, battery charge and health, charger plugged in | `sensors` (lm-sensors), `/sys` | every 10 s |
| `probes/peak.py` | The hottest CPU reading since the last sample, so 1-second heat spikes aren't missed | `/sys/class/thermal` (CPU package sensor) | read every 1 s in the background, reported every 10 s |
| `probes/services.py` | Docker containers (state, health, restarts, CPU, memory, ports), systemd services (including ones that start on demand), failed units | `docker`, `systemctl` | every 10 s |
| `probes/storage.py` | Drives, volumes, their labels and how full they are, which drive each is on, the Immich volume file and its cap, live read/write speed | `/sys/block`, `/proc/mounts`, `/dev/disk/by-label`, `/proc/diskstats` | every 10 s |
| `probes/network.py` | Interfaces, IP addresses, Wi-Fi name and signal, upload and download speed | `/proc/net/dev`, `ip`, `iw` | every 10 s |
| `probes/people.py` | Tailscale devices and owners, who is connected to which service, SSH logins, Samba sessions and shares | `tailscale`, `ss`, `nsenter`, `who`, `smbstatus --brief` and `--shares` | every 10 s |
| `probes/apps.py` | Immich (up, version, photos and storage per person), Jellyfin (up, library, who's watching), Minecraft (players, TPS) | their HTTP APIs, Minecraft RCON | every 10 s |
| `probes/slow.py` | Drive health (SMART), folder sizes, pending updates | `smartctl`, `du`, `apt-check` | SMART and updates hourly, folders every 30 min |

| File | Job |
|---|---|
| `__main__.py` | The loop: run every probe, add the alerts, save the sample to the database |
| `background.py` | Runs the slow probes in their own thread so they never delay the 10-second loop |
| `alerts.py` | Turns the numbers into warnings and critical alerts (temperatures, disk space, services down, lag, power) |
| `db.py` | Writes to SQLite: the latest sample, chart history, 5-minute rollups and alert history; deletes old rows |
| `config.py` | Generic defaults, overridden by `/etc/serverdash/config.json` |

### The database

`/var/lib/serverdash/serverdash.db`, in WAL mode so the API can read while the collector writes. The collector is the only writer.

| Table | Holds | Kept for |
|---|---|---|
| `latest` | One row: the newest full sample as JSON | always replaced |
| `metrics` | One row per sample: CPU, memory, CPU and GPU temperature, GPU load, network speed | 30 days |
| `rollups` | 5-minute averages of `metrics`, plus the hottest CPU reading in each | 1 year |
| `events` | Each alert, with when it started and ended | 90 days after it ends |

## Development

Run from the repo root, so Python finds the `collector` package:

```bash
cd serverdash
sudo python3 -m collector --once      # one full sample as JSON, written nowhere
```

`sudo` is needed because `smbstatus`, `smartctl` and `nsenter` need root. It reads `/etc/serverdash/config.json` like the service does.

## Production

The collector runs as a root systemd service from `/opt/serverdash/lib/collector`. Settings are in `/etc/serverdash/config.json`. Start from `config.example.json`.

Install or update:

```bash
cd collector
sudo ./install.sh
```

Check it:

```bash
systemctl is-active serverdash-collector
journalctl -u serverdash-collector -n 30 --no-pager
curl -s http://127.0.0.1:8091/api/health        # age_seconds should stay under ~20
```

> While the old collector is still installed, this one runs alongside it as `serverdash-collector-next`, from `/opt/serverdash/lib-next/collector`. To update it:
> ```bash
> sudo rm -rf /opt/serverdash/lib-next/collector && sudo cp -r collector /opt/serverdash/lib-next/collector
> sudo systemctl restart serverdash-collector-next
> ```