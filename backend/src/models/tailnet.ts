// People, groups and access rules on your tailnet, from the Tailscale API (not the database).
import { config } from "../config.ts";

// An ordinary Error with an HTTP status attached, e.g. 400. Express answers with that status.
export function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}


const API = "https://api.tailscale.com/api/v2";
const TAILNET = `/tailnet/${config.tailscale.tailnet}`;

// ---------------------------------------------------------------- signing in

// The OAuth client's id and secret are traded for an access token that lasts about an hour.
// Keep it, and only ask for a new one shortly before it runs out.
let token = { value: "", expiresAt: 0 };

async function accessToken(): Promise<string> {
  if (Date.now() < token.expiresAt - 60_000) return token.value;
  const { clientId, clientSecret } = config.tailscale;
  if (!clientId || !clientSecret) {
    throw httpError(500, "Tailscale isn't set up: TS_CLIENT_ID and TS_CLIENT_SECRET are empty");
  }
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw httpError(502, `Tailscale rejected the OAuth client: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

// Call one API path, signed in with the token. Gives up after 10 seconds.
// If Tailscale says no, throw an HttpError with its reason.
async function call(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    method: options.method ?? "GET",
    headers: { Authorization: `Bearer ${await accessToken()}`, Accept: "application/json", ...options.headers },
    body: options.body,
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return res;

    // Tailscale explains failures as { message, data: [{ user, errors: [...] }] }
  const detail = (await res.json().catch(() => ({}))) as {
    message?: string;
    data?: { user?: string; errors?: string[] }[];
  };
  const why = (detail.data ?? []).flatMap((d) => (d.errors ?? []).map((e) => (d.user ? `${d.user}: ${e}` : e)));
  const reason = `Tailscale ${path}: HTTP ${res.status}${detail.message ? `: ${detail.message}` : ""}`
    + (why.length ? ` (${why.join("; ")})` : "");
    
  // 412: the policy changed since we read it. 400: Tailscale refused the change (e.g. a test failed).
  const status = res.status === 412 ? 409 : res.status === 400 ? 422 : 502;
  throw httpError(status, reason);
}

async function get<T>(path: string): Promise<T> {
  return (await (await call(path)).json()) as T;
}

// ---------------------------------------------------------------- users

export interface TailnetUser {
  id: string;
  displayName: string;
  loginName: string;      // the email or account they sign in with
  profilePicUrl: string;
  role: string;           // owner, admin, member...
  status: string;         // active, idle, suspended...
  type: string;           // "member": in your tailnet; "shared": only shared a device
  deviceCount: number;
  created: string;        // date, e.g. "2026-10-10T12:00:00Z"
  lastSeen: string;
}

export async function getUsers(): Promise<TailnetUser[]> {
  const body = await get<{ users: TailnetUser[] }>(`${TAILNET}/users`);
  return body.users;
}

// ---------------------------------------------------------------- the policy file

interface Grant {
  src: string[];          // who: emails or groups
  dst: string[];          // to which machines
  ip?: string[];          // which ports, e.g. "tcp:2283"
}

// We only change groups and grants. Everything else (tests, ssh...) is sent back as it was.
interface Policy {
  groups?: Record<string, string[]>;
  grants?: Grant[];
  [other: string]: unknown;
}

// Read the policy, with its version tag (ETag), so a save can't overwrite someone else's edit.
async function readPolicy(): Promise<{ policy: Policy; etag: string }> {
  const res = await call(`${TAILNET}/acl`);
  return { policy: (await res.json()) as Policy, etag: res.headers.get("etag") ?? "" };
}

// Save it. If-Match: Tailscale refuses if the policy changed since we read it.
// It also runs the policy's own tests, and refuses if any of them fail.
async function savePolicy(policy: Policy, etag: string): Promise<void> {
  await call(`${TAILNET}/acl`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "If-Match": etag },
    body: JSON.stringify(policy, null, 2),
  });
}

// does this rule give that port?
const givesPort = (g: Grant, port: number) =>
  (g.ip ?? []).some((p) => p === `tcp:${port}` || p === `${port}` || p === "*");

// is there a rule giving this group this port?
const hasRule = (grants: Grant[], group: string, port: number) =>
  grants.some((g) => g.src.includes(group) && givesPort(g, port));

// "immich" -> { name, port, group: "group:immich" }, or a 400 for anything else
type ServiceId = keyof typeof config.services;
function findService(id: string) {
  if (!Object.hasOwn(config.services, id)) {
    throw httpError(400, `Unknown service "${id}". Use one of: ${Object.keys(config.services).join(", ")}`);
  }
  return { ...config.services[id as ServiceId], group: `group:${id}` };
}

// ---------------------------------------------------------------- groups (read)

export interface ServiceGroup {
  id: string;            // "immich"
  name: string;          // "Immich"
  port: number;
  group: string;         // "group:immich"
  members: string[];     // emails in that group
  ruleExists: boolean;   // false: the group exists, but no rule gives it the port yet
}

export async function getServiceGroups() {
  const { policy } = await readPolicy();
  const groups = policy.groups ?? {};
  const grants = policy.grants ?? [];

  const services: ServiceGroup[] = Object.entries(config.services).map(([id, s]) => {
    const group = `group:${id}`;
    return { id, name: s.name, port: s.port, group, members: groups[group] ?? [], ruleExists: hasRule(grants, group, s.port) };
  });

  // groups that aren't a service's, e.g. an older "group:family"
  const serviceGroupNames = new Set(services.map((s) => s.group));
  const otherGroups = Object.fromEntries(
    Object.entries(groups).filter(([name]) => !serviceGroupNames.has(name)),
  );

  return { services, otherGroups };
}

// ---------------------------------------------------------------- access (write)

// Give `email` access to a service: add them to its group, and add the group's rule if missing.
export async function grantAccess(email: string, serviceId: string) {
  const service = findService(serviceId);
  if (!config.tailscale.server) throw httpError(500, "TS_SERVER isn't set: the server's Tailscale IP");

  const users = await getUsers();
  if (!users.some((u) => u.loginName.toLowerCase() === email)) {
    throw httpError(400, `${email} isn't on your tailnet. Invite them in Tailscale first.`);
  }

  const { policy, etag } = await readPolicy();
  const groups = (policy.groups ??= {});
  const grants = (policy.grants ??= []);
  const members = groups[service.group] ?? [];

  const isMember = members.some((m) => m.toLowerCase() === email);
  const ruleMissing = !hasRule(grants, service.group, service.port);
  if (isMember && !ruleMissing) return { changed: false, email, service: serviceId };

  if (!isMember) groups[service.group] = [...members, email];
  if (ruleMissing) {
    grants.push({ src: [service.group], dst: [config.tailscale.server], ip: [`tcp:${service.port}`] });
  }
  await savePolicy(policy, etag);
  return { changed: true, email, service: serviceId };
}

// Take `email` out of a service's group. Reports any other way they can still reach it.
export async function revokeAccess(email: string, serviceId: string) {
  const service = findService(serviceId);
  const { policy, etag } = await readPolicy();
  const groups = policy.groups ?? {};
  const grants = policy.grants ?? [];

  const members = groups[service.group] ?? [];
  const remaining = members.filter((m) => m.toLowerCase() !== email);
  const changed = remaining.length < members.length;
  if (changed) {
    groups[service.group] = remaining;
    policy.groups = groups;
    await savePolicy(policy, etag);
  }

  // other rules that still let them in: directly by email, through another group, or "*" (everyone)
  const isIn = (src: string) =>
    src === "*" || src.toLowerCase() === email || (groups[src] ?? []).some((m) => m.toLowerCase() === email);
  const stillAllowedBy = grants
    .filter((g) => givesPort(g, service.port))
    .flatMap((g) => g.src)
    .filter((src) => isIn(src));

  return { changed, email, service: serviceId, stillAllowedBy };
}