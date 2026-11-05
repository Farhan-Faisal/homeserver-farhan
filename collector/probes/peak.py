"""Highest CPU temperature between two samples.

Heat spikes can last about a second, so a reading every 10 s mostly misses them.
A background thread reads the CPU sensor every second and keeps the highest value
since the collector last asked.
"""
import glob
import threading
import time

from ..utils.files import read


def sensor_file():
    """The kernel file holding the whole-CPU temperature, in thousandths of a degree."""
    for zone in glob.glob("/sys/class/thermal/thermal_zone*"):
        if read(f"{zone}/type") == "x86_pkg_temp":          # Intel: the package sensor
            return f"{zone}/temp"
    for hw in glob.glob("/sys/class/hwmon/hwmon*"):
        if read(f"{hw}/name") in ("coretemp", "k10temp"):   # otherwise sensor 1 of the CPU driver
            return f"{hw}/temp1_input"
    return None


class PeakTemp:
    def __init__(self):
        self.path = sensor_file()
        self.peak = None
        self.lock = threading.Lock()

    def start(self):
        if self.path:  # no sensor (e.g. a VM): the probe just reports None
            threading.Thread(target=self.loop, daemon=True).start()

    def loop(self):
        while True:
            value = read(self.path)
            if value:
                t = int(value) / 1000
                with self.lock:
                    self.peak = t if self.peak is None else max(self.peak, t)
            time.sleep(1)

    def sample(self):
        """Highest reading since the last call, then start over."""
        with self.lock:
            peak, self.peak = self.peak, None
        return peak
