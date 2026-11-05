// /api/jellyseerr: who can request movies and shows, and whether you have to approve each request.
import { Router } from "express";
import { createSeerrUser, getSeerrUsers, setApprovalRequired } from "../models/jellyseerr.ts";
import { httpError } from "../models/tailnet.ts";

export const jellyseerrRouter = Router();

// GET /api/jellyseerr/users
jellyseerrRouter.get("/users", async (_req, res) => {
  res.json({ users: await getSeerrUsers() });
});

// POST /api/jellyseerr/users   body: { "username": "farabeed", "approvalRequired": true }
// The username is their Jellyfin username. approvalRequired is optional and defaults to true.
jellyseerrRouter.post("/users", async (req, res) => {
  const { username, approvalRequired = true } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof username !== "string" || username === "") throw httpError(400, "username: their Jellyfin username");
  if (typeof approvalRequired !== "boolean") throw httpError(400, "approvalRequired: true or false");
  res.status(201).json(await createSeerrUser(username, approvalRequired));
});

// PATCH /api/jellyseerr/users/:username   body: { "approvalRequired": false }
jellyseerrRouter.patch("/users/:username", async (req, res) => {
  const { approvalRequired } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof approvalRequired !== "boolean") throw httpError(400, "approvalRequired: true or false");
  res.json(await setApprovalRequired(req.params.username, approvalRequired));
});