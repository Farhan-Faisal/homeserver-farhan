// The Express app: reads JSON bodies, mounts every router under /api, and turns errors into JSON.
// It doesn't listen on a port itself; server.ts does that.
import express from "express";
import type { ErrorRequestHandler } from "express";
import { healthRouter } from "./routes/health.ts";
import { statusRouter } from "./routes/status.ts";
import { metricsRouter } from "./routes/metrics.ts";
import { eventsRouter } from "./routes/events.ts";
import { tailnetRouter } from "./routes/tailnet.ts";
import { sambaRouter } from "./routes/samba.ts";
import { immichRouter } from "./routes/immich.ts";
import { jellyfinRouter } from "./routes/jellyfin.ts";
import { jellyseerrRouter } from "./routes/jellyseerr.ts";

export const app = express();

app.disable("x-powered-by");                // don't announce "Express" in every response
app.use(express.json({ limit: "10kb" }));   // read JSON request bodies into req.body (small ones only)

app.use("/api/health", healthRouter);
app.use("/api/status", statusRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/tailnet", tailnetRouter);
app.use("/api/samba", sambaRouter);    
app.use("/api/immich", immichRouter);
app.use("/api/jellyfin", jellyfinRouter);
app.use("/api/jellyseerr", jellyseerrRouter);

// any address that matched nothing above
app.use((_req, res) => {
  res.status(404).json({ error: "No such endpoint" });
});


// Every error thrown in a route ends up here, async ones included (Express 5 catches those).
// Errors with a status (httpError, bad JSON) are sent as they are; anything else is a bug: log it.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (typeof err.status === "number") {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal error" });
};
app.use(errorHandler);