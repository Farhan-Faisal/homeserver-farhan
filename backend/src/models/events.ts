// Alerts, with when each started and ended.
import { db } from "../db.ts";

export interface AlertEvent {
  id: number;
  level: "critical" | "warning" | "info";
  area: string;              // Temperature, Storage, Services...
  text: string;              // e.g. "CPU at 85 °C"
  started: number;           // Unix seconds
  ended: number | null;      // null while it's still happening
}

const COLUMNS = "id, level, area, text, started, ended";

const open = db.prepare<[], AlertEvent>(
  `SELECT ${COLUMNS} FROM events WHERE ended IS NULL ORDER BY started DESC`,
);
const recent = db.prepare<[number], AlertEvent>(
  `SELECT ${COLUMNS} FROM events ORDER BY started DESC LIMIT ?`,
);

// what's wrong right now
export function getOpenEvents(): AlertEvent[] {
  return open.all();
}

// the newest `limit` events, finished or not
export function getRecentEvents(limit: number): AlertEvent[] {
  return recent.all(limit);
}