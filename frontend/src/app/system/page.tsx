"use client";
import { Boxes, Cog, History, PackageCheck, Server, Siren } from "lucide-react";
import { Fragment } from "react";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { StatCard, type Tone } from "@/components/StatCard";
import { useNow, usePoll } from "@/lib/api";
import { fmtBytes, fmtDuration, fmtWhen } from "@/lib/format";
import type { AlertEvent, Container, Status, Unit } from "@/lib/types";

// What each unit does. Anything not listed shows systemd's own description.
const PLAIN: Record<string, string> = {
  ssh: "Remote login (SSH)",
  tailscaled: "Tailscale private network",
  docker: "Docker",
  containerd: "Container runtime (used by Docker)",
  smbd: "Samba file sharing",
  nmbd: "Samba network names",
  "nvidia-persistenced": "NVIDIA driver kept loaded",
  "unattended-upgrades": "Automatic security updates",
  cron: "Scheduled jobs (cron)",
  "serverdash-collector": "Old dashboard collector",
  "serverdash-collector-next": "Dashboard collector",
  "serverdash-api": "Dashboard API",
};

const LEVEL_TONE: Record<AlertEvent["level"], Tone> = { critical: "critical", warning: "warning", info: "neutral" };

// "ghcr.io/immich-app/immich-server:v3@sha256:4f1e..." -> "immich-server:v3"
const shortImage = (img: string) => img.replace(/@sha256:[0-9a-f]+$/, "").split("/").pop() ?? img;

function containerState(c: Container): [Tone, string] {
  if (c.state === "running") {
    if (c.health === "unhealthy") return ["critical", "Unhealthy"];
    if (c.health === "starting") return ["warning", "Starting"];
    return ["ok", "Running"];
  }
  if (c.state === "restarting") return ["critical", `Restarting (${c.restarts}×)`];
  return ["critical", c.exit_code ? `Stopped, exit ${c.exit_code}` : c.state];
}

function unitState(u: Unit, critical: boolean): [Tone, string] {
  if (u.active === "active") return ["ok", u.sub === "exited" ? "Done" : "Running"];
  if (u.on_demand) return ["ok", "Ready"];  // starts by itself when someone connects
  if (u.active === "activating" || u.active === "reloading") return ["warning", "Starting"];
  if (u.active === "failed") return ["critical", "Failed"];
  return [critical ? "critical" : "neutral", "Stopped"];
}

export default function SystemPage() {
  const { data: s } = usePoll<Status>("/status", 10_000);
  const { data: ev, error: evError } = usePoll<{ events: AlertEvent[] }>("/events?limit=100", 30_000);
  const now = useNow(10_000);

  const containers = s?.containers ?? [];
  const units = s?.systemd?.units ?? [];
  const critical = s?.critical_units ?? [];
  const alerts = s?.alerts ?? [];
  const events = ev?.events ?? [];
  const failedElsewhere = (s?.systemd?.failed ?? []).filter((f) => !units.some((u) => `${u.unit}.service` === f));

  const containersUp = containers.filter((c) => c.state === "running" && c.health !== "unhealthy").length;
  const unitsUp = units.filter((u) => u.active === "active" || u.on_demand).length;
  const alertTone: Tone = alerts.some((a) => a.level === "critical") ? "critical"
    : alerts.some((a) => a.level === "warning") ? "warning" : alerts.length ? "neutral" : "ok";

  // containers grouped by their compose project
  const projects = new Map<string, Container[]>();
  for (const c of containers) {
    const key = c.project ?? "other";
    projects.set(key, [...(projects.get(key) ?? []), c]);
  }

  return (
    <>
      <PageHeader icon={Server} title="System" description="Containers, services and alert history" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Boxes} label="Containers" value={s?.containers ? containersUp : "–"} unit={`of ${containers.length} running`}
          tone={!s?.containers ? "critical" : containersUp === containers.length ? "ok" : "critical"}
          detail={s && !s.containers ? "Docker isn't answering" : `${fmtBytes(containers.reduce((n, c) => n + (c.mem ?? 0), 0))} of memory`} />
        <StatCard icon={Cog} label="Services" value={s ? unitsUp : "–"} unit={`of ${units.length} running`}
          tone={unitsUp < units.length ? "critical" : failedElsewhere.length ? "warning" : "ok"}
          detail={failedElsewhere.length ? `${failedElsewhere.length} other unit(s) failed` : "systemd units you watch"} />
        <StatCard icon={Siren} label="Alerts now" value={s ? alerts.length : "–"} tone={alertTone}
          detail={alerts[0] ? `${alerts[0].area}: ${alerts[0].text}` : "nothing wrong"} />
        <StatCard icon={PackageCheck} label="Updates" value={s?.updates?.total ?? "–"} unit="waiting"
          tone={s?.updates?.security ? "warning" : "neutral"}
          detail={[s?.updates?.security ? `${s.updates.security} for security` : null,
                   s?.host?.reboot_required ? "restart needed" : null].filter(Boolean).join(", ") || s?.host?.kernel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Containers" icon={Boxes} className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">State</th>
                  <th className="pb-2 text-right font-medium">Up for</th>
                  <th className="pb-2 text-right font-medium">CPU</th>
                  <th className="pb-2 text-right font-medium">Memory</th>
                </tr>
              </thead>
              <tbody>
                {[...projects].map(([project, list]) => (
                  <Fragment key={project}>
                    {projects.size > 1 && (
                      <tr><td colSpan={5} className="pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{project}</td></tr>
                    )}
                    {list.map((c) => {
                      const [tone, text] = containerState(c);
                      return (
                        <tr key={c.name} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="py-2 pr-3">
                            <p className="font-medium">{c.name}</p>
                            <p className="max-w-48 truncate text-xs text-zinc-500" title={c.image}>{shortImage(c.image)}</p>
                          </td>
                          <td className="py-2 pr-3"><Pill tone={tone}>{text}</Pill></td>
                          <td className="py-2 text-right tabular-nums text-zinc-500">
                            {c.state === "running" && c.started_at ? fmtDuration(now - c.started_at) : "–"}
                          </td>
                          <td className="py-2 text-right tabular-nums text-zinc-500">{c.cpu != null ? `${c.cpu.toFixed(1)}%` : "–"}</td>
                          <td className="py-2 text-right tabular-nums text-zinc-500">{fmtBytes(c.mem)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Services" icon={Cog}>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {units.map((u) => {
              const [tone, text] = unitState(u, critical.includes(u.unit));
              const notes = [
                u.active === "active" && u.since ? `up ${fmtDuration(now - u.since)}` : null,
                u.on_demand ? "starts when someone connects" : null,
                u.restarts ? `restarted ${u.restarts}× after crashing` : null,
              ].filter(Boolean).join(" · ");
              return (
                <li key={u.unit} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{PLAIN[u.unit] ?? u.description}</p>
                    <p className="truncate text-xs text-zinc-500"><code>{u.unit}</code>{notes && ` · ${notes}`}</p>
                  </div>
                  <Pill tone={tone}>{text}</Pill>
                </li>
              );
            })}
            {failedElsewhere.map((f) => (
              <li key={f} className="flex items-center gap-3 py-2.5 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{f}</p>
                  <p className="truncate text-xs text-zinc-500">See why: <code>systemctl status {f}</code></p>
                </div>
                <Pill tone="warning">Failed</Pill>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Alert history" icon={History} className="lg:col-span-3">
          {evError && <p className="text-sm text-red-500">{evError}</p>}
          {ev && events.length === 0 && <p className="text-sm text-zinc-500">No alerts in the last 90 days.</p>}
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Pill tone={LEVEL_TONE[e.level]}>{e.level}</Pill>
                <p className="min-w-0 flex-1 truncate text-sm"><span className="font-medium">{e.area}</span>: {e.text}</p>
                <div className="shrink-0 text-right text-xs tabular-nums text-zinc-500">
                  <p>{fmtWhen(e.started)}</p>
                  <p>{e.ended === null
                    ? <span className="text-red-500">ongoing, {fmtDuration(now - e.started)}</span>
                    : `lasted ${fmtDuration(e.ended - e.started)}`}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
