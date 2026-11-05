"use client";
import { useState, type FormEvent } from "react";
import { apiSend } from "@/lib/api";
import { Field, FormMessage, SubmitButton, type Outcome } from "./form";

const USERNAME = /^[A-Za-z0-9._-]{2,32}$/;  // the same rule the API uses
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Check({ label, hint, checked, disabled = false, onChange }: {
  label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-2.5 ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-indigo-600" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </label>
  );
}

// Makes the Jellyfin account, then (if ticked) imports it into Jellyseerr.
export function CreateJellyfinUser({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [seerr, setSeerr] = useState(true);
  const [approval, setApproval] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!USERNAME.test(username)) {
      setOutcome({ ok: false, text: "Username: 2 to 32 letters, digits, dots, dashes or underscores." });
      return;
    }
    setBusy(true);
    setOutcome(null);

    try {
      await apiSend("POST", "/jellyfin/users", { username, password });
    } catch (err) {
      setOutcome({ ok: false, text: message(err) });
      setBusy(false);
      return;
    }

    // The Jellyfin account exists now. If Jellyseerr fails, say so but keep the account.
    let result: Outcome = { ok: true, text: `Created ${username} on Jellyfin.` };
    if (seerr) {
      try {
        await apiSend("POST", "/jellyseerr/users", { username, approvalRequired: approval });
        result = { ok: true, text: `Created ${username} on Jellyfin and Jellyseerr.` };
      } catch (err) {
        result = { ok: false, text: `Created ${username} on Jellyfin, but Jellyseerr refused: ${message(err)}. Try "Add to Jellyseerr" in the list.` };
      }
    }
    setOutcome(result);
    setUsername("");
    setPassword("");
    setBusy(false);
    onCreated();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value)}
        placeholder="farabeed" autoComplete="off" required hint="What they log in to Jellyfin with." />
      <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        minLength={8} autoComplete="new-password" required hint="At least 8 characters." />
      <Check label="Also add to Jellyseerr" hint="So they can request movies and shows with the same login."
        checked={seerr} onChange={setSeerr} />
      <Check label="Requests need my approval" hint="Off: what they request downloads straight away."
        checked={seerr && approval} disabled={!seerr} onChange={setApproval} />
      <SubmitButton busy={busy}>Create account</SubmitButton>
      <FormMessage outcome={outcome} />
    </form>
  );
}
