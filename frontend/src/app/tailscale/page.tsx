"use client";
import { Camera, Clapperboard, FolderOpen, KeyRound, Network, Server, Ticket, TriangleAlert, UserCheck, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { FormMessage, type Outcome } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import { Toggle } from "@/components/Toggle";
import { apiSend, usePoll } from "@/lib/api";
import type { AccessResult, ServiceGroup, Status, TailnetUser } from "@/lib/types";

const SERVICE_ICON: Record<string, LucideIcon> = { immich: Camera, jellyfin: Clapperboard, jellyseerr: Ticket, samba: FolderOpen };

type Groups = { services: ServiceGroup[]; otherGroups: Record<string, string[]> };
const cellKey = (email: string, service: string) => `${email.toLowerCase()}|${service}`;

export default function TailscalePage() {
  const { data: u, error: uError } = usePoll<{ users: TailnetUser[] }>("/tailnet/users", 60_000);
  const { data: g, error: gError, reload } = usePoll<Groups>("/tailnet/groups", 60_000);
  const { data: s } = usePoll<Status>("/status", 10_000);

  // The switch being saved. One at a time: each save rewrites the whole policy file.
  const [busy, setBusy] = useState<{ key: string; want: boolean } | null>(null);
  // Switches just saved, shown as saved until fresh data from the API replaces `base`.
  const [local, setLocal] = useState<{ base: Groups | null; on: Record<string, boolean> }>({ base: null, on: {} });
  const [outcome, setOutcome] = useState<Outcome>(null);

  const users = [...(u?.users ?? [])].sort((a, b) =>
    Number(b.role === "owner") - Number(a.role === "owner") || a.displayName.localeCompare(b.displayName));
  const services = g?.services ?? [];
  const otherGroups = Object.entries(g?.otherGroups ?? {});
  const peers = [...(s?.tailscale?.peers ?? []), ...(s?.tailscale?.self ? [s.tailscale.self] : [])];
  const devicesOf = (login: string) => peers.filter((p) => p.owner_login?.toLowerCase() === login.toLowerCase());

  function isOn(svc: ServiceGroup, email: string) {
    const k = cellKey(email, svc.id);
    if (busy?.key === k) return busy.want;
    if (local.base === g && k in local.on) return local.on[k];
    return svc.members.some((m) => m.toLowerCase() === email.toLowerCase());
  }

  async function toggle(svc: ServiceGroup, user: TailnetUser, want: boolean) {
    const k = cellKey(user.loginName, svc.id);
    const who = user.displayName || user.loginName;
    setBusy({ key: k, want });
    setOutcome(null);
    try {
      const r = await apiSend<AccessResult>(want ? "POST" : "DELETE", "/tailnet/access",
        { email: user.loginName, service: svc.id });
      setLocal((prev) => ({ base: g, on: { ...(prev.base === g ? prev.on : {}), [k]: want } }));
      if (r.stillAllowedBy?.length) {
        setOutcome({ ok: false, text: `Removed ${who} from ${svc.name}, but they can still reach it through ${r.stillAllowedBy.join(", ")}. Change that in the Tailscale admin console.` });
      } else {
        setOutcome({ ok: true, text: want ? `${who} can now reach ${svc.name}.` : `${who} can no longer reach ${svc.name}.` });
      }
      reload();
    } catch (err) {
      setOutcome({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  const grants = services.reduce((n, svc) => n + svc.members.length, 0);
  const online = users.filter((x) => devicesOf(x.loginName).some((d) => d.online)).length;

  return (
    <>
      <PageHeader icon={Network} title="Tailscale" description="Who can reach which service" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="People" value={u ? users.length : "–"} detail="on your tailnet" />
        <StatCard icon={UserCheck} label="Online now" value={u && s ? online : "–"}
          tone={online ? "ok" : "neutral"} detail="with at least one device connected" />
        <StatCard icon={KeyRound} label="Access given" value={g ? grants : "–"}
          detail={`across ${services.length} services`} />
        <StatCard icon={TriangleAlert} label="Other groups" value={g ? otherGroups.length : "–"}
          tone={otherGroups.length ? "warning" : "ok"}
          detail={otherGroups.length ? "not managed here" : "only service groups"} />
      </div>

      <Card title="Access" icon={KeyRound} className="mb-4">
        <p className="-mt-2 mb-4 text-xs text-zinc-500">
          Each switch adds or removes someone from that service&apos;s group in your Tailscale policy. It takes effect within seconds.
        </p>
        {(uError || gError) && <p className="mb-3 text-sm text-red-500">{uError ?? gError}</p>}
        {(!u || !g) && !uError && !gError && <p className="text-sm text-zinc-500">Loading…</p>}

        {u && g && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="pb-3 text-left text-xs font-medium text-zinc-500">Person</th>
                  {services.map((svc) => {
                    const Icon = SERVICE_ICON[svc.id] ?? Server;
                    return (
                      <th key={svc.id} className="px-3 pb-3 text-center text-xs font-medium text-zinc-500">
                        <div className="flex flex-col items-center gap-1">
                          <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                            <Icon className="size-3.5" />{svc.name}
                          </span>
                          <span className="font-mono text-[11px]">:{svc.port}</span>
                          {!svc.ruleExists && <Pill tone="warning">no rule yet</Pill>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const devices = devicesOf(user.loginName);
                  const up = devices.filter((d) => d.online).length;
                  return (
                    <tr key={user.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.displayName || user.loginName} size="sm" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium">
                              <span className="truncate">{user.displayName}</span>
                              {user.role === "owner" && <Pill>owner</Pill>}
                              {user.type === "shared" && <Pill tone="warning">shared</Pill>}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              {user.loginName} · {devices.length} device{devices.length === 1 ? "" : "s"}{up ? `, ${up} online` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      {services.map((svc) => {
                        const k = cellKey(user.loginName, svc.id);
                        const on = isOn(svc, user.loginName);
                        return (
                          <td key={svc.id} className="px-3 py-3 text-center">
                            <Toggle on={on} busy={busy?.key === k} disabled={busy !== null}
                              label={`${on ? "Remove" : "Give"} ${user.displayName} ${on ? "from" : "access to"} ${svc.name}`}
                              onChange={(next) => toggle(svc, user, next)} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4"><FormMessage outcome={outcome} /></div>
      </Card>

      {otherGroups.length > 0 && (
        <Card title="Other groups in your policy" icon={TriangleAlert}>
          <p className="-mt-2 mb-3 text-xs text-zinc-500">
            Not managed by this page. If one of these still gives people a port, turning a switch off above won&apos;t lock them out.
            Edit them in the Tailscale admin console.
          </p>
          <ul className="space-y-2">
            {otherGroups.map(([name, members]) => (
              <li key={name} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <code className="font-medium">{name}</code>
                <span className="text-xs text-zinc-500">{members.length ? members.join(", ") : "empty"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
