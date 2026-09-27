"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import {
  CONTACT_GROUPS,
  GROUP_LABELS,
  groupLabel,
  type ContactGroup,
} from "@/lib/domain/contact-group";

/**
 * **Le groupe de fonction sur la fiche : déduit, corrigible, et qui le dit.**
 *
 * Le groupe se déduit de la Fonction, et la déduction se trompe — « Advertising
 * manager » n'est couvert par aucun mot-clé, et il vaut mieux qu'il reste dans
 * « Autre » que d'être rangé par ressemblance orthographique. La correction à la
 * main est donc le rattrapage prévu, et elle marque la fiche : `manual` la met
 * hors de portée du recalcul, sinon on la referait à chaque passe.
 *
 * L'écran dit **d'où vient** le groupe, parce que les trois états n'appellent
 * pas le même geste : « Non classé » se recalcule, « déduit » se corrige,
 * « défini à la main » se rend au recalcul quand la fonction a changé.
 */

function isOk(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

export function GroupField({
  contactId,
  group,
  source,
  onSaved,
}: {
  readonly contactId: string;
  readonly group: string;
  readonly source: string;
  readonly onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (body: object) => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/contact-groups",
      { method: "POST", body: JSON.stringify(body) },
      isOk,
    );
    setBusy(false);
    if (result.ok) onSaved();
    else setError(result.message);
  };

  return (
    <section className="mt-4">
      <h3 className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Groupe de fonction
      </h3>
      <p className="mt-1 text-[12.5px]">
        <b className="font-semibold">{groupLabel(group, source)}</b>{" "}
        <span className="text-muted">
          {source === "manual"
            ? "— défini à la main, le recalcul ne le touche pas"
            : source === "auto"
              ? "— déduit de la fonction"
              : "— personne ne l'a encore classée, elle n'entre dans aucun filtre de groupe"}
        </span>
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {CONTACT_GROUPS.map((entry) => (
          <button
            key={entry}
            type="button"
            disabled={busy}
            aria-pressed={group === entry && source !== "none"}
            onClick={() => void send({ action: "set", contactId, group: entry })}
            className={`min-h-[44px] rounded-control border px-2.5 text-[12px] disabled:opacity-45 lg:min-h-0 lg:py-1 ${
              group === entry && source !== "none"
                ? "border-brand bg-brand-l font-semibold text-brand-d"
                : "border-line bg-surface text-muted hover:border-brand"
            }`}
          >
            {GROUP_LABELS[entry as ContactGroup]}
          </button>
        ))}
        {source === "manual" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send({ action: "auto", contactId })}
            className="min-h-[44px] rounded-control border border-line px-2.5 text-[12px] text-muted hover:border-brand disabled:opacity-45 lg:min-h-0 lg:py-1"
          >
            Rendre au calcul automatique
          </button>
        )}
      </div>

      {error !== null && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
    </section>
  );
}
