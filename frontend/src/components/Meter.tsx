// A bar filled to `pct`. It turns amber from 85% and red from 95% (the same levels as disk alerts).
export function Meter({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  const color = p >= 95 ? "bg-red-500" : p >= 85 ? "bg-amber-500" : "bg-indigo-500";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" role="meter"
         aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
    </div>
  );
}
