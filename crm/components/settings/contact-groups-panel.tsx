"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { CONTACT_GROUPS, GROUP_LABELS } from "@/lib/domain/contact-group";
import { describeCounts } from "@/lib/domain/step-variants";

/**
 * **Recalculer les groupes de fonction, sans effacer une correction à la main.**
 *
 * Le recalcul ne touche que les groupes **automatiques** : une fiche corrigée à
 * la main est laissée telle quelle, et le rapport le dit — « N contacts
 * reclassés, M corrections manuelles conservées ». Sans ce second nombre, on ne
 * saurait pas si le bouton a respecté ce qu'on avait rectifié, et on cesserait
 * de le cliquer.
 *
 * Les fiches **jamais classées** sont comptées à part de « Autre » : ce ne sont
 * pas des fonctions qu'aucun mot-clé ne couvre, ce sont des fonctions que
 * personne n'a encore lues. C'est précisément ce que ce bouton répare.
 */

interface Counts {
  readonly byGroup: Readonly<Record<string, number>>;
  readonly unclassified: number;
  readonly total: number;
}

interface Payload {
  readonly counts?: Counts;
  readonly message?: string;
  readonly report?: { readonly ambiguous?: readonly string[] };
}

function isPayload(value: unknown): value is Payload {
  return typeof value === "object" && value !== null;
}

export function ContactGroupsPanel({ initial }: { readonly initial: Counts }) {
  const [counts, setCounts] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recompute = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/contact-groups",
      { method: "POST", body: JSON.stringify({ action: "recompute" }) },
      isPayload,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.data.counts !== undefined) setCounts(result.data.counts);
    setMessage(result.data.message ?? null);
    setAmbiguous(result.data.report?.ambiguous ?? []);
  };

  return (
    <div>
      <p className="text-[12.5px] text-muted">
        Le groupe se déduit de la Fonction, sur des <b>mots entiers</b> : « coordinatrice »
        ne contient pas « coo », « advertising » ne contient pas « adv ». Un intitulé
        qu&apos;aucun mot-clé ne couvre va dans <b>Autre</b>, jamais dans le groupe qui lui
        ressemble le plus.
      </p>

      <p className="mt-2 text-[13px]">{describeCounts(counts)}</p>

      <ul className="mt-1.5 grid gap-0.5 text-[12px] text-muted">
        {CONTACT_GROUPS.map((group) => (
          <li key={group}>
            {GROUP_LABELS[group]} : {counts.byGroup[group] ?? 0}
          </li>
        ))}
        <li>
          Non classé : {counts.unclassified} — sur {counts.total} fiches
        </li>
      </ul>

      <button
        type="button"
        disabled={busy}
        onClick={() => void recompute()}
        className="mt-3 min-h-[44px] rounded-control bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-d disabled:opacity-45 lg:min-h-0 lg:py-2"
      >
        {busy ? "Recalcul en cours…" : "Recalculer les groupes"}
      </button>

      <p className="mt-1.5 text-[11.5px] text-muted">
        Ne touche que les groupes déduits. Une correction faite à la main sur une fiche est
        conservée, et le rapport dit combien.
      </p>

      {message !== null && <p className="mt-2 text-[12.5px] text-win-d">{message}</p>}

      {ambiguous.length > 0 && (
        /*
          **Un intitulé départagé par convention est relu, jamais tu.** Deux
          groupes le revendiquaient avec la même précision ; l'ordre documenté a
          tranché, et c'est le seul endroit où la classification fait un choix
          qu'elle ne peut pas justifier autrement.
        */
        <div className="mt-2 rounded-control border border-line bg-surface-2 p-2 text-[12px]">
          <b className="font-semibold">
            {ambiguous.length} intitulé(s) départagé(s) par convention, à relire :
          </b>{" "}
          {ambiguous.join(" · ")}
        </div>
      )}

      {error !== null && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
