"use client";
import { Laptop, Monitor, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import { useNow } from "@/lib/api";
import { fmtDuration } from "@/lib/format";
import type { Device } from "@/lib/types";
import { Avatar } from "./Avatar";

// What a device is doing right now: badges (Immich, Jellyfin...) and an optional "watching" line.
export interface Activity { services: string[]; watching: string | null }

export interface Person {
  name: string;
  login: string | null;
  devices: { device: Device; activity: Activity }[];
}

function deviceIcon(os: string | null): LucideIcon {
  const o = (os ?? "").toLowerCase();
  if (o === "ios" || o === "android") return Smartphone;
  if (o === "ipados") return Tablet;
  if (o === "macos" || o === "windows") return Laptop;
  return Monitor;
}

export function PersonCard({ person }: { person: Person }) {
  const now = useNow(10_000);
  const online = person.devices.filter((d) => d.device.online).length;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={person.name} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{person.name}</p>
          <p className="truncate text-xs text-zinc-500">{person.login}</p>
        </div>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          online ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-zinc-500/10 text-zinc-500"}`}>
          {online ? `${online} online` : "offline"}
        </span>
      </div>

      <ul className="space-y-3">
        {person.devices.map(({ device: d, activity }) => {
          const Icon = deviceIcon(d.os);
          return (
            <li key={d.ips[0] ?? d.host} className="flex gap-3">
              <span className="relative mt-0.5">
                <Icon className="size-5 text-zinc-400" />
                <span className={`absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
                  d.online ? "bg-emerald-500" : "bg-zinc-400"}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.dns ?? d.host}</p>
                <p className="text-xs text-zinc-500">
                  {d.os}
                  {d.online
                    ? d.conn ? ` · ${d.conn}` : ""
                    : d.last_seen ? ` · seen ${fmtDuration(now - d.last_seen)} ago` : ""}
                </p>
                {activity.watching && <p className="mt-1 truncate text-xs text-indigo-500">{activity.watching}</p>}
                {activity.services.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {activity.services.map((svc) => (
                      <span key={svc} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {svc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}