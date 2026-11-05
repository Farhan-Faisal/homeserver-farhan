// Immich photo accounts, through Immich's admin API.
import { config } from "../config.ts";
import { httpError } from "./tailnet.ts";

const GiB = 1024 ** 3;

// Call Immich's API. If Immich says no, throw an httpError with its reason.
async function immich<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!config.immich.apiKey) throw httpError(500, "Immich isn't set up: IMMICH_API_KEY is empty");
  const res = await fetch(`${config.immich.url}/api${path}`, {
    method: options.method ?? "GET",
    headers: { "x-api-key": config.immich.apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Immich explains errors as { "message": "..." } (sometimes a list of messages)
    const detail = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = [detail.message ?? []].flat().join("; ");
    throw httpError(res.status === 400 ? 400 : 502, `Immich ${path}: HTTP ${res.status}${message ? `: ${message}` : ""}`);
  }
  const text = await res.text();  // some answers have no body at all
  return (text ? JSON.parse(text) : undefined) as T;
}

// Immich's user record (the parts we use)
interface ImmichAdminUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  quotaSizeInBytes: number | null;   // null = no limit
  quotaUsageInBytes: number | null;
  status: string;                    // active, removing, deleted
  createdAt: string;
}

// What our API sends: sizes in GiB, no internal ids
export interface ImmichUser {
  email: string;
  name: string;
  isAdmin: boolean;
  quotaGiB: number | null;           // null = no limit
  usedGiB: number;
  status: string;
  createdAt: string;
}

const toGiB = (bytes: number) => Math.round((bytes / GiB) * 100) / 100;  // 2 decimals

function toUser(u: ImmichAdminUser): ImmichUser {
  return {
    email: u.email,
    name: u.name,
    isAdmin: u.isAdmin,
    quotaGiB: u.quotaSizeInBytes === null ? null : toGiB(u.quotaSizeInBytes),
    usedGiB: toGiB(u.quotaUsageInBytes ?? 0),
    status: u.status,
    createdAt: u.createdAt,
  };
}

async function allUsers(): Promise<ImmichAdminUser[]> {
  return immich<ImmichAdminUser[]>("/admin/users");
}

export async function getImmichUsers(): Promise<ImmichUser[]> {
  return (await allUsers()).map(toUser);
}

export async function createImmichUser(email: string, name: string, password: string, quotaGiB: number) {
  if ((await allUsers()).some((u) => u.email.toLowerCase() === email)) {
    throw httpError(409, `${email} already has an Immich account`);
  }
  const user = await immich<ImmichAdminUser>("/admin/users", {
    method: "POST",
    body: {
      email,
      name,
      password,
      quotaSizeInBytes: Math.round(quotaGiB * GiB),
      shouldChangePassword: true,  // they pick their own password at first login
    },
  });
  return toUser(user);
}

// Only deletes an account with nothing backed up, and never an admin.
export async function deleteImmichUser(email: string) {
  const user = (await allUsers()).find((u) => u.email.toLowerCase() === email);
  if (!user) throw httpError(404, `No Immich account for ${email}`);
  if (user.isAdmin) throw httpError(409, `${email} is an admin account; not deleting it`);

  const stats = await immich<{ total: number }>(`/admin/users/${user.id}/statistics`);
  if (stats.total > 0 || (user.quotaUsageInBytes ?? 0) > 0) {
    throw httpError(409, `${email} has ${stats.total} photos and videos backed up; not deleting`);
  }

  await immich(`/admin/users/${user.id}`, { method: "DELETE", body: { force: false } });
  return {
    deleted: true,
    email,
    note: "Immich removes the account for good after its grace period (7 days by default). Until then it can be restored in Administration → Users.",
  };
}