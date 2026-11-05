"use client";
import { FileBox, FolderTree, HardDrive, HeartPulse, PieChart, Thermometer } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { Meter } from "@/components/Meter";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { StatCard, type Tone } from "@/components/StatCard";
import { usePoll } from "@/lib/api";
import { fmtBytes, fmtPct, fmtRate } from "@/lib/format";
import { toneOf } from "@/lib/levels";
import type { Disk, DiskIO, Filesystem, Smart, Status } from "@/lib/types";

const kind = (d: Disk) => (d.rotational ? "Hard drive" : d.name.startsWith("nvme") ? "NVMe SSD" : "SSD");
const fmtAge = (hours: number) => (hours >= 8760 ? `${(hours / 8760).toFixed(1)} years` : `${Math.round(hours / 24)} days`);
const badSectors = (s: Smart) => (s.reallocated ?? 0) + (s.pending ?? 0) + (s.uncorrectable ?? 0);

// The drive's own verdict, in a word
function health(smart?: Smart): [Tone, string] {
  if (!smart) return ["neutral", "No health data"];  // asleep, or a USB adapter that hides SMART
  if (!smart.passed) return ["critical", "Failing"];
  return badSectors(smart) || smart.media_errors ? ["warning", "Has errors"] : ["ok", "Healthy"];
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function MountRow({ fs }: { fs: Filesystem }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">
          <span className="font-medium">{fs.label ?? fs.mount}</span>
          {fs.label && <span className="ml-2 font-mono text-xs text-zinc-500">{fs.mount}</span>}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500">{fmtBytes(fs.used)} of {fmtBytes(fs.total)}</span>
      </div>
      <Meter pct={fs.pct ?? 0} />
    </div>
  );
}

function DriveCard({ disk, smart, io, mounts, tempLimits }: {
  disk: Disk; smart?: Smart; io?: DiskIO; mounts: Filesystem[]; tempLimits?: [number, number];
}) {
  const [tone, word] = health(smart);
  return (
    <Card title={disk.model ?? disk.name} icon={HardDrive} action={<Pill tone={tone}>{word}</Pill>}>
      <p className="-mt-2 mb-4 text-xs text-zinc-500">{kind(disk)} · {fmtBytes(disk.size)} · /dev/{disk.name}</p>
      <dl className="mb-4 grid grid-cols-3 gap-3">
        <Fact label="Temperature">
          {smart?.temp != null ? <Pill tone={toneOf(smart.temp, tempLimits)}>{smart.temp} °C</Pill> : "–"}
        </Fact>
        <Fact label="Powered on">{smart?.power_on_hours != null ? fmtAge(smart.power_on_hours) : "–"}</Fact>
        {smart?.percentage_used != null
          ? <Fact label="Wear">{smart.percentage_used}% of its life</Fact>
          : <Fact label="Bad sectors">{smart ? badSectors(smart) : "–"}</Fact>}
        <Fact label="Reading">{fmtRate(io?.read_bps)}</Fact>
        <Fact label="Writing">{fmtRate(io?.write_bps)}</Fact>
        <Fact label="Busy">{fmtPct(io?.util)}</Fact>
      </dl>
      <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {mounts.length
          ? <ul className="space-y-3">{mounts.map((f) => <li key={f.mount}><MountRow fs={f} /></li>)}</ul>
          : <p className="text-sm text-zinc-500">Nothing mounted from this drive.</p>}
      </div>
    </Card>
  );
}

export default function StoragePage() {
  const { data: s } = usePoll<Status>("/status", 10_000);
  const th = s?.thresholds;
  const disks = s?.disks ?? [];
  const smart = s?.smart ?? {};
  const io = s?.disk_io ?? {};
  const filesystems = s?.filesystems ?? [];

  const tempLimits = (d: Disk) => (d.rotational ? th?.hdd_temp : th?.nvme_temp);
  const volumeFiles = filesystems.filter((f) => f.backing_file);
  const others = filesystems.filter((f) => !f.backing_file && !disks.some((d) => d.name === f.disk));
  const folders = [...(s?.folders?.folders ?? [])].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));

  const states = disks.map((d) => health(smart[d.name])[0]);
  const healthy = states.filter((t) => t === "ok").length;
  const fullest = [...filesystems].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  const hottest = disks
    .flatMap((d) => { const t = smart[d.name]?.temp; return t == null ? [] : [{ d, t }]; })
    .sort((a, b) => b.t - a.t)[0];

  return (
    <>
      <PageHeader icon={HardDrive} title="Storage" description="Drives, their health, and what's mounted" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={HardDrive} label="Drives" value={s ? disks.length : "–"}
          detail={`${fmtBytes(disks.reduce((n, d) => n + d.size, 0))} in total`} />
        <StatCard icon={HeartPulse} label="Health" value={s ? healthy : "–"} unit={`of ${disks.length} healthy`}
          tone={states.includes("critical") ? "critical" : states.includes("warning") ? "warning" : healthy ? "ok" : "neutral"}
          detail="the drives' own self-checks" />
        <StatCard icon={PieChart} label="Fullest" value={fullest?.pct?.toFixed(0) ?? "–"} unit="%"
          tone={toneOf(fullest?.pct, th?.disk_pct)} detail={fullest ? fullest.label ?? fullest.mount : undefined} />
        <StatCard icon={Thermometer} label="Hottest drive" value={hottest?.t ?? "–"} unit="°C"
          tone={hottest ? toneOf(hottest.t, tempLimits(hottest.d)) : "neutral"} detail={hottest?.d.model ?? hottest?.d.name} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {disks.map((d) => (
          <DriveCard key={d.name} disk={d} smart={smart[d.name]} io={io[d.name]}
            mounts={filesystems.filter((f) => f.disk === d.name)} tempLimits={tempLimits(d)} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {volumeFiles.length > 0 && (
          <Card title="Volume files" icon={FileBox}>
            <p className="-mt-2 mb-4 text-xs text-zinc-500">Drives that live inside a file, with a fixed size.</p>
            <ul className="space-y-4">
              {volumeFiles.map((f) => (
                <li key={f.mount}>
                  <MountRow fs={f} />
                  <p className="mt-1.5 truncate text-xs text-zinc-500" title={f.backing_file}>
                    <span className="font-mono">{f.backing_file}</span>: {fmtBytes(f.backing_allocated)} on disk, capped at {fmtBytes(f.backing_size)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {others.length > 0 && (
          <Card title="Other volumes" icon={HardDrive}>
            <ul className="space-y-3">{others.map((f) => <li key={f.mount}><MountRow fs={f} /></li>)}</ul>
          </Card>
        )}

        {folders.length > 0 && (
          <Card title="Folder sizes" icon={FolderTree}>
            <ul className="space-y-2">
              {folders.map((f) => (
                <li key={f.path} className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-mono text-xs">{f.path}</span>
                  <span className="shrink-0 tabular-nums text-zinc-500">{f.bytes == null ? "missing" : fmtBytes(f.bytes)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">Counted now and then, not live: it&apos;s slow on big folders.</p>
          </Card>
        )}
      </div>
    </>
  );
}
