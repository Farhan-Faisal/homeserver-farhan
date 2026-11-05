"use client";
import { Activity as ActivityIcon, Globe, MonitorSmartphone, Play, Users } from "lucide-react";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { PersonCard, type Activity, type Person } from "@/components/PersonCard";
import { StatCard } from "@/components/StatCard";
import { usePoll } from "@/lib/api";
import type { Device, Status } from "@/lib/types";

// Everything one device is doing right now, matched by its Tailscale addresses.
function activityOf(d: Device, s: Status): Activity {
  const ips = new Set(d.ips);
  const services = new Set<string>();
  for (const c of s.connections ?? []) if (ips.has(c.ip)) services.add(c.service);
  for (const x of s.samba ?? []) if (ips.has(x.ip)) services.add("Samba");
  for (const l of s.logins ?? []) if (l.from && ips.has(l.from)) services.add(`SSH as ${l.user}`);

  const playing = (s.jellyfin?.sessions ?? []).find((j) => j.playing && j.ip && ips.has(j.ip.split(":")[0]!));
  const watching = playing ? `${playing.paused ? "Paused" : "Watching"}: ${playing.playing}` : null;
  if (playing) services.add("Jellyfin");

  return { services: [...services], watching };
}

// Group devices by the account they belong to. People with a device online come first.
function groupPeople(s: Status): Person[] {
  const byOwner = new Map<string, Person>();
  for (const d of s.tailscale?.peers ?? []) {
    const key = d.owner_login ?? "unknown";
    if (!byOwner.has(key)) byOwner.set(key, { name: d.owner_name ?? key, login: d.owner_login, devices: [] });
    byOwner.get(key)!.devices.push({ device: d, activity: activityOf(d, s) });
  }
  const online = (p: Person) => p.devices.some((x) => x.device.online);
  return [...byOwner.values()].sort((a, b) => Number(online(b)) - Number(online(a)) || a.name.localeCompare(b.name));
}

// Connections from addresses that belong to none of your devices (the server itself excluded).
function outsiders(s: Status) {
  const known = new Set([...(s.tailscale?.peers ?? []), s.tailscale?.self].flatMap((d) => d?.ips ?? []));
  const local = /^(127\.|::1$|172\.(1[6-9]|2\d|3[01])\.)/;  // the server itself and Docker
  return (s.connections ?? []).filter((c) => !known.has(c.ip) && !local.test(c.ip));
}

export default function PeoplePage() {
  const { data: s } = usePoll<Status>("/status", 5000);
  const people = s ? groupPeople(s) : [];
  const devices = people.flatMap((p) => p.devices);
  const outside = s ? outsiders(s) : [];

  return (
    <>
      <PageHeader icon={Users} title="People" description="Who's online, and what they're doing" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="People online" value={people.filter((p) => p.devices.some((d) => d.device.online)).length}
          unit={`of ${people.length}`} />
        <StatCard icon={MonitorSmartphone} label="Devices online" value={devices.filter((d) => d.device.online).length}
          unit={`of ${devices.length}`} />
        <StatCard icon={ActivityIcon} label="Active now" value={devices.filter((d) => d.activity.services.length).length}
          detail="using a service right now" />
        <StatCard icon={Play} label="Watching" value={devices.filter((d) => d.activity.watching).length}
          detail="on Jellyfin" tone="neutral" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => <PersonCard key={p.login ?? p.name} person={p} />)}
      </div>

      {outside.length > 0 && (
        <Card title="Outside Tailscale" icon={Globe} className="mt-4">
          <ul className="space-y-1 text-sm">
            {outside.map((c) => (
              <li key={`${c.service}-${c.ip}`}>
                <span className="font-medium">{c.service}</span>
                <span className="text-zinc-500"> from {c.ip} ({c.count} connection{c.count === 1 ? "" : "s"})</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}