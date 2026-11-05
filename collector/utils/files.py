"""Reading the small text files in /proc and /sys."""


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

