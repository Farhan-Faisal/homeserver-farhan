"use client";
import { RANGES, type Range } from "@/lib/types";

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {RANGES.map((r) => (
        <button key={r} type="button" onClick={() => onChange(r)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            r === value
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}>
          {r}
        </button>
      ))}
    </div>
  );
}