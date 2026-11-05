"use client";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtTick, fmtWhen } from "@/lib/format";
import type { MetricPoint, Range } from "@/lib/types";

// How wide each point is on the longer ranges (the API's slots)
const SLOT: Record<Range, string> = { "1h": "10 s", "24h": "5 min", "7d": "30 min", "30d": "2 h", "1y": "day" };

// CPU temperature over time, with dashed lines at the warning and critical levels.
// The last hour shows every reading. Longer ranges show the average of each slot as the main line,
// and the hottest 1-second reading in it as a faint line above: short spikes stay visible,
// but they don't hide what the temperature usually is.
export function TempChart({ points, range, warn, crit }: {
  points: MetricPoint[];
  range: Range;
  warn: number;
  crit: number;
}) {
  const slots = range !== "1h";
  return (
    <div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="temp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#71717a" strokeOpacity={0.15} />
            <XAxis dataKey="t" tickFormatter={(t: number) => fmtTick(t, range)} minTickGap={48}
                   tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
            <YAxis domain={[30, 100]} tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} unit="°" />
            <Tooltip
              labelFormatter={(t) => fmtWhen(Number(t))}
              formatter={(v, name) => [`${Math.round(Number(v))} °C`, name]}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            <ReferenceLine y={warn} stroke="#f59e0b" strokeDasharray="4 4" />
            <ReferenceLine y={crit} stroke="#ef4444" strokeDasharray="4 4" />
            {slots && (
              <Area type="monotone" dataKey="tcpu_max" name="Peak" stroke="#f97316" strokeOpacity={0.35}
                    strokeWidth={1} fill="none" dot={false} isAnimationActive={false} connectNulls />
            )}
            <Area type="monotone" dataKey="tcpu" name={slots ? "Average" : "CPU"} stroke="#f97316" strokeWidth={2}
                  fill="url(#temp-fill)" dot={false} isAnimationActive={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {slots && (
        <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-orange-500" />average per {SLOT[range]}</span>
          <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-orange-500/40" />hottest second in it</span>
        </p>
      )}
    </div>
  );
}
