"use client";
import { useState, type FormEvent } from "react";
import { apiSend } from "@/lib/api";
import { Field, FormMessage, SubmitButton, type Outcome } from "./form";

const MAX_GiB = 400;  // the API refuses more than this (maxQuotaGiB in its config)

export function CreateImmichUser({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [quota, setQuota] = useState("50");  // text, because that's what a number box holds while you type
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setOutcome(null);
    try {
      await apiSend("POST", "/immich/users", { email, name, password, quotaGiB: Number(quota) });
      setOutcome({ ok: true, text: `Created ${name}. Immich asks them for a new password the first time they log in.` });
      setEmail("");
      setName("");
      setPassword("");
      setQuota("50");
      onCreated();
    } catch (err) {
      setOutcome({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        autoComplete="off" required hint="What they log in with." />
      <Field label="Name" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Farabeed" autoComplete="off" required />
      <Field label="Starting password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        minLength={8} autoComplete="new-password" required hint="Tell them this once. They change it at first login." />
      <Field label="Storage limit (GiB)" type="number" value={quota} onChange={(e) => setQuota(e.target.value)}
        min={1} max={MAX_GiB} step={1} required hint={`Up to ${MAX_GiB} GiB.`} />
      <SubmitButton busy={busy}>Create account</SubmitButton>
      <FormMessage outcome={outcome} />
    </form>
  );
}