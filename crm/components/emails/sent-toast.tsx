"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * Ce qui suit un envoi : à qui, et « et maintenant ? ».
 *
 * **Le destinataire est nommé, pas compté.** « Email envoyé » ne dit pas ce
 * qu'on veut vérifier une seconde après avoir cliqué — on veut lire le nom et
 * l'adresse, pour savoir qu'on ne s'est pas trompé de fiche.
 *
 * La relance est **proposée avec sa date**, jamais posée d'office : c'est la
 * règle de tout le produit depuis le jalon 8 — la date était un choix, et
 * l'écrire sans clic serait décider à la place de l'utilisateur. La date
 * pré-remplie vient du délai « après un email » des réglages.
 */
export interface SentNotice {
  readonly to: string;
  readonly contactName: string;
  readonly subject: string;
  readonly activityId: string;
  readonly suggestedReminder: string;
}

function isOk(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function SentToast({
  sent,
  contactId,
  onDismiss,
  onChanged,
}: {
  readonly sent: SentNotice | null;
  readonly contactId: string;
  readonly onDismiss: () => void;
  readonly onChanged: () => void;
}) {
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [planned, setPlanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent === null) return null;

  const value = date === "" ? sent.suggestedReminder.slice(0, 10) : date;

  const plan = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      `/api/contacts/${contactId}`,
      { method: "PATCH", body: JSON.stringify({ nextReminder: value }) },
      isOk,
    );
    setBusy(false);
    if (result.ok) {
      setPlanned(true);
      onChanged();
    } else setError(result.message);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] mx-auto w-[min(560px,calc(100vw-2rem))] rounded-card border border-line bg-surface px-4 py-3 shadow-float">
      <p className="text-[13px]">
        <span className="font-semibold text-win-d">Email envoyé</span> à{" "}
        <b className="font-semibold">{sent.contactName}</b>{" "}
        <span className="font-mono text-[12px] break-all text-muted">({sent.to})</span>
      </p>
      <p className="mt-0.5 truncate text-[12px] text-muted">Objet : {sent.subject}</p>

      {planned ? (
        <p className="mt-2 text-[12.5px] text-win-d">
          Relance programmée le {new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR")}.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-muted">Consigner une relance le</span>
          <input
            type="date"
            value={value}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-control border border-line bg-surface px-2 py-1 text-[12.5px] focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void plan()}
            className="rounded-control bg-brand px-3 py-1 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
          >
            {busy ? "…" : "Programmer"}
          </button>
        </div>
      )}

      {error !== null && <p className="mt-1.5 text-[12px] text-[#B2311F]">{error}</p>}

      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2 right-2 rounded-control px-2 py-1 text-[12px] text-muted transition-colors hover:bg-surface-2"
      >
        Fermer
      </button>
    </div>
  );
}
