// Jellyfin accounts, through Jellyfin's API.
import { config } from "../config.ts";
import { httpError } from "./tailnet.ts";

// Call Jellyfin's API. If Jellyfin says no, throw an httpError with its reason.
async function jellyfin<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!config.jellyfin.apiKey) throw httpError(500, "Jellyfin isn't set up: JELLYFIN_API_KEY is empty");
  const res = await fetch(`${config.jellyfin.url}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `MediaBrowser Token="${config.jellyfin.apiKey}"`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();  // some answers have no body at all
  if (!res.ok) {
    throw httpError(res.status === 400 ? 400 : 502, `Jellyfin ${path}: HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

// What a family account may do. Everything else stays as Jellyfin sets it for a new user.
const FAMILY_POLICY = {
  IsAdministrator: false,
  IsDisabled: false,
  EnableAllFolders: true,                  // can see every library
  EnableContentDeletion: false,            // can't delete movies or shows
  EnableContentDownloading: true,          // can download to watch offline
  EnableRemoteControlOfOtherUsers: false,
  EnableSharedDeviceControl: false,
  EnableLiveTvManagement: false,
  EnableCollectionManagement: false,
  EnableSubtitleManagement: false,
};

// Jellyfin's user record (the parts we use). Its policy has many more settings.
interface JellyfinPolicy {
  IsAdministrator: boolean;
  IsDisabled: boolean;
  EnableAllFolders: boolean;
  EnableContentDeletion: boolean;
  EnableContentDownloading: boolean;
  [other: string]: unknown;
}
interface JellyfinUserDto {
  Id: string;
  Name: string;
  LastLoginDate?: string;
  LastActivityDate?: string;
  Policy: JellyfinPolicy;
}

// What our API sends
export interface JellyfinUser {
  username: string;
  isAdmin: boolean;
  disabled: boolean;
  allLibraries: boolean;
  canDownload: boolean;
  canDelete: boolean;
  lastLogin: string | null;
  lastActive: string | null;
}

function toUser(u: JellyfinUserDto): JellyfinUser {
  return {
    username: u.Name,
    isAdmin: u.Policy.IsAdministrator,
    disabled: u.Policy.IsDisabled,
    allLibraries: u.Policy.EnableAllFolders,
    canDownload: u.Policy.EnableContentDownloading,
    canDelete: u.Policy.EnableContentDeletion,
    lastLogin: u.LastLoginDate ?? null,
    lastActive: u.LastActivityDate ?? null,
  };
}

async function allUsers(): Promise<JellyfinUserDto[]> {
  return jellyfin<JellyfinUserDto[]>("/Users");
}

const findUser = async (username: string) =>
  (await allUsers()).find((u) => u.Name.toLowerCase() === username.toLowerCase());

export async function getJellyfinUsers(): Promise<JellyfinUser[]> {
  return (await allUsers()).map(toUser);
}

export async function createJellyfinUser(username: string, password: string) {
  if (await findUser(username)) throw httpError(409, `${username} already has a Jellyfin account`);

  const user = await jellyfin<JellyfinUserDto>("/Users/New", {
    method: "POST",
    body: { Name: username, Password: password },
  });

  // Jellyfin wants the whole policy back, so start from the new account's own and change our settings.
  const policy = { ...user.Policy, ...FAMILY_POLICY };
  try {
    await jellyfin(`/Users/${user.Id}/Policy`, { method: "POST", body: policy });
  } catch (error) {
    await jellyfin(`/Users/${user.Id}`, { method: "DELETE" });  // don't leave a half-set-up account
    throw error;
  }
  return toUser({ ...user, Policy: policy });
}

// Deletes any account except an admin.
export async function deleteJellyfinUser(username: string) {
  const user = await findUser(username);
  if (!user) throw httpError(404, `No Jellyfin account called ${username}`);
  if (user.Policy.IsAdministrator) throw httpError(409, `${username} is an admin account; not deleting it`);
  await jellyfin(`/Users/${user.Id}`, { method: "DELETE" });
  return { deleted: true, username: user.Name };
}

// The Jellyfin id of an account, or null if there's no such user. Jellyseerr links accounts by it.
export async function getJellyfinUserId(username: string): Promise<string | null> {
  return (await findUser(username))?.Id ?? null;
}