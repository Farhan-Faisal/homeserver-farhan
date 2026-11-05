// /api/immich: Immich photo accounts.
import { Router } from "express";
import { config } from "../config.ts";
import { createImmichUser, deleteImmichUser, getImmichUsers } from "../models/immich.ts";
import { httpError } from "../models/tailnet.ts";

export const immichRouter = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/immich/users: every account, with its storage limit and how much is used.
immichRouter.get("/users", async (_req, res) => {
  res.json({ users: await getImmichUsers() });
});

// POST /api/immich/users   body: { "email", "name", "password", "quotaGiB" }
immichRouter.post("/users", async (req, res) => {
  const { email, name, password, quotaGiB } = (req.body ?? {}) as Record<string, unknown>;
  const max = config.immich.maxQuotaGiB;
  if (typeof email !== "string" || !EMAIL.test(email)) {
    throw httpError(400, "email: a valid address (it's what they log in with)");
  }
  if (typeof name !== "string" || name.trim() === "") {
    throw httpError(400, "name: their name, as Immich shows it");
  }
  if (typeof password !== "string" || password.length < 8) {
    throw httpError(400, "password: at least 8 characters");
  }
  if (typeof quotaGiB !== "number" || !(quotaGiB > 0) || quotaGiB > max) {
    throw httpError(400, `quotaGiB: a number above 0 and at most ${max}`);
  }
  res.status(201).json(await createImmichUser(email.trim().toLowerCase(), name.trim(), password, quotaGiB));
});

// DELETE /api/immich/users/:email: only if they have no photos or videos backed up.
immichRouter.delete("/users/:email", async (req, res) => {
  res.json(await deleteImmichUser(req.params.email.toLowerCase()));
});