# collector

A Python program that measures the server every 10 seconds and saves the result to a SQLite
database. Nothing else; the API reads the database and the web app shows it.
Python standard library only, so there is nothing to `pip install`.

## What's in here

| Path | What it does |
|---|---|
| `__main__.py` | The loop: run every probe, save the sample |
| `probes/` | One file per area (system, sensors, GPU, storage, network, services, people, apps) |
| `db.py` | Saves each sample to the database (tables below) |
| `alerts.py` | Turns a sample into a list of problems (saved as `events`) |
| `background.py` | Runs the slow probes (disk health, updates, folder sizes) in a separate thread |
| `config.py` | Built-in defaults, overridden by `/etc/serverdash/config.json` |
| `utils/` | Small helpers: reading files, running commands, HTTP, time |
| `deploy/` | The command and the systemd service that run it |
| `install.sh` | Installs or updates it on the server |

## The database

`/var/lib/serverdash/serverdash.db`, written only by the collector:

| Table | What | Kept |
|---|---|---|
| `latest` | One row: the newest full sample, as JSON | always |
| `metrics` | One row per sample: `cpu`, `mem`, `tcpu`, `tgpu`, `gpu`, `rx`, `tx` | 30 days |
| `rollups` | 5-minute averages of the same, plus `tcpu_max` (the hottest reading) | 1 year |
| `events` | Each alert, with `started` and `ended` (empty while it's still happening) | 90 days |

Times are Unix seconds. How long each is kept can be changed with `keep_days` in config.json.

## Run it

```bash
sudo bash collector/install.sh         # install or update on the server
sudo serverdash-collector --once       # print one sample (doesn't touch the database)
sqlite3 /var/lib/serverdash/serverdash.db "SELECT * FROM metrics ORDER BY t DESC LIMIT 5"
```

While developing, from the repo root: `python3 -m collector --once`.
