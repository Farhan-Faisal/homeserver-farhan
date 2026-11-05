// Every GET route answers, with the data you'd expect. Changes nothing.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { api, OWNER, useServer } from "./helpers.ts";

useServer();

describe("dashboard data", () => {
  it("health: ok, and the collector wrote in the last minute", async () => {
    const r = await api("GET", "/health");
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.age_seconds < 60);
  });

  it("status: the latest sample", async () => {
    const r = await api("GET", "/status");
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.generated_at, "number");
  });

  it("metrics: every range answers with a list of points", async () => {
    for (const range of ["1h", "24h", "7d", "30d", "1y"]) {
      const r = await api("GET", `/metrics?range=${range}`);
      assert.equal(r.status, 200, range);
      assert.equal(r.body.range, range);
      assert.ok(Array.isArray(r.body.points), range);
    }
  });

  it("metrics: no range means 1h", async () => {
    const r = await api("GET", "/metrics");
    assert.equal(r.body.range, "1h");
  });

  it("events: recent ones, and open ones only", async () => {
    const recent = await api("GET", "/events?limit=5");
    assert.equal(recent.status, 200);
    assert.ok(recent.body.events.length <= 5);
    const open = await api("GET", "/events?open=true");
    assert.ok(open.body.events.every((e: any) => e.ended === null));
  });

  it("an unknown address is a 404", async () => {
    assert.equal((await api("GET", "/nope")).status, 404);
  });
});

describe("tailscale", () => {
  it("users: you're the owner", async () => {
    const r = await api("GET", "/tailnet/users");
    assert.equal(r.status, 200);
    const me = r.body.users.find((u: any) => u.loginName === OWNER.email);
    assert.equal(me?.role, "owner");
  });

  it("groups: all four services are listed", async () => {
    const r = await api("GET", "/tailnet/groups");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.services.map((s: any) => s.id), ["immich", "jellyfin", "jellyseerr", "samba"]);
  });
});

describe("accounts", () => {
  it("samba: you have an account", async () => {
    const r = await api("GET", "/samba/users");
    assert.equal(r.status, 200);
    assert.ok(r.body.users.includes(OWNER.username));
  });

  it("immich: you're an admin", async () => {
    const r = await api("GET", "/immich/users");
    assert.equal(r.status, 200);
    assert.equal(r.body.users.find((u: any) => u.email === OWNER.email)?.isAdmin, true);
  });

  it("jellyfin: you're an admin", async () => {
    const r = await api("GET", "/jellyfin/users");
    assert.equal(r.status, 200);
    assert.equal(r.body.users.find((u: any) => u.username === OWNER.username)?.isAdmin, true);
  });

  it("jellyseerr: you're an admin", async () => {
    const r = await api("GET", "/jellyseerr/users");
    assert.equal(r.status, 200);
    assert.equal(r.body.users.find((u: any) => u.username === OWNER.username)?.isAdmin, true);
  });
});