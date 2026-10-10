# Minecraft (modded, Forge)

A modded Minecraft server running a CurseForge modpack, using the
[itzg/minecraft-server](https://docker-minecraft-server.readthedocs.io) image.
The example settings are for **Project Architect 2** (Minecraft 1.20.1, Forge 47.4.8);
any Forge 1.20.1 pack works the same way.

| | |
|---|---|
| Address to join | `<server>:25565` |
| World, mods, logs | `./data` next to this file |
| Who can join | players listed in `WHITELIST` in `.env` |

## Requirements

- Docker with the Compose plugin
- RAM: modded packs want 8 to 12 GB for the server alone
- The modpack's **server files** (step 2)

## 1. Put the files in place

```bash
mkdir -p ~/stacks/minecraft/data
cp docker-compose.yml .env.example ~/stacks/minecraft/
cd ~/stacks/minecraft
cp .env.example .env
nano .env                  # usernames, memory, versions
```

`MC_VERSION` and `FORGE_VERSION` must match the pack. The pack's page on CurseForge lists them,
and server packs usually include them in a file like `variables.txt`.

## 2. Add the modpack's server files

On CurseForge, open the modpack → **Files** → pick the version → download the **Server Pack**
(not the normal client file). Copy the zip to the server and unpack it into `data/`:

```bash
scp ServerFiles-*.zip you@server:~/stacks/minecraft/      # run this on your computer
unzip ServerFiles-*.zip -d data/                           # run this on the server
ls data/                                                   # mods/ must be directly inside data/
```

If `unzip` created one extra folder level (`data/ServerFiles-6.0/mods`), move its contents up:

```bash
mv data/ServerFiles-*/* data/ && rmdir data/ServerFiles-*
```

The image installs Forge itself, so the pack's own start scripts are not used.

## 3. Start it

```bash
docker compose up -d
docker compose logs -f     # first start takes several minutes; wait for "Done (...)! For help, type "help""
```

## Joining

1. Install the **same modpack version** on your computer (CurseForge app → modpack → Install).
2. Launch it → **Multiplayer → Add Server** → address `<server>:25565`
   (over Tailscale: the server's Tailscale name or `100.x.y.z` IP).

Friends on your tailnet need a policy grant for this port:

```json
{ "src": ["group:family"], "dst": ["<your-server>"], "ip": ["tcp:25565"] }
```

## Server console

`rcon-cli` sends commands to the running server (replace the name if you changed `CONTAINER_NAME`):

```bash
docker exec project-architect rcon-cli list                    # who's online
docker exec project-architect rcon-cli "forge tps"             # lag check: 20 TPS is perfect
docker exec project-architect rcon-cli "whitelist add Name"
docker exec project-architect rcon-cli "op Name"
docker exec project-architect rcon-cli "say Restarting in 5 minutes"
docker exec -it project-architect rcon-cli                     # interactive console (Ctrl+C to leave)
```

## If it lags

Check `forge tps` first. Below 18 TPS is noticeable. The usual fixes, in order:

1. Fewer chunks simulated around each player: add `SIMULATION_DISTANCE: 6` and `VIEW_DISTANCE: 10`
   under `environment:` in `docker-compose.yml`, then `docker compose up -d`.
2. Pre-generate the world around spawn with a pre-generation mod such as Chunky, so new chunks aren't built while people play.
3. More memory, only if the log shows long garbage-collection pauses.

## Backups

Stop the server first so the world is saved and consistent:

```bash
docker compose stop
tar czf ~/minecraft-world-$(date +%F).tar.gz -C data world
docker compose start
```

## Updating the modpack

Stop the server, back up `data/world`, unpack the new server files over `data/`
(delete the old `mods/` folder first so removed mods don't linger), update `FORGE_VERSION`
if the pack changed it, then `docker compose up -d`. Everyone must update their client too.

## Connecting it to serverdash

In `/etc/serverdash/config.json`:

```json
"minecraft_container": "project-architect",
"app_ports": { "25565": "Minecraft" }
```

## Useful commands

```bash
docker compose ps
docker compose logs --tail 100
docker compose restart
docker compose down        # stop (the world stays in ./data)
```
