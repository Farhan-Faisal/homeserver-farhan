"use client";
import { Loader, Trash2 } from "lucide-react";
import { useState } from "react";

// A bin icon. The first click asks "Delete / Cancel", the second does it.
// If the API refuses, its reason shows under the buttons.
export function ConfirmDelete({ label, disabledReason, onConfirm }: {
  label: string;                     // e.g. "Delete Farabeed", for the tooltip and screen readers
  disabledReason?: string;           // set it to grey the button out, with this as the tooltip
  onConfirm: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setAsking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <span title={disabledReason ?? label}>
        <button type="button" onClick={() => setAsking(true)} disabled={!!disabledReason} aria-label={label}
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400">
          <Trash2 className="size-4" />
        </button>
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <button type="button" onClick={confirm} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-60">
          {busy ? <Loader className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Delete
        </button>
        <button type="button" onClick={() => { setAsking(false); setError(null); }} disabled={busy}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Cancel
        </button>
      </div>
      {error && <p className="max-w-56 text-right text-xs text-red-500">{error}</p>}
    </div>
  );
}