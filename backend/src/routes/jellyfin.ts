// /api/jellyfin: Jellyfin accounts.
import { Router } from "express";
import { createJellyfinUser, deleteJellyfinUser, getJellyfinUsers } from "../models/jellyfin.ts";
import { httpError } from "../models/tailnet.ts";

export const jellyfinRouter = Router();

const USERNAME = /^[A-Za-z0-9._-]{2,32}$/;

// GET /api/jellyfin/users: every account and what it's allowed to do.
jellyfinRouter.get("/users", async (_req, res) => {
  res.json({ users: await getJellyfinUsers() });
});

// POST /api/jellyfin/users   body: { "username": "farabeed", "password": "..." }
jellyfinRouter.post("/users", async (req, res) => {
  const { username, password } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof username !== "string" || !USERNAME.test(username)) {
    throw httpError(400, "username: 2 to 32 letters, digits, dots, dashes or underscores");
  }
  if (typeof password !== "string" || password.length < 8) {
    throw httpError(400, "password: at least 8 characters");
  }
  res.status(201).json(await createJellyfinUser(username, password));
});

// DELETE /api/jellyfin/users/:username: any account except an admin.
jellyfinRouter.delete("/users/:username", async (req, res) => {
  res.json(await deleteJellyfinUser(req.params.username));
});