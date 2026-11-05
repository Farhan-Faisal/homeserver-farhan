"""Converting the timestamps other programs print into seconds since 1970."""
import re
from datetime import datetime


def epoch(iso):
    """'2026-10-09T08:12:33.123456789Z' -> 1791533553.12. None for empty or the zero date (0001-01-01)."""
    if not iso or iso.startswith("0001"):
        return None
    # Python before 3.11 only reads "+00:00" (not "Z") and exactly 6 decimals,
    # so rewrite e.g. ".123456789Z" or ".12Z" as ".123456+00:00" / ".120000+00:00"
    iso = iso.replace("Z", "+00:00")
    iso = re.sub(r"\.(\d+)", lambda m: "." + m.group(1)[:6].ljust(6, "0"), iso)
    return datetime.fromisoformat(iso).timestamp()
