# 🏠 server-fbf

My home server: an old Acer Nitro 5 laptop (i7-9750H, GTX 1050) running Ubuntu, serving photos, media, files and a Minecraft world to my family. I built it to refresh my Docker skills and to brush up on software engineering architecture: separate services, a REST API, a database, and a frontend that only talks to the API.

## 🧩 Services

- **Immich**: photo and video backup, port `2283`
- **Jellyfin**: movie and TV streaming, port `8096`
- **Jellyseerr**: movie and show requests, port `5055`
- **Sonarr**: TV show automation, port `8989`
- **Radarr**: movie automation, port `7878`
- **Prowlarr**: indexer manager, port `9696`
- **qBittorrent**: downloads, web UI on port `8080`
- **FlareSolverr**: gets indexers past Cloudflare checks, port `8191` (inside Docker only)
- **Minecraft** (Project Architect modpack): port `25565`
- **Samba**: file sharing with a private folder per person, port `445`
- **serverdash**: the monitoring dashboard, port `8090`
- **Cloudflare Tunnel + nginx**: the only way in from the internet

Every service runs in Docker except Samba, SSH and the dashboard's API and collector. Details, and how to set everything up on a fresh server: [services/README.md](services/README.md)

## 📊 Live monitoring dashboard

serverdash shows the server's health and manages the family's accounts: temperatures, drives, containers, services, who's online and what they're watching. It can also create accounts, and give or remove access to each service. It's built in three parts:

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS and Recharts, exported as static files and served by nginx. [frontend/README.md](frontend/README.md)
- **Backend**: a Node.js REST API with Express 5 and TypeScript. It reads the database and talks to Tailscale, Samba, Immich, Jellyfin and Jellyseerr. [backend/README.md](backend/README.md)
- **Collector**: Python (standard library only). It measures the server every 10 seconds and saves everything to SQLite. [collector/README.md](collector/README.md)

## 🔒 Security

Everything is reached over **Tailscale**, my private network. Nothing is open to the internet except the dashboard, and that goes through a **Cloudflare Tunnel** protected by **Cloudflare Access**: it only opens after logging in with my account. Within Tailscale, each family member only gets the services they've been given, through per-service groups in the Tailscale policy.

## 🗺️ Architecture

![Architecture diagram](docs/architecture.svg)

## Media Automation 

![Media Automation Stack Architecture diagram](docs/media-automation.svg)

## 🚧 Upcoming

- **ntfy alerts**: push notifications to my phone when something goes wrong (overheating, a full drive, a service down).
- **Routine backups**: a nightly cron job backing up the Minecraft world, important files and photos to a separate drive.

## 📄 License

See [LICENSE](LICENSE).

## 🤖 Built with Claude

Designed and built with help from [Claude](https://claude.ai) by Anthropic, as a pair programmer.