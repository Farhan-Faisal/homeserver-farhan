"""Temperatures and fans (from lm-sensors), battery and charger (from /sys)."""
import glob
import json
import subprocess

# `sensors` names chips like "coretemp-isa-0000"; map the prefix to a readable group
GROUPS = {
    "coretemp": "CPU",          # Intel
    "k10temp": "CPU",           # AMD
    "nvme": "NVMe SSD",
    "acpitz": "Motherboard",
    "pch_": "Chipset",
    "iwlwifi": "Wi-Fi card",
    "acer": "Laptop EC",
}
POWER_DIR = "/sys/class/power_supply"


def group_of(chip):
    for prefix, name in GROUPS.items():
        if chip.startswith(prefix):
            return name
    return chip.split("-")[0]


def reading(values, prefix, *suffixes):
    """From {"temp1_input": 52.0, "temp1_crit": 100.0}, pick e.g. ("temp", "_input") -> 52.0."""
    for key, value in values.items():
        if key.startswith(prefix) and key.endswith(suffixes):
            return value
    return None


def temps():
    out = subprocess.run(["sensors", "-j"], capture_output=True, text=True, timeout=10).stdout
    sensors, fans = [], []

    for chip, features in json.loads(out).items():
        for label, values in features.items():
            if not isinstance(values, dict):
                continue  # e.g. "Adapter": "ISA adapter"

            temp = reading(values, "temp", "_input")
            if temp is not None and 0 < temp < 150:  # ignore broken sensors (-273, 255...)
                sensors.append({
                    "group": group_of(chip),
                    "label": label,
                    "temp": round(temp, 1),
                    "high": reading(values, "temp", "_max", "_high"),
                    "crit": reading(values, "temp", "_crit"),
                })

            rpm = reading(values, "fan", "_input")
            if rpm is not None:
                fans.append({"label": label, "rpm": rpm})

    # the two headline numbers the page shows on the Overview tile
    cpu = next((s["temp"] for s in sensors
                if s["group"] == "CPU" and s["label"].startswith(("Package", "Tctl"))), None)
    if cpu is None:
        cpu = max((s["temp"] for s in sensors if s["group"] == "CPU"), default=None)
    nvme = next((s["temp"] for s in sensors if s["label"] == "Composite"), None)

    return {"cpu": cpu, "nvme": nvme, "sensors": sensors, "fans": fans}


def read(path):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return None  # file doesn't exist on this machine


def num(path):
    value = read(path)
    return float(value) if value else None


def power():
    result = {"ac_online": None, "batteries": []}

    for dev in sorted(glob.glob(f"{POWER_DIR}/*")):
        kind = read(f"{dev}/type")

        if kind == "Mains":
            result["ac_online"] = read(f"{dev}/online") == "1"

        elif kind == "Battery":
            # batteries report either energy (µWh) or charge (µAh); the ratio is the same
            full = num(f"{dev}/energy_full") or num(f"{dev}/charge_full")
            design = num(f"{dev}/energy_full_design") or num(f"{dev}/charge_full_design")

            micro_w = num(f"{dev}/power_now")
            if micro_w is None:  # some report current and voltage instead
                amps, volts = num(f"{dev}/current_now"), num(f"{dev}/voltage_now")
                micro_w = amps * volts / 1e6 if amps and volts else None

            result["batteries"].append({
                "capacity": num(f"{dev}/capacity"),
                "status": read(f"{dev}/status"),
                "health": round(100 * full / design, 1) if full and design else None,
                "power_w": round(micro_w / 1e6, 1) if micro_w else None,
                "cycles": num(f"{dev}/cycle_count"),
            })

    return result
