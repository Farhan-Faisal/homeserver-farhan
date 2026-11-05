// /api/tailnet: people on your Tailscale network, and who can reach which service.
import { Router } from "express";

import { 
    getServiceGroups, 
    getUsers, 
    grantAccess, 
    httpError, 
    revokeAccess 
} from "../models/tailnet.ts";

export const tailnetRouter = Router();

// GET /api/tailnet/users: everyone on your Tailscale network.
tailnetRouter.get("/users", async (_req, res) => {
  res.json({ users: await getUsers() });
});

// GET /api/tailnet/groups: each service, its group, and who's in it.
tailnetRouter.get("/groups", async (_req, res) => {
  res.json(await getServiceGroups());
});

// Both write routes take the same body: { "email": "...", "service": "immich" }
function readAccessBody(body: unknown) {
  const { email, service } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof service !== "string") {
    throw httpError(400, 'Send JSON like { "email": "someone@gmail.com", "service": "immich" }');
  }
  return { email: email.trim().toLowerCase(), service };
}

// POST /api/tailnet/access: give that person that service.
tailnetRouter.post("/access", async (req, res) => {
  const { email, service } = readAccessBody(req.body);
  res.json(await grantAccess(email, service));
});

// DELETE /api/tailnet/access: take it away again.
tailnetRouter.delete("/access", async (req, res) => {
  const { email, service } = readAccessBody(req.body);
  res.json(await revokeAccess(email, service));
});