"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * Inscrire un contact à une séquence d'emails, depuis sa fiche.
 *
 * **L'inscription ne promet rien.** Elle place le contact dans la file ; c'est
 * au moment de composer chaque étape que les règles sont vérifiées — réponse
 * consignée, fiche close, opposition au démarchage. Le dire ici évite de croire
 * qu'un contact inscrit recevra forcément trois messages.
 *
 * Le bloc ne charge la liste des séquences qu'une fois monté : c'est un usage
 * occasionnel, et faire voyager les séquences dans chaque rendu du tiroir
 * coûterait une requête à toutes les ouvertures de fiche.
 */

interface Sequence {
  id: string;
  name: string;
  active: boolean;
  steps: ReadonlyArray<{ position: number }>;
}

function isList(value: unknown): value is { sequences: Sequence[] } {
  return typeof value === "object" && value !== null && "sequences" in value;
}

function isOutcome(
  value: unknown,
): value is { outcome: { enrolled: number; already: number; refused: Array<{ reason: string }> } } {
  return typeof value === "object" && value !== null && "outcome" in value;
}

export function EnrollBox({
  contactId,
  onChanged,
}: {
  readonly contactId: string;
  readonly onChanged: () => void;
}) {
  const [sequences, setSequences] = useState<readonly Sequence[]>([]);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void requestJson("/api/sequences-email", {}, isList).then((result) => {
      if (cancelled || !result.ok) return;
      const active = result.data.sequences.filter((sequence) => sequence.active);
      setSequences(active);
      setChosen(active[0]?.id ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (sequences.length === 0) return null;

  const enroll = async () => {
    setBusy(true);
    setNotice(null);
    const result = await requestJson(
      "/api/sequences-email",
      { method: "PUT", body: JSON.stringify({ sequenceId: chosen, contactIds: [contactId] }) },
      isOutcome,
    );
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    const outcome = result.data.outcome;
    setNotice(
      outcome.enrolled > 0
        ? "Inscrit. Le premier départ sera composé au prochain matin ouvré, et il passera par vous."
        : outcome.already > 0
          ? "Ce contact est déjà inscrit à cette séquence."
          : (outcome.refused[0]?.reason ?? "Inscription refusée."),
    );
    onChanged();
  };

  return (
    <section className="mt-4 rounded-card border border-line bg-surface-2 px-3.5 py-3">
      <h4 className="font-display text-[13px] font-semibold">Séquence d'emails</h4>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
        L'inscription place le contact dans la file. Les règles — réponse reçue, fiche close,
        opposition au démarchage — sont vérifiées <b className="font-semibold">à chaque envoi</b>,
        pas ici : entre l'inscription et le troisième message il peut se passer trois semaines.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
        >
          {sequences.map((sequence) => (
            <option key={sequence.id} value={sequence.id}>
              {sequence.name} ({sequence.steps.length} étape
              {sequence.steps.length > 1 ? "s" : ""})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-control border border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface disabled:opacity-50"
          disabled={busy || chosen === ""}
          onClick={() => void enroll()}
        >
          {busy ? "…" : "Inscrire"}
        </button>
      </div>
      {notice !== null && <p className="mt-2 text-[12px] text-muted">{notice}</p>}
    </section>
  );
}
