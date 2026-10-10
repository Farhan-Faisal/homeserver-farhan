"""The apps people use: Immich, Jellyfin and the Minecraft server.

Each check has two stages. First: is the app answering at all? (That decides
"ok", which drives the "not responding" alert.) Then: details from its API.
If the details fail, the app still counts as up and the reason goes in "errors".
"""
import re
import subprocess

from ..utils.commands import run
from ..utils.http import get, get_json
from ..utils.times import epoch


def immich(cfg):
    url = cfg["immich"]["url"]
    if not url:
        return None  # Immich not installed here
    headers = {"x-api-key": cfg["immich"]["api_key"]}
    result = {"ok": False, "errors": []}

    try:
        body, result["latency_ms"] = get(f"{url}/api/server/ping")  # answers {"res":"pong"}
        result["ok"] = b"pong" in body
    except OSError as e:
        result["errors"].append(f"not responding: {e}")
        return result

    try:
        v = get_json(f"{url}/api/server/version")
        result["version"] = f"{v['major']}.{v['minor']}.{v['patch']}"

        stats = get_json(f"{url}/api/server/statistics", headers, timeout=15)
        result["totals"] = {"photos": stats["photos"], "videos": stats["videos"], "usage": stats["usage"]}
        result["users"] = sorted(({
            "name": u["userName"],
            "photos": u["photos"],
            "videos": u["videos"],
            "usage": u["usage"],                  # bytes
            "quota": u["quotaSizeInBytes"],       # None if no quota set
        } for u in stats["usageByUser"]), key=lambda u: -u["usage"])
    except (OSError, ValueError, KeyError) as e:
        result["errors"].append(f"details: {e}")

    return result


def jellyfin(cfg):
    url = cfg["jellyfin"]["url"]
    if not url:
        return None  # Jellyfin not installed here
    headers = {"Authorization": f'MediaBrowser Token="{cfg["jellyfin"]["api_key"]}"'}
    result = {"ok": False, "sessions": [], "errors": []}

    try:
        body, result["latency_ms"] = get(f"{url}/health")  # answers "Healthy"
        result["ok"] = body == b"Healthy"
    except OSError as e:
        result["errors"].append(f"not responding: {e}")
        return result

    try:
        result["version"] = get_json(f"{url}/System/Info/Public")["Version"]

        c = get_json(f"{url}/Items/Counts", headers)
        result["counts"] = {"movies": c["MovieCount"], "series": c["SeriesCount"],
                            "episodes": c["EpisodeCount"], "songs": c["SongCount"]}

        # everyone who used Jellyfin in the last 15 minutes, and what they're watching
        for s in get_json(f"{url}/Sessions?activeWithinSeconds=900", headers):
            item = s.get("NowPlayingItem") or {}
            title = item.get("Name")
            if item.get("SeriesName"):
                title = f"{item['SeriesName']}: {title}"  # "Severance: Hello, Ms. Cobel"
            result["sessions"].append({
                "user": s.get("UserName"),
                "device": s.get("DeviceName"),
                "client": s.get("Client"),
                "ip": s.get("RemoteEndPoint"),
                "playing": title,
                "paused": (s.get("PlayState") or {}).get("IsPaused"),
                "last_activity": epoch(s.get("LastActivityDate")),
            })
    except (OSError, ValueError, KeyError) as e:
        result["errors"].append(f"details: {e}")

    return result


def minecraft(cfg):
    name = cfg["minecraft_container"]
    if not name:
        return None  # no Minecraft server configured
    state = run("docker", "inspect", "--format", "{{.State.Status}}", name).strip()
    result = {"container": name, "state": state, "ok": False,
              "online": None, "max": None, "players": [], "tps": None, "mspt": None}
    if state != "running":
        return result

    # RCON is the server's remote console; the itzg image ships rcon-cli to talk to it
    try:
        players = run("docker", "exec", name, "rcon-cli", "list", timeout=8)
        ticks = run("docker", "exec", name, "rcon-cli", "forge tps", timeout=8)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return result  # container is up but the server isn't answering yet (still starting)

    # "There are 2 of a max of 20 players online: Steve, Alex"
    m = re.search(r"There are (\d+) of a max of (\d+) players online:?\s*(.*)", players)
    if m:
        result["ok"] = True
        result["online"], result["max"] = int(m.group(1)), int(m.group(2))
        result["players"] = [p.strip() for p in m.group(3).split(",") if p.strip()]

    # "Overall: Mean tick time: 12.345 ms. Mean TPS: 20.000"
    m = re.search(r"Overall: Mean tick time: ([\d.]+) ms\. Mean TPS: ([\d.]+)", ticks)
    if m:
        result["mspt"], result["tps"] = float(m.group(1)), float(m.group(2))

    return result
