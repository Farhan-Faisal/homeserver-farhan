// The parts of /api/status the pages use. A probe that failed comes back null, so most are optional.
export type Level = "critical" | "warning" | "info";
export interface Alert { level: Level; area: string; text: string }

export interface Status {
  generated_at: number;
  interval: number;
  host?: { hostname?: string; uptime?: number; cores?: number; threads?: number; cpu_mhz?: number;
           os?: string; kernel?: string; boot_time?: number; reboot_required?: boolean } | null;
  cpu?: { total?: number } | null;
  memory?: { pct?: number; used?: number; total?: number } | null;
  temps?: { cpu?: number | null; nvme?: number | null } | null;
  gpu?: { gpus?: { name: string; util?: number; temp?: number; mem_used?: number; mem_total?: number }[] } | null;
  network?: { name: string; up: boolean; rx_bps: number | null; tx_bps: number | null; wireless?: boolean; ssid?: string | null }[] | null;
  containers?: Container[] | null;
  tailscale?: { state?: string; tailnet?: string; self?: Device; peers?: Device[] } | null;
  connections?: Connection[] | null;
  logins?: Login[] | null;
  samba?: SambaSession[] | null;
  jellyfin?: { ok: boolean; sessions: JellyfinSession[] } | null;
  alerts?: Alert[] | null;
  thresholds?: { cpu_temp?: [number, number]; mem_pct?: [number, number]; gpu_temp?: [number, number];
                 nvme_temp?: [number, number]; hdd_temp?: [number, number]; disk_pct?: [number, number] };
  filesystems?: Filesystem[] | null;
  page?: { samba_share?: string; data_mount?: string };
  disks?: Disk[] | null;
  smart?: Record<string, Smart> | null;       // by drive name, e.g. "sda"
  disk_io?: Record<string, DiskIO> | null;
  folders?: { folders: { path: string; bytes: number | null }[] } | null;
  systemd?: { units: Unit[]; failed: string[] } | null;
  critical_units?: string[];
  updates?: { total: number; security: number } | null;
}

export interface Filesystem {
  device: string; mount: string; label: string | null;
  total: number; used: number; avail: number; pct: number | null;
  disk?: string;                // the drive it's on, e.g. "sda" (not set for volume files)
  backing_file?: string;        // a volume that lives inside a file, like the Immich one
  backing_size?: number;        // its cap
  backing_allocated?: number;   // what it really takes on the drive
}

export interface MetricPoint {
  t: number;
  cpu: number | null; mem: number | null; tcpu: number | null; tgpu: number | null;
  gpu: number | null; rx: number | null; tx: number | null;
  tcpu_max?: number | null;
}

// One device on your tailnet (from `tailscale status`)
export interface Device {
  host: string | null;
  dns: string | null;          // its name on the tailnet, e.g. "farhans-macbook-pro"
  os: string | null;           // macOS, iOS, android, linux, windows...
  ips: string[];
  online: boolean;
  last_seen: number | null;
  owner_login: string | null;  // the account it belongs to
  owner_name: string | null;
  conn: string | null;         // "direct", "relay (…)", or null if idle
}

export interface Connection { service: string; ip: string; count: number }  // e.g. Immich from 100.x
export interface Login { user: string; since: string; from: string | null }   // SSH sessions
export interface SambaSession { user: string; ip: string; shares: string[] }
export interface JellyfinSession {
  user: string | null; device: string | null; ip: string | null;
  playing: string | null; paused: boolean | null;
}

// One Immich account, as /api/immich/users sends it
export interface ImmichUser {
  email: string;
  name: string;
  isAdmin: boolean;
  quotaGiB: number | null;   // null = no limit
  usedGiB: number;
  status: string;            // active, removing, deleted
  createdAt: string;
}

export interface Disk { name: string; model: string | null; rotational: boolean; size: number }

// A drive's self-check (SMART). HDDs and SATA SSDs report sectors; NVMe SSDs report wear.
export interface Smart {
  model: string | null; passed: boolean; temp: number | null; power_on_hours: number | null;
  reallocated?: number | null; pending?: number | null; uncorrectable?: number | null;
  percentage_used?: number; media_errors?: number; written_bytes?: number;
}

export interface DiskIO { read_bps: number; write_bps: number; util: number }

export interface Container {
  name: string; image: string; project: string | null;
  state: string; health: string | null; exit_code: number; restarts: number;
  started_at: number | null; cpu?: number; mem?: number | null;
}

export interface Unit {
  unit: string; description: string; active: string; sub: string;
  since: number | null; restarts: number; on_demand?: boolean;
}

export interface AlertEvent { id: number; level: Level; area: string; text: string; started: number; ended: number | null }

// Someone on your tailnet, from /api/tailnet/users
export interface TailnetUser {
  id: string;
  displayName: string;
  loginName: string;      // the email they sign in with
  profilePicUrl: string;
  role: string;           // owner, admin, member...
  status: string;
  type: string;           // "member", or "shared" (only shared a device)
  deviceCount: number;
  created: string;
  lastSeen: string;
}

// A service, its group in the policy file, and who's in it (from /api/tailnet/groups)
export interface ServiceGroup {
  id: string; name: string; port: number; group: string;
  members: string[];
  ruleExists: boolean;    // false: no rule gives the group the port yet (granting adds it)
}

// What POST and DELETE /api/tailnet/access answer
export interface AccessResult { changed: boolean; email: string; service: string; stillAllowedBy?: string[] }

// A Jellyfin account and what it may do (from /api/jellyfin/users)
export interface JellyfinUser {
  username: string; isAdmin: boolean; disabled: boolean;
  allLibraries: boolean; canDownload: boolean; canDelete: boolean;
  lastLogin: string | null; lastActive: string | null;   // dates, or null if never
}

// A Jellyseerr account (from /api/jellyseerr/users). username is their Jellyfin username.
export interface SeerrUser {
  username: string; isAdmin: boolean;
  approvalRequired: boolean;   // true: each request waits for you
  requestCount: number; createdAt: string;
}

export type Range = "1h" | "24h" | "7d" | "30d" | "1y";
export const RANGES: Range[] = ["1h", "24h", "7d", "30d", "1y"];