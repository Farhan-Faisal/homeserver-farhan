"""Running other programs (docker, ss, tailscale...) and getting their output."""
import subprocess


def run(*cmd, timeout=10):
    """Output of a command as text. Raises if it fails, hangs, or isn't installed."""
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=True).stdout
