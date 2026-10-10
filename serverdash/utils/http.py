"""Calling web APIs: Immich and Jellyfin on this server, ntfy and healthchecks.io outside it."""
import json
import time
import urllib.request


def get(url, headers=None, timeout=5):
    """GET a URL. Returns (body, milliseconds it took). Raises on errors, timeouts and HTTP 4xx/5xx."""
    start = time.monotonic()
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
    return body, round((time.monotonic() - start) * 1000, 1)


def get_json(url, headers=None, timeout=5):
    return json.loads(get(url, headers, timeout)[0])


def post_json(url, data, headers=None, timeout=8):
    """POST data as JSON. Raises on errors, like get()."""
    request = urllib.request.Request(
        url, data=json.dumps(data).encode(), method="POST",
        headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()
