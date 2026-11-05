// GET /api/status: the newest full sample.
import { Router } from "express";
import { getLatest } from "../models/status.ts";

export const statusRouter = Router();

statusRouter.get("/", (_req, res) => {
  const sample = getLatest();
  if (!sample) {
    res.status(503).json({ error: "No data yet: the collector hasn't written a sample." });
    return;
  }
  res.json(sample);
});