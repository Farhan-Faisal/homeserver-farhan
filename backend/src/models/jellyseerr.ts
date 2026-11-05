// Jellyseerr (Seerr) accounts: who can request movies and shows, and whether you must approve them.
// Accounts are linked to Jellyfin accounts, so a Jellyfin account has to exist first.
import { config } from "../config.ts";
import { getJellyfinUserId } from "./jellyfin.ts";
import { httpError } from "./tailnet.ts";

// Seerr keeps all of a user's permissions in one number, one bit each. The ones we use:
const ADMIN = 2;
const REQUEST = 32;
const AUTO_APPROVE = 128;          // every request
const AUTO_APPROVE_MOVIE = 256;
const AUTO_APPROVE_TV = 512;
const ANY_AUTO_APPROVE = AUTO_APPROVE | AUTO_APPROVE_MOVIE | AUTO_APPROVE_TV;

// Call Seerr's API. If it says no, throw an httpError with its reason.
async function seerr<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!config.jellyseerr.apiKey) throw httpError(500, "Jellyseerr isn't set up: JELLYSEERR_API_KEY is empty");
  const res = await fetch(`${config.jellyseerr.url}/api/v1${path}`, {
    method: options.method ?? "GET",
    headers: { "X-Api-Key": config.jellyseerr.apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 200);
    try { message = (JSON.parse(text) as { message?: string }).message ?? message; } catch { /* not JSON */ }
    throw httpError(res.status === 400 ? 400 : 502, `Jellyseerr ${path}: HTTP ${res.status}${message ? `: ${message}` : ""}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

// Seerr's user record (the parts we use)
interface SeerrUserDto {
  id: number;
  jellyfinUsername: string | null;
  displayName: string;
  permissions: number;
  requestCount: number;
  createdAt: string;
}

// What our API sends
export interface SeerrUser {
  username: string;
  isAdmin: boolean;
  approvalRequired: boolean;  // true: each request waits for you to approve it
  requestCount: number;
  createdAt: string;
}

function toUser(u: SeerrUserDto): SeerrUser {
  const isAdmin = (u.permissions & ADMIN) !== 0;
  return {
    username: u.jellyfinUsername ?? u.displayName,
    isAdmin,
    approvalRequired: !isAdmin && (u.permissions & AUTO_APPROVE) === 0,
    requestCount: u.requestCount,
    createdAt: u.createdAt,
  };
}

async function allUsers(): Promise<SeerrUserDto[]> {
  return (await seerr<{ results: SeerrUserDto[] }>("/user?take=1000")).results;
}

const findUser = async (username: string) =>
  (await allUsers()).find((u) => (u.jellyfinUsername ?? "").toLowerCase() === username.toLowerCase());

// A user's permissions with "may request" on, and auto-approve switched on or off.
// Every other permission they have is left exactly as it was.
function withApproval(permissions: number, approvalRequired: boolean): number {
  return approvalRequired
    ? (permissions | REQUEST) & ~ANY_AUTO_APPROVE
    : permissions | REQUEST | AUTO_APPROVE;
}

async function savePermissions(id: number, permissions: number) {
  await seerr(`/user/${id}/settings/permissions`, { method: "POST", body: { permissions } });
}

export async function getSeerrUsers(): Promise<SeerrUser[]> {
  return (await allUsers()).map(toUser);
}

// Make a Jellyseerr account from someone's Jellyfin account, with approval on or off.
export async function createSeerrUser(username: string, approvalRequired: boolean) {
  const jellyfinId = await getJellyfinUserId(username);
  if (!jellyfinId) {
    throw httpError(404, `${username} has no Jellyfin account. Create that first: POST /api/jellyfin/users`);
  }
  if (await findUser(username)) throw httpError(409, `${username} already has a Jellyseerr account`);

  const imported = await seerr<SeerrUserDto[]>("/user/import-from-jellyfin", {
    method: "POST",
    body: { jellyfinUserIds: [jellyfinId] },
  });
  const user = imported[0];
  if (!user) throw httpError(502, `Jellyseerr didn't import ${username}`);

  const permissions = withApproval(user.permissions, approvalRequired);
  await savePermissions(user.id, permissions);
  return toUser({ ...user, permissions });
}

// Switch approval on or off for one person. Admin accounts are never changed.
export async function setApprovalRequired(username: string, approvalRequired: boolean) {
  const user = await findUser(username);
  if (!user) throw httpError(404, `${username} has no Jellyseerr account`);
  if (user.permissions & ADMIN) throw httpError(409, `${username} is an admin account; not changing it`);

  const permissions = withApproval(user.permissions, approvalRequired);
  await savePermissions(user.id, permissions);
  return toUser({ ...user, permissions });
}