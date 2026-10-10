"""Reading the small text files in /proc and /sys, and writing JSON files safely."""
import json
import os


def read(path):
    """Contents of a small text file (like those in /proc and /sys), or None if it doesn't exist."""
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return None


def num(path):
    """A file that holds one number, as a float (None if missing or empty)."""
    value = read(path)
    return float(value) if value else None


def write_json(path, data):
    """Write JSON so a reader never sees half a file: write a temp file, then swap it in."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    os.chmod(tmp, 0o644)  # readable by the web server container
    os.replace(tmp, path)  # atomic on Linux: readers get the old file or the new one
