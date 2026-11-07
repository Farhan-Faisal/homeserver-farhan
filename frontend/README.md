# serverdash frontend

The dashboard you open in the browser: eight tabs showing the server's health and the family's accounts, built as plain static files that nginx serves.

Built with npm, Next.js 16 (App Router), React 19 and TypeScript. Styling uses Tailwind CSS v4, charts use Recharts, and icons come from lucide-react. `npm run build` exports static HTML, JS and CSS, so there's no Node server in production. Every number on the page comes from the backend API at `/api`.

## Folder structure

```
frontend/
├── package.json
├── package-lock.json
├── next.config.ts            # static export for builds; in dev, forwards /api to the API
├── postcss.config.mjs        # Tailwind
├── tsconfig.json
├── eslint.config.mjs
└── src/
    ├── app/                  # one folder per tab; each page.tsx is that tab
    │   ├── layout.tsx        # fonts, navbar, page width
    │   ├── globals.css
    │   ├── page.tsx          # General
    │   ├── people/page.tsx
    │   ├── samba/page.tsx
    │   ├── immich/page.tsx
    │   ├── media/page.tsx
    │   ├── storage/page.tsx
    │   ├── tailscale/page.tsx
    │   └── system/page.tsx
    ├── components/
    │   ├── Navbar.tsx            # the tab bar
    │   ├── PageHeader.tsx        # icon, title and subtitle at the top of each tab
    │   ├── Card.tsx              # the base panel
    │   ├── StatCard.tsx          # small number card with an icon and a colour for its state
    │   ├── Pill.tsx              # small coloured label: "Running", "Healthy", "41 °C"
    │   ├── Meter.tsx             # usage bar, amber from 85%, red from 95%
    │   ├── Avatar.tsx            # coloured initials
    │   ├── Toggle.tsx            # on/off switch with a saving spinner
    │   ├── ConfirmDelete.tsx     # bin icon that asks before deleting
    │   ├── form.tsx              # Field, SubmitButton, FormMessage
    │   ├── StatusBanner.tsx      # "Everything's running" banner on General
    │   ├── AlertList.tsx
    │   ├── PersonCard.tsx
    │   ├── Sparkline.tsx
    │   ├── TempChart.tsx
    │   ├── RangePicker.tsx
    │   ├── CreateSambaUser.tsx
    │   ├── CreateImmichUser.tsx
    │   └── CreateJellyfinUser.tsx
    └── lib/
        ├── api.ts            # apiGet, apiSend, usePoll (refresh while the tab is visible), useNow
        ├── types.ts          # the shapes of the API's answers
        ├── format.ts         # bytes, speeds, durations, dates
        └── levels.ts         # value + [warning, critical] limits -> colour
```

## Tabs

| Tab | Path | Shows | API used |
|---|---|---|---|
| General | `/` | Status banner, CPU, temperature, memory, GPU, network, devices, containers, uptime, CPU temperature chart, current alerts | `/api/status`, `/api/metrics` |
| People | `/people` | Who's online, on which devices, and what they're using or watching | `/api/status` |
| Samba | `/samba` | Accounts, who's connected, drive space, create an account | `/api/status`, `/api/samba/users` |
| Immich | `/immich` | Accounts with storage used and limit, delete, create an account | `/api/immich/users` |
| Media | `/media` | Jellyfin accounts and permissions, who's watching, Jellyseerr approval switch, create an account | `/api/jellyfin/users`, `/api/jellyseerr/users`, `/api/status` |
| Storage | `/storage` | Each drive's health, temperature, wear and activity, its mounts, volume files, folder sizes | `/api/status` |
| Tailscale | `/tailscale` | People × services table of switches to give or remove access, leftover policy groups | `/api/tailnet/users`, `/api/tailnet/groups`, `/api/tailnet/access`, `/api/status` |
| System | `/system` | Containers, systemd services, updates, alert history | `/api/status`, `/api/events` |

Every tab follows the same layout: `PageHeader`, a row of four `StatCard`s, then `Card`s. Pages read with `usePoll`, which refreshes every 5 to 60 seconds and pauses while the browser tab is hidden. They change things with `apiSend`, then call `reload()` so the new data shows straight away.

## Development

Run on the server, not from a Mac through the Samba share: `node_modules` over Samba is slow and leaves thousands of open-file locks.

```bash
cd frontend
npm install
npm run dev          # http://server-fbf:3000, bound to the Tailscale IP only
npm run lint
```

In dev, Next forwards `/api/...` to the production API on `127.0.0.1:8091`. To use a dev API instead:

```bash
API_URL=http://127.0.0.1:8092 npm run dev
```

## Production

The `serverdash` nginx container (`services/serverdash/docker-compose.yml` and `services/serverdash/nginx.conf`) serves `/opt/serverdash/www` on port 8090:
- it maps `/people` to `people.html`, and so on for the other tabs
- it forwards `/api/` to the API on `127.0.0.1:8091`
- it caches `/_next/static/` files forever, since their names change with their content

It's reached at `server-fbf:8090` over Tailscale, and at dash.farhanlab.com through the Cloudflare tunnel.

Build and deploy:

```bash
cd frontend
npm run lint && npm run build                        # static files in out/
sudo rsync -a --delete out/ /opt/serverdash/www/
sudo chmod -R a+rX /opt/serverdash/www
```

No restart is needed for new files. Only after changing `nginx.conf`:

```bash
cd ~/stacks/serverdash && docker compose restart
```

Check it:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://100.113.90.61:8090/people     # 200
```