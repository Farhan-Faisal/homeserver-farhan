import { useEffect, useState } from "react";

// GET /api/<path> and return the JSON. If the answer isn't a success, throw the API's error message.
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { cache: "no-store" });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

// Fetch a path now, then again every `everyMs`, but only while the tab is visible.
export function usePoll<T>(path: string, everyMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);  // bumping it reloads now

  useEffect(() => {
    let stopped = false;  // set when the page changes, so a late answer is ignored

    async function load() {
      if (document.hidden) return;  // nobody is looking: don't load
      try {
        const next = await apiGet<T>(path);
        if (!stopped) { setData(next); setError(null); }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      }
    }

    load();
    const timer = setInterval(load, everyMs);
    document.addEventListener("visibilitychange", load);  // load at once when the tab is shown again
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [path, everyMs, tick]);

  return { data, error, reload: () => setTick((t) => t + 1) };
}

// POST, PATCH or DELETE /api/<path> with a JSON body. Throws the API's error message on failure.
export async function apiSend<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

// The current time in seconds, updated every second, for things like "updated 4 s ago".
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now / 1000;
}