// GET /api/metrics?range=1h|24h|7d|30d|1y: chart data (1h if no range is given).
import { Router } from "express";
import { getMetrics, isRange, RANGES } from "../models/metrics.ts";

export const metricsRouter = Router();

metricsRouter.get("/", (req, res) => {
  const range = req.query.range ?? "1h";
  if (!isRange(range)) {
    res.status(400).json({ error: `range must be one of: ${Object.keys(RANGES).join(", ")}` });
    return;
  }
  res.json({ range, points: getMetrics(range) });
});