"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * **Les départs composés avant la dernière modification de la séquence.**
 *
 * Enregistrer une étape ne recompose rien (jalon 70, et c'est juste : une
 * sauvegarde ne doit ni facturer ni écraser un brouillon qu'on relit). Mais
 * rien ne le **disait** : la file gardait des textes écrits avant le changement,
 * et la carte y affichait même un avertissement calculé sur le gabarit du jour,
 * donc sur un autre texte que celui qu'elle montrait.
 *
 * Le compte vient de `countStaleDepartures`, qui applique la comparaison des
 * cartes : le nombre annoncé ici est exactement celui des cartes qui portent
 * l'avertissement, jamais un second comptage.
 *
 * **Le bouton ne fait pas partir un message.** Il réécrit le texte des départs
 * en file depuis l'étape d'aujourd'hui ; sur une campagne écrite à la main, sans
 * aucun appel au modèle.
 */
export function StaleDepartures({
  campaignId,
  count,
  billed,
}: {
  readonly campaignId: string;
  readonly count: number;
  /** La campagne porte au moins une étape rédigée par Alex : ce sera facturé. */
  readonly billed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (count === 0) return null;

  const rewrite = async () => {
    setBusy(true);
    setMessage(null);
    const result = await requestJson(
      "/api/campaigns/actions",
      { method: "POST", body: JSON.stringify({ action: "rewrite-stale", campaignId }) },
      (value): value is { rewritten: number } =>
        typeof value === "object" && value !== null && "rewritten" in value,
    );
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(
      `${result.data.rewritten} départ${result.data.rewritten > 1 ? "s" : ""} réécrit${
        result.data.rewritten > 1 ? "s" : ""
      } avec le texte d'aujourd'hui. Rien n'a été envoyé.`,
    );
    router.refresh();
  };

  return (
    <div
      data-stale-departures={count}
      className="mb-3 rounded-card border border-gold bg-gold-l px-4 py-3 text-[12.5px] text-ink"
    >
      <b className="font-semibold">
        {count} départ{count > 1 ? "s" : ""} composé{count > 1 ? "s" : ""} avant la dernière
        modification
      </b>{" "}
      · leur texte n&apos;est pas celui des étapes d&apos;aujourd&apos;hui.
      <button
        type="button"
        className="ml-2 min-h-[44px] font-semibold text-brand-d underline disabled:opacity-50 lg:min-h-0"
        disabled={busy}
        onClick={() => void rewrite()}
      >
        {busy ? "Réécriture…" : "Réécrire les départs"}
      </button>
      <p className="mt-1 text-muted">
        {billed
          ? "Une étape de cette campagne est rédigée par Alex : sa réécriture est un appel facturé par départ."
          : "Étapes écrites à la main : la réécriture ne coûte rien et n'appelle aucun modèle."}{" "}
        Rien n&apos;est envoyé.
      </p>
      {message !== null && <p className="mt-1 font-semibold">{message}</p>}
    </div>
  );
}
