// GET /api/health: is the API up, and is the collector still writing?
import { Router } from "express";
import { getLatest } from "../models/status.ts";

export const healthRouter = Router();

// The collector writes every 10 s. A newest sample older than this means it has stopped.
const STALE_AFTER = 60;

healthRouter.get("/", (_req, res) => {
  const latest = getLatest();
  const age = latest ? Math.round(Date.now() / 1000 - latest.generated_at) : null;
  const ok = age !== null && age < STALE_AFTER;
  res.status(ok ? 200 : 503).json({ ok, age_seconds: age });
});