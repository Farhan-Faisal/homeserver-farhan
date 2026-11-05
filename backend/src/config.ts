export const config = {
  // Only nginx, on the same machine, talks to the API, so it never listens on the network.
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 8091),
  // The database the collector writes. The API only ever reads it.
  dbPath: process.env.DB_PATH ?? "/var/lib/serverdash/serverdash.db",

  // Tailscale API, through an OAuth client (admin console → Settings → OAuth clients).
  tailscale: {
    clientId: process.env.TS_CLIENT_ID ?? "",
    clientSecret: process.env.TS_CLIENT_SECRET ?? "",
    tailnet: process.env.TS_TAILNET ?? "-",  // "-" means the tailnet the client belongs to
    server: process.env.TS_SERVER ?? "",     // the server's Tailscale IP, used in new rules
  },

  // Jellyfin's API, through an API key from Dashboard → API Keys (these always have full admin rights).
  jellyfin: {
    url: process.env.JELLYFIN_URL ?? "http://127.0.0.1:8096",
    apiKey: process.env.JELLYFIN_API_KEY ?? "",
  },

  // Jellyseerr (Seerr): API key from Settings → General.
  jellyseerr: {
    url: process.env.JELLYSEERR_URL ?? "http://127.0.0.1:5055",
    apiKey: process.env.JELLYSEERR_API_KEY ?? "",
  },

  // Immich's admin API, through an admin's API key (adminUser.read, .create, .delete).
  immich: {
    url: process.env.IMMICH_URL ?? "http://127.0.0.1:2283",
    apiKey: process.env.IMMICH_API_KEY ?? "",
    maxQuotaGiB: 400,  // the whole Immich volume; no single account can be given more
  },

  // The only services anyone can be given access to. Each has a group in the
  // Tailscale policy file, "group:<id>", and one rule giving that group the port.
  services: {
    immich:     { name: "Immich",     port: 2283 },
    jellyfin:   { name: "Jellyfin",   port: 8096 },
    jellyseerr: { name: "Jellyseerr", port: 5055 },
    samba:      { name: "Samba",      port: 445 },
  },
};

if (!Number.isInteger(config.port)) {
  throw new Error(`PORT must be a whole number, got "${process.env.PORT}"`);
}