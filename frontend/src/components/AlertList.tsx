import { CircleX, Info, TriangleAlert } from "lucide-react";
import type { Alert } from "@/lib/types";

const ICON = { critical: CircleX, warning: TriangleAlert, info: Info };
const COLOR = { critical: "text-red-500", warning: "text-amber-500", info: "text-indigo-500" };

export function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return <p className="text-sm text-zinc-500">Nothing needs attention.</p>;
  return (
    <ul className="space-y-3">
      {alerts.map((a) => {
        const Icon = ICON[a.level];
        return (
          <li key={`${a.area}-${a.text}`} className="flex gap-3">
            <Icon className={`mt-0.5 size-4 shrink-0 ${COLOR[a.level]}`} />
            <div>
              <p className="text-sm">{a.text}</p>
              <p className="text-xs text-zinc-500">{a.area}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}