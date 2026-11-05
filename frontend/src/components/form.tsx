"use client";
import { CircleCheck, CircleX, Loader } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

// A labelled text box. Anything else (type, value, onChange...) goes straight to the <input>.
export function Field({ label, hint, ...input }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input {...input}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950" />
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60">
      {busy && <Loader className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

// The result of the last submit: green for done, red with the API's message for a refusal.
export type Outcome = { ok: boolean; text: string } | null;
export function FormMessage({ outcome }: { outcome: Outcome }) {
  if (!outcome) return null;
  const Icon = outcome.ok ? CircleCheck : CircleX;
  return (
    <p className={`flex items-start gap-2 text-sm ${outcome.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      {outcome.text}
    </p>
  );
}
