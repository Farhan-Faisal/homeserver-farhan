# services

The Docker Compose stacks that run on server-fbf. Each folder here is one stack. On the server it lives in `~/stacks/<name>`, with its own `.env` and data folders next to the compose file.

Secrets are not in git: each stack with secrets has a `.env.example` listing the variables, and the real `.env` stays on the server.

## What's included

| Stack | Containers | What it does | Port | Reachable on |
|---|---|---|---|---|
| `immich` | `immich_server`, `immich_machine_learning`, `immich_postgres`, `immich_redis` | Photo and video backup for the family | 2283 | home network and Tailscale |
| `jellyfin` | `jellyfin` | Streams movies and shows | 8096 | home network and Tailscale |
| `media-automation` | `sonarr` | Finds and downloads TV shows | 8989 | Tailscale only |
| | `radarr` | Finds and downloads movies | 7878 | Tailscale only |
| | `prowlarr` | Manages the torrent indexers for Sonarr and Radarr | 9696 | Tailscale only |
| | `qbittorrent` | Downloads torrents (web UI) | 8080 | Tailscale only |
| | `flaresolverr` | Gets past Cloudflare checks on indexer sites | 8191 | inside Docker only |
| `seerr` | `seerr` | Jellyseerr: family members request movies and shows | 5055 | Tailscale only |
| `project-architect` | `project-architect` | Minecraft server (Project Architect modpack, Java 17) | 25565 | home network and Tailscale |
| `serverdash` | `serverdash` | nginx serving the dashboard and forwarding `/api` (host network) | 8090 | networks in `allowed-networks.conf` |
| `web` | `web-nginx`, `cloudflared` | Public websites through a Cloudflare Tunnel: `dash.farhanlab.com` and the `hello` test site | none | internet, through Cloudflare only |

Ports bound to `100.113.90.61` (the server's Tailscale address) can't be reached from the home network. Postgres (5432), Redis (6379) and `web-nginx` (80) are only reachable by other containers.

Not in Docker, but part of the server:

| Service | Port | Reachable on |
|---|---|---|
| SSH | 22 | home network and Tailscale |
| Samba (file sharing) | 445 | Tailscale (per-person access in the Tailscale policy) |
| serverdash API (`backend/`) | 8091 | the server itself only; nginx forwards to it |
| serverdash collector (`collector/`) | none | writes to its SQLite database |

## Setting up on the server

### 1. Before Docker

- Ubuntu with Docker Engine and the Compose plugin.
- Tailscale connected, so the server has `100.113.90.61`.
- The data drives in `/etc/fstab`: the HDD at `/srv/data` and the Immich volume at `/srv/data/immich`.

Two host settings make the stacks survive a reboot:

```bash
# let containers bind to the Tailscale address even if Tailscale isn't up yet
echo 'net.ipv4.ip_nonlocal_bind = 1' | sudo tee /etc/sysctl.d/99-nonlocal-bind.conf
sudo sysctl --system

# start Docker only after the data drives are mounted
sudo mkdir -p /etc/systemd/system/docker.service.d
printf '[Unit]\nWants=srv-data.mount srv-data-immich.mount\nAfter=srv-data.mount srv-data-immich.mount\n' \
  | sudo tee /etc/systemd/system/docker.service.d/wait-for-data.conf
sudo systemctl daemon-reload
```

Without the second one, containers that start before the HDD is mounted see an empty `/srv/data`. Sonarr and Radarr then report missing folders and qBittorrent shows every torrent as "Missing Files".

### 2. Copy a stack into place and fill in its secrets

```bash
cp -r services/<name> ~/stacks/<name>
cd ~/stacks/<name>
cp .env.example .env && nano .env      # only for stacks that have one
chmod 600 .env
```

Data folders (`postgres/`, `config/`, `data/`...) are created by the containers on first start.

### 3. Start the stacks in this order

`seerr` joins networks that other stacks create, so those go first:

```bash
cd ~/stacks/web && docker compose up -d
cd ~/stacks/media-automation && docker compose up -d
cd ~/stacks/seerr && docker compose up -d
cd ~/stacks/immich && docker compose up -d
cd ~/stacks/jellyfin && docker compose up -d
cd ~/stacks/project-architect && docker compose up -d
cd ~/stacks/serverdash && docker compose up -d
```

If a stack says a network doesn't exist, create it with `docker network create <name>` and try again.

`serverdash` also needs the built frontend in `/opt/serverdash/www` and the API running on port 8091. See `frontend/README.md` and `backend/README.md`.

### 4. Check

```bash
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' | sort
docker exec sonarr ls /data             # should list files, media, torrents
```

## Updating a stack

```bash
cd ~/stacks/<name>
docker compose pull && docker compose up -d
```

Most images follow `latest`. Immich is pinned to a major version (`v3`): read its release notes before changing it.

After changing a compose file on the server, copy it back here and commit, so this folder stays the source of truth.