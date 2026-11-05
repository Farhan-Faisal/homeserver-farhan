// Bad requests are refused with the right status code, before anything is changed.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { api, OWNER, useServer } from "./helpers.ts";

useServer();

const PASSWORD = "testpass123";

describe("tailscale access", () => {
  it("an unknown service: 400", async () => {
    const r = await api("POST", "/tailnet/access", { email: OWNER.email, service: "ssh" });
    assert.equal(r.status, 400);
  });
  it("someone not on your tailnet: 400", async () => {
    const r = await api("POST", "/tailnet/access", { email: "nobody@example.com", service: "immich" });
    assert.equal(r.status, 400);
  });
  it("missing fields: 400", async () => {
    assert.equal((await api("POST", "/tailnet/access", {})).status, 400);
    assert.equal((await api("DELETE", "/tailnet/access", { email: OWNER.email })).status, 400);
  });
});

describe("samba", () => {
  it("a bad username: 400", async () => {
    assert.equal((await api("POST", "/samba/users", { username: "Bad Name", password: PASSWORD })).status, 400);
  });
  it("a short password: 400", async () => {
    assert.equal((await api("POST", "/samba/users", { username: "someone", password: "short" })).status, 400);
  });
  it("an existing account (yours): 409", async () => {
    assert.equal((await api("POST", "/samba/users", { username: OWNER.username, password: PASSWORD })).status, 409);
  });
  it("a system account (root): 409", async () => {
    assert.equal((await api("POST", "/samba/users", { username: "root", password: PASSWORD })).status, 409);
  });
});

describe("immich", () => {
  it("a bad email: 400", async () => {
    const r = await api("POST", "/immich/users", { email: "nope", name: "X", password: PASSWORD, quotaGiB: 1 });
    assert.equal(r.status, 400);
  });
  it("a quota over the limit: 400", async () => {
    const r = await api("POST", "/immich/users", { email: "x@example.com", name: "X", password: PASSWORD, quotaGiB: 5000 });
    assert.equal(r.status, 400);
  });
  it("an existing account (yours): 409", async () => {
    const r = await api("POST", "/immich/users", { email: OWNER.email, name: "X", password: PASSWORD, quotaGiB: 1 });
    assert.equal(r.status, 409);
  });
  it("won't delete an admin (you): 409", async () => {
    assert.equal((await api("DELETE", `/immich/users/${OWNER.email}`)).status, 409);
  });
  it("deleting someone who doesn't exist: 404", async () => {
    assert.equal((await api("DELETE", "/immich/users/nobody@example.com")).status, 404);
  });
});

describe("jellyfin", () => {
  it("a bad username: 400", async () => {
    assert.equal((await api("POST", "/jellyfin/users", { username: "bad name!", password: PASSWORD })).status, 400);
  });
  it("an existing account (yours, any case): 409", async () => {
    const r = await api("POST", "/jellyfin/users", { username: OWNER.username.toUpperCase(), password: PASSWORD });
    assert.equal(r.status, 409);
  });
  it("won't delete an admin (you): 409", async () => {
    assert.equal((await api("DELETE", `/jellyfin/users/${OWNER.username}`)).status, 409);
  });
});

describe("jellyseerr", () => {
  it("no Jellyfin account: 404", async () => {
    assert.equal((await api("POST", "/jellyseerr/users", { username: "nobody" })).status, 404);
  });
  it("an existing account (yours): 409", async () => {
    assert.equal((await api("POST", "/jellyseerr/users", { username: OWNER.username })).status, 409);
  });
  it("won't change an admin (you): 409", async () => {
    const r = await api("PATCH", `/jellyseerr/users/${OWNER.username}`, { approvalRequired: true });
    assert.equal(r.status, 409);
  });
  it("approvalRequired must be true or false: 400", async () => {
    const r = await api("PATCH", `/jellyseerr/users/${OWNER.username}`, { approvalRequired: "yes" });
    assert.equal(r.status, 400);
  });
});