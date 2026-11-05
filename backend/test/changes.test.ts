// Create, change, then clean up, against the real services. Only runs with RUN_CHANGES=1
// (npm run test:changes). Every test removes what it made, even if it fails halfway.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { api, useServer } from "./helpers.ts";

useServer();

const RUN = process.env.RUN_CHANGES === "1";
const NAME = `sdtest-${Date.now() % 100000}`;  // a fresh name every run
const PASSWORD = "testpass123";

// Jellyseerr has no delete route in our API, so tests clean up through Seerr directly.
async function deleteFromSeerr(username: string) {
  const headers = { "X-Api-Key": process.env.JELLYSEERR_API_KEY ?? "" };
  const url = process.env.JELLYSEERR_URL;
  const list = (await (await fetch(`${url}/api/v1/user?take=1000`, { headers })).json()) as { results: any[] };
  const user = list.results.find((u) => u.jellyfinUsername === username);
  if (user) await fetch(`${url}/api/v1/user/${user.id}`, { method: "DELETE", headers });
}

describe("changes", { skip: RUN ? false : "run with: npm run test:changes" }, () => {
  it("jellyfin: create an account, then delete it", async () => {
    try {
      const made = await api("POST", "/jellyfin/users", { username: NAME, password: PASSWORD });
      assert.equal(made.status, 201);
      assert.equal(made.body.isAdmin, false);
      assert.equal(made.body.canDelete, false);
    } finally {
      assert.equal((await api("DELETE", `/jellyfin/users/${NAME}`)).status, 200);
    }
  });

  it("immich: create an account with a quota, then delete it", async () => {
    const email = `${NAME}@example.com`;
    try {
      const made = await api("POST", "/immich/users", { email, name: NAME, password: PASSWORD, quotaGiB: 1 });
      assert.equal(made.status, 201);
      assert.equal(made.body.quotaGiB, 1);
    } finally {
      assert.equal((await api("DELETE", `/immich/users/${email}`)).status, 200);
    }
  });

  it("jellyseerr: import from Jellyfin, switch approval off and on, then remove", async () => {
    try {
      assert.equal((await api("POST", "/jellyfin/users", { username: NAME, password: PASSWORD })).status, 201);
      const made = await api("POST", "/jellyseerr/users", { username: NAME });
      assert.equal(made.status, 201);
      assert.equal(made.body.approvalRequired, true);

      const off = await api("PATCH", `/jellyseerr/users/${NAME}`, { approvalRequired: false });
      assert.equal(off.body.approvalRequired, false);
      const on = await api("PATCH", `/jellyseerr/users/${NAME}`, { approvalRequired: true });
      assert.equal(on.body.approvalRequired, true);
    } finally {
      await deleteFromSeerr(NAME);
      await api("DELETE", `/jellyfin/users/${NAME}`);
    }
  });

  it("tailscale: take one person's Jellyseerr access away, then give it back", async (t) => {
    const groups = await api("GET", "/tailnet/groups");
    const member: string | undefined = groups.body.services.find((s: any) => s.id === "jellyseerr")?.members[0];
    if (!member) return t.skip("nobody is in group:jellyseerr");

    const body = { email: member, service: "jellyseerr" };
    try {
      const revoked = await api("DELETE", "/tailnet/access", body);
      assert.equal(revoked.status, 200);
      assert.equal(revoked.body.changed, true);
    } finally {
      const granted = await api("POST", "/tailnet/access", body);
      assert.equal(granted.status, 200);
    }
    const after = await api("GET", "/tailnet/groups");
    assert.ok(after.body.services.find((s: any) => s.id === "jellyseerr").members.includes(member));
  });
});