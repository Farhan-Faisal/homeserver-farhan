"""serverdash collector: every few seconds, measure the server and save it to the database.

    serverdash-collector                 run forever (what the systemd service does)
    serverdash-collector --once          print one full sample and exit
"""
import json
import signal
import sys
import time

from . import config
from .alerts import alerts
from .background import Background
from .db import Database
from .probes import apps, gpu, network, peak, people, sensors, services, slow, storage, system


def make_probes(cfg):
    """The registry: key in each sample -> function that produces it. Runs top to bottom."""
    cpu, disk_io, net = system.Cpu(), storage.DiskIO(), network.Network()
    cpu_peak = peak.PeakTemp()
    cpu_peak.start()  # reads the CPU temperature every second in the background
    probes = {
        "host": system.host,
        "cpu": cpu.sample,
        "memory": system.memory,
        "temps": sensors.temps,
        "cpu_peak": cpu_peak.sample,  # highest CPU temperature since the last sample
        "power": sensors.power,
        "gpu": gpu.gpu,
        "containers": services.containers,
        "systemd": lambda: services.systemd(cfg),
        "disks": storage.disks,
        "filesystems": lambda: storage.filesystems(cfg),
        "disk_io": disk_io.sample,
        "network": net.sample,
        "tailscale": people.tailscale,
        "connections": lambda: people.connections(cfg),
        "logins": people.logins,
        "samba": people.samba,
        "immich": lambda: apps.immich(cfg),
        "jellyfin": lambda: apps.jellyfin(cfg),
        "minecraft": lambda: apps.minecraft(cfg),
    }
    for counter in (cpu, disk_io, net):  # first readings, so the next ones can compute % and speeds
        counter.sample()
    return probes


def slow_jobs(cfg):
    every = cfg["slow_every"]
    return {
        "smart": (every["smart"], slow.smart),
        "updates": (every["updates"], slow.updates),
        "folders": (every["folders"], lambda: slow.folders(cfg)),
    }


def collect(probes, background, cfg):
    started = time.time()
    sample = {"generated_at": started, "interval": cfg["interval_seconds"], "errors": {},
              "thresholds": cfg["thresholds"], "critical_units": cfg["critical_units"],
              "page": cfg["page"]}  # settings for the web page

    results, ran_at, errors = background.latest()  # slow probes: whatever they last produced
    sample.update(results)
    sample["slow_at"] = ran_at
    sample["errors"].update(errors)

    for key, fn in probes.items():
        try:
            sample[key] = fn()
        except Exception as e:  # one broken probe never stops the others
            sample[key] = None
            sample["errors"][key] = f"{type(e).__name__}: {e}"

    try:
        sample["alerts"] = alerts(sample, cfg)
    except Exception as e:
        sample["alerts"] = None
        sample["errors"]["alerts"] = f"{type(e).__name__}: {e}"

    sample["collect_ms"] = round((time.time() - started) * 1000)
    return sample


def main():
    cfg = config.load()

    probes = make_probes(cfg)
    background = Background(slow_jobs(cfg))
    time.sleep(1)

    if "--once" in sys.argv:
        background.run_due()  # run the slow probes right here, so the output is complete
        print(json.dumps(collect(probes, background, cfg), indent=2))
        return

    background.start()
    database = Database(cfg)

    def stop(*_):
        database.close()
        sys.exit(0)

    signal.signal(signal.SIGTERM, stop)  # systemctl stop / restart
    signal.signal(signal.SIGINT, stop)   # Ctrl+C

    while True:
        started = time.time()
        try:
            sample = collect(probes, background, cfg)
            database.write(sample)
        except Exception as e:  # never die; the message lands in journalctl
            print(f"serverdash: cycle failed: {type(e).__name__}: {e}", file=sys.stderr)
        time.sleep(max(1, cfg["interval_seconds"] - (time.time() - started)))


if __name__ == "__main__":
    main()
