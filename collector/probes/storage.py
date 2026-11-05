"""Drives, volumes and live disk activity. All from /proc and /sys, so fast.

(SMART health and folder sizes are slow; they come later, in the background thread.)
"""
import glob
import os
import time

from ..utils.files import read

SECTOR = 512  # /sys and /proc count disk sizes in 512-byte sectors, whatever the real drive uses


def physical_disks():
    """Real drives (nvme0n1, sda...), skipping loop devices, RAM disks and CD drives."""
    names = []
    for path in sorted(glob.glob("/sys/block/*")):
        name = os.path.basename(path)
        if os.path.exists(f"{path}/device") and not name.startswith("sr"):
            names.append(name)
    return names


def parent_disk(name):
    """nvme0n1p2 -> nvme0n1, sda1 -> sda. A whole disk returns itself."""
    path = os.path.realpath(f"/sys/class/block/{name}")
    if os.path.exists(f"{path}/partition"):
        return os.path.basename(os.path.dirname(path))
    return name


def disks():
    result = []
    for name in physical_disks():
        base = f"/sys/block/{name}"
        result.append({
            "name": name,
            "model": read(f"{base}/device/model"),
            "rotational": read(f"{base}/queue/rotational") == "1",  # 1 = spinning HDD
            "size": int(read(f"{base}/size")) * SECTOR,
        })
    return result


def fs_label(device):
    """The name a partition was given when formatted (mkfs -L), e.g. "SSD-Backup-512".
    udev keeps a link per label in /dev/disk/by-label; find the one pointing at this device."""
    target = os.path.realpath(device)
    for link in glob.glob("/dev/disk/by-label/*"):
        if os.path.realpath(link) == target:
            return os.path.basename(link).replace("\\x20", " ")  # spaces are written as \x20
    return None


def filesystems(cfg):
    result, seen = [], set()

    with open("/proc/mounts") as f:
        for line in f:
            device, mount, fstype = line.split()[:3]
            mount = mount.replace("\\040", " ")  # spaces in paths are written as \040
            if not device.startswith("/dev/") or fstype == "squashfs" or mount in seen:
                continue  # skip virtual mounts (proc, tmpfs, docker), snaps, and repeats
            seen.add(mount)

            try:
                st = os.statvfs(mount)
            except OSError:
                continue
            total = st.f_blocks * st.f_frsize
            used = (st.f_blocks - st.f_bfree) * st.f_frsize
            avail = st.f_bavail * st.f_frsize  # free space normal users can actually use

            fs = {
                "device": device,
                "mount": mount,
                "label": cfg["mount_labels"].get(mount) or fs_label(device),  # your name wins
                "total": total,
                "used": used,
                "avail": avail,
                "pct": round(100 * used / (used + avail), 1) if used + avail else None,
            }

            name = os.path.basename(os.path.realpath(device))
            if name.startswith("loop"):
                # a volume that lives inside a file, like the Immich quota image
                backing = read(f"/sys/block/{name}/loop/backing_file")
                if backing:
                    bst = os.stat(backing)
                    fs["backing_file"] = backing
                    fs["backing_size"] = bst.st_size                # the cap, e.g. 400 GB
                    fs["backing_allocated"] = bst.st_blocks * 512   # what it really takes on the HDD
            else:
                fs["disk"] = parent_disk(name)

            result.append(fs)

    return result


class DiskIO:
    """Read/write speed and % busy per drive, from two readings of /proc/diskstats."""

    def __init__(self):
        self.prev = None

    def read(self):
        names = set(physical_disks())
        counters = {}
        with open("/proc/diskstats") as f:
            for line in f:
                x = line.split()
                if x[2] in names:
                    # sectors read, sectors written, milliseconds spent doing I/O
                    counters[x[2]] = (int(x[5]) * SECTOR, int(x[9]) * SECTOR, int(x[12]))
        return time.monotonic(), counters

    def sample(self):
        now, counters = self.read()
        prev, self.prev = self.prev, (now, counters)
        if prev is None:
            return None  # first call: nothing to compare against yet

        seconds = now - prev[0]
        result = {}
        for name, (rd, wr, busy) in counters.items():
            if name not in prev[1]:
                continue  # drive was just plugged in
            rd0, wr0, busy0 = prev[1][name]
            result[name] = {
                "read_bps": (rd - rd0) / seconds,
                "write_bps": (wr - wr0) / seconds,
                "util": round(min(100, (busy - busy0) / seconds / 10), 1),  # ms busy per s -> %
            }
        return result
