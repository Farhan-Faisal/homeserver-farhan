"use client";
import { useState, type FormEvent } from "react";
import { apiSend } from "@/lib/api";
import { Field, FormMessage, SubmitButton, type Outcome } from "./form";

const USERNAME = /^[a-z][a-z0-9-]{1,31}$/;  // the same rule the server script uses

export function CreateSambaUser({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();  // stop the browser's own form submit, which would reload the page
    if (!USERNAME.test(username)) {
      setOutcome({ ok: false, text: "Username: lowercase letters, digits or dashes, starting with a letter (2–32)." });
      return;
    }
    setBusy(true);
    setOutcome(null);
    try {
      await apiSend("POST", "/samba/users", { username, password });
      setOutcome({ ok: true, text: `Created ${username}. Their folder is /srv/data/files/${username}.` });
      setUsername("");
      setPassword("");
      onCreated();
    } catch (err) {
      setOutcome({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
        placeholder="farabeed" autoComplete="off" required hint="What they log in with, and their folder's name." />
      <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        minLength={8} autoComplete="new-password" required hint="At least 8 characters." />
      <SubmitButton busy={busy}>Create account</SubmitButton>
      <FormMessage outcome={outcome} />
    </form>
  );
}
