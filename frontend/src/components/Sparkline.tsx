"use client";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import type { MetricPoint } from "@/lib/types";

// A tiny chart with no axes: just the shape of the last stretch of time.
export function Sparkline({ points, field, color = "#6366f1", max }: {
  points: MetricPoint[];
  field: keyof MetricPoint;
  color?: string;
  max?: number;  // fix the top (e.g. 100 for percentages); otherwise it fits the data
}) {
  return (
    <div className="h-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <YAxis hide domain={[0, max ?? "auto"]} />
          <Area type="monotone" dataKey={field} stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.12}
                dot={false} isAnimationActive={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}