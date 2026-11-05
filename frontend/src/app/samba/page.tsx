"use client";
import { FolderOpen, HardDrive, Link2, PieChart, UserPlus, Users, Wifi } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { CreateSambaUser } from "@/components/CreateSambaUser";
import { Meter } from "@/components/Meter";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { usePoll } from "@/lib/api";
import { fmtBytes } from "@/lib/format";
import type { Filesystem, Status } from "@/lib/types";

const SHARE_ROOT = "/srv/data/files";

// The filesystem the share lives on: the mount with the longest path that contains SHARE_ROOT.
function shareDrive(filesystems: Filesystem[]): Filesystem | undefined {
  return filesystems
    .filter((f) => SHARE_ROOT === f.mount || SHARE_ROOT.startsWith(f.mount.endsWith("/") ? f.mount : `${f.mount}/`))
    .sort((a, b) => b.mount.length - a.mount.length)[0];
}

export default function SambaPage() {
  const { data: s } = usePoll<Status>("/status", 5000);
  const { data: u, error, reload } = usePoll<{ users: string[] }>("/samba/users", 30_000);

  const users = u?.users ?? [];
  const sessions = s?.samba ?? [];
  const drive = shareDrive(s?.filesystems ?? []);
  const host = s?.tailscale?.self?.dns ?? "server-fbf";
  const address = `smb://${host}/${s?.page?.samba_share || "files"}`;
  // the name of the device a session comes from, if it's one of yours on Tailscale
  const deviceAt = (ip: string) => s?.tailscale?.peers?.find((p) => p.ips.includes(ip))?.dns ?? ip;

  return (
    <>
      <PageHeader icon={FolderOpen} title="Samba" description="File sharing: accounts and space" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Accounts" value={u ? users.length : "–"} detail="each with a private folder" />
        <StatCard icon={Wifi} label="Connected now" value={sessions.length}
          tone={sessions.length ? "ok" : "neutral"} detail="open Samba sessions" />
        <StatCard icon={PieChart} label="Drive used" value={drive?.pct?.toFixed(0) ?? "–"} unit="%"
          tone={drive?.pct == null ? "neutral" : drive.pct >= 95 ? "critical" : drive.pct >= 85 ? "warning" : "ok"}
          detail={drive ? `${fmtBytes(drive.used)} of ${fmtBytes(drive.total)}` : undefined} />
        <StatCard icon={HardDrive} label="Free" value={fmtBytes(drive?.avail)} detail={drive?.label ?? drive?.mount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Drive" icon={HardDrive}>
          {drive ? (
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium">{drive.label ?? drive.mount}</span>
                  <span className="text-zinc-500">{fmtBytes(drive.avail)} free</span>
                </div>
                <Meter pct={drive.pct ?? 0} />
              </div>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-xs text-zinc-500">Connect with</dt>
                  <dd className="flex items-center gap-1.5 font-mono text-xs"><Link2 className="size-3.5 text-zinc-400" />{address}</dd></div>
                <div><dt className="text-xs text-zinc-500">Each person&apos;s folder</dt>
                  <dd className="font-mono text-xs">{SHARE_ROOT}/&lt;username&gt;</dd></div>
              </dl>
            </div>
          ) : <p className="text-sm text-zinc-500">Loading…</p>}
        </Card>

        <Card title="Accounts" icon={Users}>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <ul className="space-y-3">
            {users.map((name) => {
              const session = sessions.find((x) => x.user === name);
              return (
                <li key={name} className="flex items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="truncate font-mono text-xs text-zinc-500">{SHARE_ROOT}/{name}</p>
                  </div>
                  {session && (
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      on {deviceAt(session.ip)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="New account" icon={UserPlus}>
          <CreateSambaUser onCreated={reload} />
        </Card>
      </div>
    </>
  );
}
