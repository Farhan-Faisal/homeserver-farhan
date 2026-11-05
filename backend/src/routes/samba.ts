// /api/samba: Samba accounts. Each person gets a private folder, /srv/data/files/<username>.
import { Router } from "express";
import { createSambaUser, getSambaUsers, USERNAME } from "../models/samba.ts";
import { httpError } from "../models/tailnet.ts";

export const sambaRouter = Router();

// GET /api/samba/users: everyone who has a Samba login.
sambaRouter.get("/users", async (_req, res) => {
  res.json({ users: await getSambaUsers() });
});

// POST /api/samba/users   body: { "username": "farabeed", "password": "..." }
sambaRouter.post("/users", async (req, res) => {
  const { username, password } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof username !== "string" || !USERNAME.test(username)) {
    throw httpError(400, "username: 2 to 32 lowercase letters, digits or dashes, starting with a letter");
  }
  if (typeof password !== "string" || password.length < 8 || /[\r\n]/.test(password)) {
    throw httpError(400, "password: at least 8 characters, on one line");
  }
  res.status(201).json(await createSambaUser(username, password));
});