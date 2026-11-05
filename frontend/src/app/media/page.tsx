"use client";
import { CirclePlay, Clapperboard, Download, Hourglass, Library, ListChecks, Loader, ShieldCheck, Ticket, Trash2, UserPlus, Users, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { CreateJellyfinUser } from "@/components/CreateJellyfinUser";
import { FormMessage, type Outcome } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import { Toggle } from "@/components/Toggle";
import { apiSend, useNow, usePoll } from "@/lib/api";
import { fmtDuration } from "@/lib/format";
import type { JellyfinUser, SeerrUser, Status } from "@/lib/types";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// One permission, as a small grey label
function Chip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      <Icon className="size-3" />{children}
    </span>
  );
}

export default function MediaPage() {
  const { data: jf, error: jfError, reload: reloadJf } = usePoll<{ users: JellyfinUser[] }>("/jellyfin/users", 30_000);
  const { data: js, error: jsError, reload: reloadJs } = usePoll<{ users: SeerrUser[] }>("/jellyseerr/users", 30_000);
  const { data: s } = usePoll<Status>("/status", 10_000);
  const now = useNow(60_000);

  // The Jellyseerr change being saved (one at a time), and changes just saved, kept until fresh data arrives.
  const [busy, setBusy] = useState<{ key: string; want: boolean } | null>(null);
  const [local, setLocal] = useState<{ base: unknown; approval: Record<string, boolean> }>({ base: null, approval: {} });
  const [outcome, setOutcome] = useState<Outcome>(null);

  const users = [...(jf?.users ?? [])].sort((a, b) =>
    Number(b.isAdmin) - Number(a.isAdmin) || a.username.localeCompare(b.username));
  const seerrUsers = js?.users ?? [];
  const sessions = s?.jellyfin?.sessions ?? [];
  const watching = sessions.filter((x) => x.playing);

  const saved = (k: string) => (local.base === js && k in local.approval ? local.approval[k] : undefined);
  function approvalOf(u: SeerrUser) {
    const k = u.username.toLowerCase();
    if (busy?.key === k) return busy.want;
    return saved(k) ?? u.approvalRequired;
  }
  // their Jellyseerr account, including one just added that the list doesn't show yet
  function seerrOf(username: string): SeerrUser | undefined {
    const k = username.toLowerCase();
    const found = seerrUsers.find((x) => x.username.toLowerCase() === k);
    if (found || saved(k) === undefined) return found;
    return { username, isAdmin: false, approvalRequired: saved(k)!, requestCount: 0, createdAt: "" };
  }

  async function setApproval(u: SeerrUser, want: boolean) {
    const k = u.username.toLowerCase();
    setBusy({ key: k, want });
    setOutcome(null);
    try {
      await apiSend("PATCH", `/jellyseerr/users/${encodeURIComponent(u.username)}`, { approvalRequired: want });
      setLocal((prev) => ({ base: js, approval: { ...(prev.base === js ? prev.approval : {}), [k]: want } }));
      setOutcome({ ok: true, text: want
        ? `${u.username}'s requests now wait for your approval.`
        : `${u.username}'s requests are now approved automatically.` });
      reloadJs();
    } catch (err) {
      setOutcome({ ok: false, text: message(err) });
    } finally {
      setBusy(null);
    }
  }

  async function addToSeerr(username: string) {
    const k = username.toLowerCase();
    setBusy({ key: k, want: true });
    setOutcome(null);
    try {
      await apiSend("POST", "/jellyseerr/users", { username, approvalRequired: true });
      setLocal((prev) => ({ base: js, approval: { ...(prev.base === js ? prev.approval : {}), [k]: true } }));
      setOutcome({ ok: true, text: `${username} can now use Jellyseerr. Their requests wait for your approval.` });
      reloadJs();
    } catch (err) {
      setOutcome({ ok: false, text: message(err) });
    } finally {
      setBusy(null);
    }
  }

  async function remove(username: string) {
    await apiSend("DELETE", `/jellyfin/users/${encodeURIComponent(username)}`);
    reloadJf();
  }

  const admins = users.filter((u) => u.isAdmin).length;
  const requests = seerrUsers.reduce((n, u) => n + (u.requestCount ?? 0), 0);
  const family = seerrUsers.filter((u) => !u.isAdmin);
  const needApproval = family.filter((u) => approvalOf(u)).length;

  return (
    <>
      <PageHeader icon={Clapperboard} title="Media" description="Jellyfin accounts and Jellyseerr requests" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Accounts" value={jf ? users.length : "–"}
          detail={jf ? `${admins} admin, ${users.length - admins} others` : undefined} />
        <StatCard icon={CirclePlay} label="Watching now" value={s ? watching.length : "–"}
          tone={watching.length ? "ok" : "neutral"}
          detail={watching[0] ? `${watching[0].user}: ${watching[0].playing}` : "nobody"} />
        <StatCard icon={ListChecks} label="Requests" value={js ? requests : "–"} detail="made on Jellyseerr, all time" />
        <StatCard icon={Hourglass} label="Need approval" value={js ? needApproval : "–"}
          detail={js ? `of ${family.length} people on Jellyseerr` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Accounts" icon={Users} className="lg:col-span-2">
          <p className="-mt-2 mb-4 text-xs text-zinc-500">
            The switch decides whether their Jellyseerr requests wait for you. Deleting removes the Jellyfin account only.
          </p>
          {jfError && <p className="mb-3 text-sm text-red-500">Jellyfin: {jfError}</p>}
          {jsError && <p className="mb-3 text-sm text-red-500">Jellyseerr: {jsError}</p>}
          {!jf && !jfError && <p className="text-sm text-zinc-500">Loading…</p>}

          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((u) => {
              const k = u.username.toLowerCase();
              const su = js ? seerrOf(u.username) : undefined;
              const session = sessions.find((x) => x.playing && x.user?.toLowerCase() === k);
              const isBusy = busy?.key === k;
              return (
                <li key={u.username} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={u.username} size="sm" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{u.username}</span>
                        {u.isAdmin && <Pill><ShieldCheck className="size-3" />admin</Pill>}
                        {u.disabled && <Pill tone="critical">disabled</Pill>}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Chip icon={Library}>{u.allLibraries ? "All libraries" : "Some libraries"}</Chip>
                        <Chip icon={Download}>{u.canDownload ? "Can download" : "No downloads"}</Chip>
                        {u.canDelete && <Chip icon={Trash2}>Can delete media</Chip>}
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {session
                          ? <span className="text-indigo-500">{session.paused ? "Paused" : "Watching"} {session.playing}{session.device ? ` on ${session.device}` : ""}</span>
                          : u.lastActive ? `active ${fmtDuration(now - Date.parse(u.lastActive) / 1000)} ago` : "never signed in"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {js && (su?.isAdmin ? (
                      <span className="text-xs text-zinc-500">Requests auto-approved</span>
                    ) : su ? (
                      <div className="flex items-center gap-2">
                        <span className="text-right text-xs text-zinc-500">
                          <span className="block font-medium text-zinc-700 dark:text-zinc-300">Needs approval</span>
                          {su.requestCount} request{su.requestCount === 1 ? "" : "s"}
                        </span>
                        <Toggle on={approvalOf(su)} busy={isBusy} disabled={busy !== null}
                          label={`${approvalOf(su) ? "Stop requiring" : "Require"} approval for ${u.username}'s requests`}
                          onChange={(next) => setApproval(su, next)} />
                      </div>
                    ) : (
                      <button type="button" onClick={() => addToSeerr(u.username)} disabled={busy !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800">
                        {isBusy ? <Loader className="size-3.5 animate-spin" /> : <Ticket className="size-3.5" />}
                        Add to Jellyseerr
                      </button>
                    ))}
                    {!u.isAdmin && (
                      <ConfirmDelete label={`Delete ${u.username}`} onConfirm={() => remove(u.username)} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4"><FormMessage outcome={outcome} /></div>
        </Card>

        <Card title="New account" icon={UserPlus}>
          <CreateJellyfinUser onCreated={() => { reloadJf(); reloadJs(); }} />
        </Card>
      </div>
    </>
  );
}
