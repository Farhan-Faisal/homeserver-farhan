# Homeserver FBF

I converted my old Acer Nitro 5 laptop into a home server running Linux (Ubuntu Server).
It currently runs three services (Immich for photos, Jellyfin for media and a modded Minecraft server), plus a monitoring dashboard I built.
It also deploys websites through Cloudflare: **[hello.farhanlab.com](https://hello.farhanlab.com)**.

## Laptop specifications

| Part | Details |
|---|---|
| Model | Acer Nitro 5 (AN515-54) |
| CPU | Intel Core i7, 9th gen (6 cores, 12 threads) |
| Graphics | NVIDIA GeForce GTX 1050 (Pascal), free for ML jobs · Intel UHD 630 integrated, used by Jellyfin for transcoding |
| Memory | 22 GiB usable (after a 16 GB DDR4 upgrade) |
| System drive | 256 GB SATA SSD: Ubuntu, Docker, app settings |
| Data drive | 1 TB HDD, mounted at `/srv/data`: photos, files, media |
| Spare drive | 512 GB SSD in a USB enclosure |
| Built-in UPS | The laptop battery: the server rides through power cuts, and the dashboard alerts me when it's on battery |

## Operating system

**[Ubuntu Server](https://ubuntu.com/download/server)**, installed headless with OpenSSH, with:

- [Docker Engine and Compose](https://docs.docker.com/engine/install/ubuntu/): every app runs in containers
- [Tailscale](https://tailscale.com/download/linux): private access for me and my family, with no ports opened on the router
- NVIDIA driver 580 (the last driver branch that supports Pascal GPUs)
- Samba, for a network drive that Macs and PCs can mount

## Dashboard (serverdash)

A read-only monitoring page I wrote, in [`serverdash/`](serverdash/). A small Python collector (standard library only)
measures the server and writes everything to one file, `status.json`. A static web page reads that file and draws it.
The collector never changes anything on the server.

**Where to open it:** `http://<server>:8090` from my Tailscale devices, or `https://dash.farhanlab.com` behind a Cloudflare login.

### What each file collects

| File | Collects | From | How often |
|---|---|---|---|
| `probes/system.py` | Hostname, OS, kernel, uptime, load, CPU model and cores, CPU %, memory | `/proc`, `/etc/os-release` | every 10 s |
| `probes/gpu.py` | NVIDIA GPU load, VRAM, temperature, clocks, power, which processes (and containers) use it | `nvidia-smi` | every 10 s |
| `probes/sensors.py` | Every temperature sensor, fan speeds, battery charge and health, charger plugged in | `sensors` (lm-sensors), `/sys` | every 10 s |
| `probes/services.py` | Docker containers (state, health, restarts, CPU, memory, ports), systemd services, failed units | `docker`, `systemctl` | every 10 s |
| `probes/storage.py` | Drives, volumes and how full they are (including the Immich volume), live read/write speed | `/sys/block`, `/proc/mounts`, `/proc/diskstats` | every 10 s |
| `probes/network.py` | Interfaces, IP addresses, Wi-Fi name and signal, upload and download speed | `/proc/net/dev`, `ip`, `iw` | every 10 s |
| `probes/people.py` | Tailscale devices and owners, who is connected to which service, SSH logins, Samba sessions | `tailscale`, `ss`, `nsenter`, `who`, `smbstatus` | every 10 s |
| `probes/apps.py` | Immich (up, version, photos and storage per person), Jellyfin (up, library, who's watching), Minecraft (players, TPS) | their HTTP APIs, Minecraft RCON | every 10 s |
| `probes/slow.py` | Drive health (SMART), folder sizes, pending updates | `smartctl`, `du`, `apt-check` | SMART and updates hourly, folders every 30 min |

| File | Job |
|---|---|
| `__main__.py` | The loop: run every probe, add alerts and history, write `status.json`, send notifications |
| `background.py` | Runs the slow probes in their own thread so they never delay the 10-second loop |
| `alerts.py` | Turns the numbers into warnings and critical alerts (temperatures, disk space, services down, lag, power) |
| `history.py` | Chart data: the last hour at full detail, the last 24 hours as 5-minute averages |
| `notify.py` | Phone alerts through [ntfy](https://ntfy.sh), plus an optional heartbeat to healthchecks.io |
| `config.py` | Generic defaults, overridden by `/etc/serverdash/config.json` |

### How it runs

- **Always on:** a systemd service that starts at boot and restarts itself if it ever crashes.
- **Every 10 seconds** it takes a new sample; the page checks for one every 5 seconds.
- **Charts** keep 1 hour at 10-second detail and 24 hours of 5-minute averages, saved to disk every 5 minutes, so a restart doesn't wipe them.
- **Phone alerts** fire only after a problem lasts about 30 seconds (3 samples), are sent once, repeat every 6 hours while critical, and end with a "Resolved" message.
- **Portable:** works on any Debian or Ubuntu server with Docker and Python 3.10+. Apps it doesn't find are simply hidden.

Install: `cd serverdash && sudo ./install.sh`, then put your settings in `/etc/serverdash/config.json` (see `config.example.json`).

## Services

| Service | What it does | Port | Who can use it | Set it up on your server |
|---|---|---|---|---|
| [Immich](https://immich.app) | Photo and video backup from phones, albums, face search | 2283 | Me and family | [`stacks/immich/README.md`](stacks/immich/README.md) |
| [Jellyfin](https://jellyfin.org) | Movies, shows and music streamed to any device | 8096 | Me | [`stacks/jellyfin/README.md`](stacks/jellyfin/README.md) |
| [Minecraft](https://docker-minecraft-server.readthedocs.io) | Modded server (Project Architect 2, Forge 1.20.1) | 25565 | Me and family | [`stacks/minecraft/README.md`](stacks/minecraft/README.md) |

Each folder has a `docker-compose.yml`, a `.env.example` with every setting, and a README with the exact commands.

## Architecture

![Architecture of Homeserver FBF](docs/architecture.svg)

### Ports and how each is protected

| Port | Service | Runs | Reachable from | Protection |
|---|---|---|---|---|
| 22 | SSH | host | listens on all interfaces | SSH key login |
| 445 | Samba (network drive) | host | Tailscale only | Samba only accepts the Tailscale range `100.64.0.0/10` · Samba password |
| 2283 | Immich | Docker | tailnet (me, family) and home network | Tailscale policy grant · Immich accounts with per-person quotas |
| 8096 | Jellyfin | Docker | tailnet (me) and home network | Tailscale policy (no family grant) · Jellyfin accounts |
| 25565 | Minecraft | Docker | tailnet (me, family) and home network | Tailscale policy grant · server whitelist |
| 8090 | Dashboard | Docker (nginx, host network) | Tailscale and the server itself | nginx allow-list (`allowed-networks.conf`) · read-only page, strict CSP |
| none | hello.farhanlab.com | Docker (web-nginx) | the internet, via Cloudflare | no open ports: cloudflared connects out to Cloudflare · HTTPS at Cloudflare · requests for unknown hostnames are dropped |
| none | dash.farhanlab.com | Docker (web-nginx) | me, via Cloudflare | Cloudflare Access: only my Cloudflare login gets through |

Notes on the design:

- **Nothing is port-forwarded on the router.** Tailscale connects devices directly (or through its relays) and Cloudflare Tunnel is an outbound connection, so the server has no inbound openings to the internet.
- **Docker-published ports also listen on the home network.** Docker writes its own firewall rules, so anyone on my home Wi-Fi can reach Immich, Jellyfin and Minecraft (they still need an account or to be on the whitelist).
- **web-nginx has no host ports at all.** Only cloudflared, on the same private Docker network, can talk to it.

## Repository layout

```
serverdash/     the dashboard: collector (Python), web page, installer
stacks/         Immich, Jellyfin and Minecraft: compose files and setup guides
LICENSE
```

## License

[MIT](LICENSE). The exception is `stacks/immich/docker-compose.yml`, which is Immich's own file (AGPL-3.0), included unmodified.

## Attribution

Built with help from Claude Opus 5.5 by Anthropic.
