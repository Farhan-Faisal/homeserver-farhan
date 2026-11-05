"use client";
import { Camera, HardDrive, Images, PieChart, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { CreateImmichUser } from "@/components/CreateImmichUser";
import { Meter } from "@/components/Meter";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { apiSend, usePoll } from "@/lib/api";
import { fmtBytes } from "@/lib/format";
import type { ImmichUser } from "@/lib/types";

const PHOTOS_GiB = 400;  // the space set aside for photos
const gib = (n: number) => fmtBytes(n * 1024 ** 3);

export default function ImmichPage() {
  const { data, error, reload } = usePoll<{ users: ImmichUser[] }>("/immich/users", 30_000);

  const users = data?.users ?? [];
  const admins = users.filter((u) => u.isAdmin).length;
  const used = users.reduce((sum, u) => sum + u.usedGiB, 0);
  const allocated = users.reduce((sum, u) => sum + (u.quotaGiB ?? 0), 0);
  const unlimited = users.filter((u) => u.quotaGiB === null).length;

  async function remove(email: string) {
    await apiSend("DELETE", `/immich/users/${encodeURIComponent(email)}`);
    reload();
  }

  return (
    <>
      <PageHeader icon={Camera} title="Immich" description="Photo backup: accounts and storage limits" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Accounts" value={data ? users.length : "–"}
          detail={data ? `${admins} admin, ${users.length - admins} others` : undefined} />
        <StatCard icon={Images} label="Stored" value={data ? gib(used) : "–"} detail="photos and videos, all accounts" />
        <StatCard icon={PieChart} label="Allocated" value={data ? allocated : "–"} unit={`of ${PHOTOS_GiB} GiB`}
          tone={allocated > PHOTOS_GiB ? "warning" : "neutral"}
          detail={unlimited ? `${unlimited} account${unlimited > 1 ? "s" : ""} without a limit` : "sum of storage limits"} />
        <StatCard icon={HardDrive} label="Unallocated" value={data ? Math.max(0, PHOTOS_GiB - allocated) : "–"} unit="GiB"
          detail="left to hand out" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Accounts" icon={Users} className="lg:col-span-2">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!data && !error && <p className="text-sm text-zinc-500">Loading…</p>}
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((u) => (
              <li key={u.email} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar name={u.name || u.email} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    {u.isAdmin && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                        <ShieldCheck className="size-3" /> admin
                      </span>
                    )}
                    {u.status !== "active" && (
                      <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        {u.status}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-zinc-500">{u.email}</p>
                  <div className="mt-2 flex items-center gap-3">
                    {u.quotaGiB !== null && <div className="flex-1"><Meter pct={(u.usedGiB / u.quotaGiB) * 100} /></div>}
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                      {u.quotaGiB === null ? `${gib(u.usedGiB)}, no limit` : `${gib(u.usedGiB)} of ${gib(u.quotaGiB)}`}
                    </span>
                  </div>
                </div>
                {!u.isAdmin && (
                  <ConfirmDelete label={`Delete ${u.name}`}
                    disabledReason={u.usedGiB > 0 ? "Has photos backed up, so it can't be deleted here" : undefined}
                    onConfirm={() => remove(u.email)} />
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="New account" icon={UserPlus}>
          <CreateImmichUser onCreated={reload} />
        </Card>
      </div>
    </>
  );
}