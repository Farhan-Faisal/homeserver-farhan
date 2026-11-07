# serverdash backend

The REST API behind the serverdash dashboard: it reads the collector's SQLite database and manages family accounts on Tailscale, Samba, Immich, Jellyfin and Jellyseerr.

Built with Node.js, npm and Express 5, in TypeScript. Node runs the `.ts` files directly (type stripping), so there is no build step. Tests use Node's built-in `node:test`.

## Folder structure

```
backend/
├── package.json
├── package-lock.json
├── tsconfig.json
├── .env                    # dev settings and keys (not committed)
├── src/
│   ├── server.ts           # starts the HTTP server
│   ├── app.ts              # Express app: routers, 404 and error handlers
│   ├── config.ts           # settings read from the environment
│   ├── db.ts               # read-only connection to the collector's SQLite database
│   ├── models/             # the logic: database queries and calls to each service's API
│   │   ├── status.ts
│   │   ├── metrics.ts
│   │   ├── events.ts
│   │   ├── tailnet.ts
│   │   ├── samba.ts
│   │   ├── immich.ts
│   │   ├── jellyfin.ts
│   │   └── jellyseerr.ts
│   └── routes/             # the HTTP endpoints: check input, call a model, send JSON
│       ├── health.ts
│       ├── status.ts
│       ├── metrics.ts
│       ├── events.ts
│       ├── tailnet.ts
│       ├── samba.ts
│       ├── immich.ts
│       ├── jellyfin.ts
│       └── jellyseerr.ts
├── deploy/
│   ├── serverdash-api.service   # systemd unit
│   └── serverdash-samba         # root helper that lists and adds Samba users (run through sudo)
└── test/
    ├── helpers.ts
    ├── read.test.ts        # read-only checks, safe to run any time
    ├── refused.test.ts     # bad input is refused
    └── changes.test.ts     # creates and removes things; only with RUN_CHANGES=1
```

## Development

```bash
cd backend
npm install
npm run dev               # starts the API with .env loaded (PORT=8092 in dev)
npm run check             # type check (tsc)
npm test                  # read-only tests
npm run test:changes      # tests that make real changes, one at a time
```

`.env` holds the port and the keys for Tailscale, Immich, Jellyfin and Jellyseerr. It is never committed.

## Production

The API runs as the `serverdash-api` user from `/opt/serverdash/api`, on `127.0.0.1:8091`. Its settings are in `/etc/serverdash/api.env` (mode 600). The dashboard's nginx forwards `/api/` to it.

First install:

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin serverdash-api
sudo install -d /opt/serverdash/api
sudo cp -r src package.json package-lock.json /opt/serverdash/api/
(cd /opt/serverdash/api && sudo npm ci --omit=dev)
sudo install -m 600 /dev/null /etc/serverdash/api.env   # then add PORT=8091 and the keys
sudo cp deploy/serverdash-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now serverdash-api
```

Update after code changes:

```bash
cd backend
sudo cp -r src package.json package-lock.json /opt/serverdash/api/
(cd /opt/serverdash/api && sudo npm ci --omit=dev)   # only if dependencies changed
sudo systemctl restart serverdash-api
```

Check it:

```bash
systemctl is-active serverdash-api
curl -s http://127.0.0.1:8091/api/health
journalctl -u serverdash-api -n 30 --no-pager
```

## API

All responses are JSON. Errors come back as `{ "error": "..." }` with a matching status code.

| Method | Path | Body or query | What it does |
|---|---|---|---|
| GET | `/api/health` | | Whether the API is up, and how old the collector's newest sample is |
| GET | `/api/status` | | The newest full sample: CPU, memory, temperatures, drives, containers, services, people, alerts |
| GET | `/api/metrics` | `?range=1h\|24h\|7d\|30d\|1y` (default `1h`) | Chart data: every 10 s sample for 1h, averages per slot for longer ranges |
| GET | `/api/events` | `?limit=1-500` (default 50), or `?open=true` | Alert history, newest first; `open=true` returns only alerts happening now |
| GET | `/api/tailnet/users` | | Everyone on the Tailscale network |
| GET | `/api/tailnet/groups` | | Each service, its group in the policy file, and who is in it |
| POST | `/api/tailnet/access` | `{ "email", "service" }` | Give someone access to a service (`immich`, `jellyfin`, `jellyseerr`, `samba`) |
| DELETE | `/api/tailnet/access` | `{ "email", "service" }` | Take that access away; reports any other rule that still lets them in |
| GET | `/api/samba/users` | | Samba accounts |
| POST | `/api/samba/users` | `{ "username", "password" }` | Create a Samba account with its own private folder |
| GET | `/api/immich/users` | | Immich accounts with storage limit and usage |
| POST | `/api/immich/users` | `{ "email", "name", "password", "quotaGiB" }` | Create an Immich account; they change the password at first login |
| DELETE | `/api/immich/users/:email` | | Delete an Immich account; refused for admins and for anyone with photos |
| GET | `/api/jellyfin/users` | | Jellyfin accounts and their permissions |
| POST | `/api/jellyfin/users` | `{ "username", "password" }` | Create a Jellyfin account with family permissions |
| DELETE | `/api/jellyfin/users/:username` | | Delete a Jellyfin account; refused for admins |
| GET | `/api/jellyseerr/users` | | Jellyseerr accounts, request counts, and whether requests need approval |
| POST | `/api/jellyseerr/users` | `{ "username", "approvalRequired"? }` | Import a Jellyfin account into Jellyseerr (approval on by default) |
| PATCH | `/api/jellyseerr/users/:username` | `{ "approvalRequired" }` | Turn approval on or off for one person; admins are never changed |