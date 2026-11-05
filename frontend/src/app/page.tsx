"use client";
import { useState } from "react";
import {
  Activity, ArrowDownUp, Bell, CircuitBoard, Clock, Container, Cpu, MemoryStick,
  MonitorSmartphone, Thermometer,
} from "lucide-react";
import { AlertList } from "@/components/AlertList";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { RangePicker } from "@/components/RangePicker";
import { Sparkline } from "@/components/Sparkline";
import { StatCard, type Tone } from "@/components/StatCard";
import { StatusBanner } from "@/components/StatusBanner";
import { TempChart } from "@/components/TempChart";
import { usePoll } from "@/lib/api";
import { fmtBytes, fmtDuration, fmtRate } from "@/lib/format";
import type { MetricPoint, Range, Status } from "@/lib/types";

// value against a [warning, critical] pair
function toneFor(v: number | null | undefined, pair?: [number, number]): Tone {
  if (v == null || !pair) return "neutral";
  return v >= pair[1] ? "critical" : v >= pair[0] ? "warning" : "ok";
}

export default function GeneralPage() {
  const [range, setRange] = useState<Range>("1h");
  const { data: s, error } = usePoll<Status>("/status", 5000);
  const { data: m } = usePoll<{ points: MetricPoint[] }>(`/metrics?range=${range}`, range === "1h" ? 10_000 : 60_000);
  const points = m?.points ?? [];

  const th = s?.thresholds ?? {};
  const gpu = s?.gpu?.gpus?.[0];
  const nets = (s?.network ?? []).filter((n) => !n.name.startsWith("tailscale"));  // tailscale traffic also crosses Wi-Fi
  const rx = nets.reduce((sum, n) => sum + (n.rx_bps ?? 0), 0);
  const tx = nets.reduce((sum, n) => sum + (n.tx_bps ?? 0), 0);
  const wifi = nets.find((n) => n.wireless && n.up);
  const peers = s?.tailscale?.peers ?? [];
  const containers = s?.containers ?? [];
  const running = containers.filter((c) => c.state === "running" && c.health !== "unhealthy").length;

  return (
    <>
      <PageHeader icon={Activity} title="General" description="Health, temperature and the big numbers" />
      <StatusBanner status={s} error={error} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Cpu} label="CPU" value={s?.cpu?.total?.toFixed(0) ?? "–"} unit="%"
          detail={`${s?.host?.cores ?? "?"} cores · ${((s?.host?.cpu_mhz ?? 0) / 1000).toFixed(1)} GHz`}
          chart={<Sparkline points={points} field="cpu" max={100} />} />
        <StatCard icon={Thermometer} label="CPU temperature" value={s?.temps?.cpu?.toFixed(0) ?? "–"} unit="°C"
          tone={toneFor(s?.temps?.cpu, th.cpu_temp)}
          detail={s?.temps?.nvme != null ? `SSD ${s.temps.nvme.toFixed(0)} °C` : undefined}
          chart={<Sparkline points={points} field="tcpu" color="#f97316" max={100} />} />
        <StatCard icon={MemoryStick} label="Memory" value={s?.memory?.pct?.toFixed(0) ?? "–"} unit="%"
          tone={toneFor(s?.memory?.pct, th.mem_pct)}
          detail={`${fmtBytes(s?.memory?.used)} of ${fmtBytes(s?.memory?.total)}`}
          chart={<Sparkline points={points} field="mem" color="#10b981" max={100} />} />
        <StatCard icon={CircuitBoard} label="GPU" value={gpu?.util?.toFixed(0) ?? "–"} unit="%"
          tone={toneFor(gpu?.temp, th.gpu_temp)}
          detail={gpu ? `${gpu.temp ?? "–"} °C · ${fmtBytes(gpu.mem_used)} memory` : "No GPU data"}
          chart={<Sparkline points={points} field="gpu" color="#a855f7" max={100} />} />
        <StatCard icon={ArrowDownUp} label="Network" value={fmtRate(rx)} unit="down"
          detail={`${fmtRate(tx)} up${wifi?.ssid ? ` · ${wifi.ssid}` : ""}`}
          chart={<Sparkline points={points} field="rx" color="#0ea5e9" />} />
        <StatCard icon={MonitorSmartphone} label="Devices" value={peers.filter((p) => p.online).length}
          unit={`of ${peers.length} online`}
          tone={s?.tailscale?.state === "Running" ? "ok" : s ? "critical" : "neutral"}
          detail="on your Tailscale network" />
        <StatCard icon={Container} label="Containers" value={running} unit={`of ${containers.length} running`}
          tone={!s ? "neutral" : running === containers.length ? "ok" : "critical"}
          detail="Docker" />
        <StatCard icon={Clock} label="Uptime" value={s?.host?.uptime != null ? fmtDuration(s.host.uptime) : "–"}
          detail="since the last restart" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="CPU temperature" icon={Thermometer} className="lg:col-span-2"
          action={<RangePicker value={range} onChange={setRange} />}>
          <TempChart points={points} range={range} warn={th.cpu_temp?.[0] ?? 80} crit={th.cpu_temp?.[1] ?? 90} />
        </Card>
        <Card title="Alerts" icon={Bell}>
          <AlertList alerts={s?.alerts ?? []} />
        </Card>
      </div>
    </>
  );
}