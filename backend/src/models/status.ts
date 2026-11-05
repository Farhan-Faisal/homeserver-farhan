
import { db } from "../db.ts";

// It's big, and grows whenever a probe is added, so it's only typed loosely:
// any object, which always has generated_at (Unix seconds).
export type Sample = Record<string, unknown> & { generated_at: number };

const latest = db.prepare<[], { data: string }>("SELECT data FROM latest WHERE id = 1");

// null until the collector has written its first sample
export function getLatest(): Sample | null {
  const row = latest.get();
  return row ? (JSON.parse(row.data) as Sample) : null;
}