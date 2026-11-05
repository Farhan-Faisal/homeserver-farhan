// GET /api/events             the newest 50 alerts, finished or not
// GET /api/events?open=true   only the ones happening now
// GET /api/events?limit=200   more of them (at most 500)
import { Router } from "express";
import { getOpenEvents, getRecentEvents } from "../models/events.ts";

export const eventsRouter = Router();

const MAX_LIMIT = 500;

eventsRouter.get("/", (req, res) => {
  if (req.query.open === "true") {
    res.json({ events: getOpenEvents() });
    return;
  }
  const limit = Number(req.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    res.status(400).json({ error: `limit must be a whole number from 1 to ${MAX_LIMIT}` });
    return;
  }
  res.json({ events: getRecentEvents(limit) });
});