// Chart data. 

import { db } from "../db.ts";

export interface MetricPoint {
  t: number;                 // Unix seconds (for a slot: when it starts)
  cpu: number | null;        // % of all cores in use
  mem: number | null;        // % of RAM in use
  tcpu: number | null;       // CPU °C
  tgpu: number | null;       // GPU °C
  gpu: number | null;        // GPU busy %
  rx: number | null;         // download, bytes per second
  tx: number | null;         // upload, bytes per second
  tcpu_max?: number | null;  // slots only: hottest CPU reading in the slot
}

// How far back each range goes, and how wide each point is (0 = every sample).
export const RANGES = {
  "1h":  { seconds: 3_600,        slot: 0 },        // 360 points
  "24h": { seconds: 86_400,       slot: 300 },      // 5 minutes:  288 points
  "7d":  { seconds: 7 * 86_400,   slot: 1_800 },    // 30 minutes: 336 points
  "30d": { seconds: 30 * 86_400,  slot: 7_200 },    // 2 hours:    360 points
  "1y":  { seconds: 365 * 86_400, slot: 86_400 },   // 1 day:      365 points
} as const;
export type Range = keyof typeof RANGES;

// true for "1h", "24h"... and false for anything else, e.g. from a URL like ?range=abc
export function isRange(value: unknown): value is Range {
  return typeof value === "string" && Object.hasOwn(RANGES, value);
}

const everySample = db.prepare<[number], MetricPoint>(
  "SELECT t, cpu, mem, tcpu, tgpu, gpu, rx, tx FROM metrics WHERE t >= ? ORDER BY t",
);

// Averages over each slot. tcpu_max keeps the hottest reading, because an average hides spikes.
const bySlot = db.prepare<{ slot: number; since: number }, MetricPoint>(`
  SELECT CAST(r.t / @slot AS INTEGER) * @slot AS t,
         ROUND(AVG(r.cpu), 1) AS cpu,   ROUND(AVG(r.mem), 1) AS mem,
         ROUND(AVG(r.tcpu), 1) AS tcpu, ROUND(AVG(r.tgpu), 1) AS tgpu,
         ROUND(AVG(r.gpu), 1) AS gpu,
         ROUND(AVG(r.rx)) AS rx,        ROUND(AVG(r.tx)) AS tx,
         MAX(r.tcpu_max) AS tcpu_max
  FROM rollups r
  WHERE r.t >= @since
  GROUP BY CAST(r.t / @slot AS INTEGER)
  ORDER BY 1
`);

export function getMetrics(range: Range): MetricPoint[] {
  const { seconds, slot } = RANGES[range];
  const since = Math.floor(Date.now() / 1000) - seconds;
  return slot === 0 ? everySample.all(since) : bySlot.all({ slot, since });
}