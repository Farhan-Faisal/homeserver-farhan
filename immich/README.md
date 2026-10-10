# Immich (photos)

Self-hosted Google Photos: phone backup, albums, face and object search, sharing.
Runs as four containers: the server, machine learning (search and faces), Redis and Postgres.

| | |
|---|---|
| Web and app address | `http://<server>:2283` |
| Photos stored in | `UPLOAD_LOCATION` in `.env` (default `/srv/data/immich`) |
| Database stored in | `./postgres` next to this file (keep it on the SSD) |

## Requirements

- Docker with the Compose plugin
- About 4 GB of RAM free; more for big libraries (machine learning is the hungry part)
- A drive with room for your photos

## 1. Put the files in place

```bash
mkdir -p ~/stacks/immich
cp docker-compose.yml .env.example ~/stacks/immich/
cd ~/stacks/immich
cp .env.example .env
```

## 2. Set a database password

Letters and digits only. This generates a random one and writes it into `.env`:

```bash
sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$(openssl rand -hex 16)/" .env
```

Then open `.env` and set `UPLOAD_LOCATION` and `TZ`:

```bash
nano .env
```

## 3. (Optional) Cap how much space Immich can use

Immich has per-person quotas but no total limit. To stop it from ever filling the drive,
give it a fixed-size volume: a file on the big drive, formatted and mounted where Immich stores photos.
The file is sparse, so it only takes up the space actually used.

```bash
sudo truncate -s 400G /srv/data/immich.img           # the cap
sudo mkfs.ext4 -m 0 -L immich /srv/data/immich.img    # -m 0: no space reserved for root
sudo mkdir -p /srv/data/immich
echo '/srv/data/immich.img /srv/data/immich ext4 loop,nofail 0 2' | sudo tee -a /etc/fstab
sudo systemctl daemon-reload
sudo mount /srv/data/immich
df -h /srv/data/immich                                # should show about 400G
```

Do this before the first start. Moving an existing library in later means copying everything.

## 4. Start it

```bash
docker compose up -d
docker compose ps              # all four should be "running" (healthy after a minute)
docker compose logs -f immich-server     # Ctrl+C to stop watching
```

## 5. First-time setup

1. Open `http://<server>:2283` and create the admin account (the first account is the admin).
2. Install the Immich app on your phone, enter the same address, log in, turn on backup.
3. Add family: **Administration → Users → Create user**. Set a **storage quota** per person there.

## Sharing with family over Tailscale

Invite them to your tailnet (or share the server with them from the Tailscale admin console),
then allow only this port in your tailnet policy, so they can reach Immich and nothing else:

```json
"groups": { "group:family": ["alice@example.com", "bob@example.com"] },
"grants": [
  { "src": ["group:family"], "dst": ["<your-server>"], "ip": ["tcp:2283"] }
]
```

They then use `http://<server's Tailscale IP>:2283` in the app.

## Updating

Within the major version set in `.env` (for example v3):

```bash
docker compose pull && docker compose up -d
```

For a new major version, read the release notes first, then download the new files
from that release and update `IMMICH_VERSION` in `.env`:

```bash
wget -O docker-compose.yml https://github.com/immich-app/immich/releases/latest/download/docker-compose.yml
```

## Backups

Immich dumps its database every night into `UPLOAD_LOCATION/backups`.
Back up the whole `UPLOAD_LOCATION` folder and your photos and database are both covered.

## GPU for machine learning (optional, NVIDIA)

Needs the NVIDIA driver and the NVIDIA Container Toolkit. Then:

```bash
wget https://github.com/immich-app/immich/releases/latest/download/hwaccel.ml.yml
```

In `docker-compose.yml`, under `immich-machine-learning`: add `-cuda` to the image tag and
uncomment the `extends:` block with `service: cuda`. Run `docker compose up -d` again.
Details: https://docs.immich.app/features/ml-hardware-acceleration

## Connecting it to serverdash

Create an API key: avatar → **Account Settings → API Keys → New API Key**, permission
`server.statistics` only (it must be an admin's key). Then in `/etc/serverdash/config.json`:

```json
"immich": { "url": "http://127.0.0.1:2283", "api_key": "YOUR_KEY" }
```

## Useful commands

```bash
docker compose ps                        # status
docker compose logs --tail 100 immich-server
docker compose restart                   # restart everything
docker compose down                      # stop (your photos and database stay)
```
