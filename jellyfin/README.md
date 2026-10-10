# Jellyfin (movies, shows, music)

Self-hosted Netflix for your own files: apps for phones, TVs and browsers, resume across devices,
and on-the-fly conversion (transcoding) when a device can't play a file directly.

| | |
|---|---|
| Web and app address | `http://<server>:8096` |
| Media read from | `MEDIA_DIR` in `.env` (default `/srv/data/media`), read-only |
| Settings stored in | `./config` and `./cache` next to this file |

## Requirements

- Docker with the Compose plugin
- Optional but recommended: an Intel CPU with integrated graphics (Quick Sync) for fast,
  low-power transcoding. Without one, delete the `group_add` and `devices` lines in
  `docker-compose.yml`; Jellyfin then transcodes on the CPU.

## 1. Lay out your media

Jellyfin matches files to posters and descriptions by name, so this layout matters:

```
/srv/data/media/
├── movies/
│   └── Inception (2010)/
│       └── Inception (2010).mkv
├── tv/
│   └── Severance (2022)/
│       └── Season 01/
│           └── Severance S01E01.mkv
└── music/
```

```bash
sudo mkdir -p /srv/data/media/{movies,tv,music}
sudo chown -R $USER:$USER /srv/data/media
```

## 2. Put the files in place and fill in .env

```bash
mkdir -p ~/stacks/jellyfin
cp docker-compose.yml .env.example ~/stacks/jellyfin/
cd ~/stacks/jellyfin
cp .env.example .env

id -u                                  # -> PUID
id -g                                  # -> PGID
getent group render | cut -d: -f3      # -> RENDER_GID
nano .env
```

## 3. Start it

```bash
docker compose up -d
docker compose logs -f                 # Ctrl+C to stop watching
```

## 4. First-time setup

1. Open `http://<server>:8096` and follow the wizard (it creates your admin account).
2. Add libraries: **Movies** → `/media/movies`, **Shows** → `/media/tv`, **Music** → `/media/music`.
   These are paths *inside* the container; `/media` is your `MEDIA_DIR`.
3. Turn on hardware transcoding (Intel only): **Dashboard → Playback → Transcoding** →
   Hardware acceleration: **Intel QuickSync (QSV)**, device `/dev/dri/renderD128` → Save.

Check that the GPU is visible inside the container:

```bash
docker exec jellyfin /usr/lib/jellyfin-ffmpeg/vainfo --display drm --device /dev/dri/renderD128
```

A list of `VAProfile...` lines means it works.

## Adding media later

Copy files into the right folder (over Samba, `scp`, anything), then in Jellyfin:
**Dashboard → Libraries → Scan All Libraries**. Jellyfin also rescans on its own periodically.

## Updating

```bash
docker compose pull && docker compose up -d
```

## Connecting it to serverdash

Create an API key: **Dashboard → API Keys → +**, name it `serverdash`. Then in
`/etc/serverdash/config.json`:

```json
"jellyfin": { "url": "http://127.0.0.1:8096", "api_key": "YOUR_KEY" }
```

## Useful commands

```bash
docker compose ps                      # status
docker compose logs --tail 100         # recent log
docker compose restart
docker compose down                    # stop (settings and media stay)
```
