"use client";
import { Loader } from "lucide-react";

// An on/off switch. While `busy`, it shows a spinner in the knob and can't be clicked.
export function Toggle({ on, busy = false, disabled = false, label, onChange }: {
  on: boolean;
  busy?: boolean;
  disabled?: boolean;
  label: string;                       // for screen readers and the tooltip
  onChange: (next: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label}
      disabled={busy || disabled} onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
        on ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"}`}>
      <span className={`flex size-5 items-center justify-center rounded-full bg-white shadow transition ${
        on ? "translate-x-5.5" : "translate-x-0.5"}`}>
        {busy && <Loader className="size-3 animate-spin text-zinc-400" />}
      </span>
    </button>
  );
}
