"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * Ce qui reste de messagerie **globale** : le lien de démonstration.
 *
 * Tout le reste — SMTP, IMAP, signature, essais — appartient désormais aux
 * boîtes (jalon 54, `MailboxesPanel`). Le lien de démo, lui, n'est la propriété
 * d'aucune adresse : c'est le même Calendly quel que soit l'expéditeur, et le
 * dupliquer par boîte aurait fait trois liens qui finissent par diverger.
 */
export interface MailStatus {
  host: string;
  port: number;
  encryption: "tls" | "starttls";
  user: string;
  from: string;
  fromName: string;
  passwordSet: boolean;
  ready: boolean;
  missing: readonly string[];
  /** Lien de démonstration. URL vide = Alex supprime la phrase entière. */
  demoLabel: string;
  demoUrl: string;
}

/** Conservé pour les écrans qui affichent encore qui signe — dérivé des boîtes. */
export interface Signatory {
  id?: string;
  name: string;
  title: string;
  isDefault: boolean;
}

function isPayload(value: unknown): value is { mail: MailStatus } {
  return typeof value === "object" && value !== null && "mail" in value;
}

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none";
const LABEL = "block text-[12px] font-semibold text-muted";

export function MailPanel({ initial }: { readonly initial: MailStatus }) {
  const [demoLabel, setDemoLabel] = useState(initial.demoLabel);
  const [demoUrl, setDemoUrl] = useState(initial.demoUrl);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/mail",
      { method: "PATCH", body: JSON.stringify({ demoLabel, demoUrl }) },
      isPayload,
    );
    setBusy(false);
    if (result.ok) setSaved(true);
    else setError(result.message);
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h3 className="mb-2 font-display text-sm font-semibold">Lien de démonstration</h3>
      <div className="grid max-w-[560px] gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Libellé du lien</span>
          <input
            value={demoLabel}
            onChange={(event) => {
              setSaved(false);
              setDemoLabel(event.target.value);
            }}
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Adresse du lien</span>
          <input
            value={demoUrl}
            placeholder="vide = Alex supprime la phrase"
            onChange={(event) => {
              setSaved(false);
              setDemoUrl(event.target.value);
            }}
            className={FIELD}
          />
        </label>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="min-h-[44px] rounded-control border border-line px-3 text-[13px] hover:border-brand disabled:opacity-50 lg:min-h-0 lg:py-1.5"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-[12px] text-win-d">Enregistré.</span>}
        {error !== null && <span className="text-[12px] text-danger">{error}</span>}
      </div>
    </section>
  );
}
