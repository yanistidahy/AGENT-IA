"use client";

import { MaintenanceBlock as Block } from "./maintenance-block";

/**
 * Les affaires sans société dont le contact en a une.
 *
 * Le trou vient du formulaire d'affaire : il laisse choisir un contact **et**
 * une société séparément, et remplir l'un sans l'autre est le geste le plus
 * naturel du monde. L'affaire naissait alors orpheline de société alors que la
 * réponse était à un pas, sur la fiche du contact.
 *
 * Ce n'est pas cosmétique : une affaire sans société sort des totaux de
 * `/societes` — pipeline ouvert et CA signé — et de la chronologie de la fiche
 * société. La maison paraît plus petite qu'elle n'est, et seul un « Sans
 * société » en petit sur la carte du kanban le signale.
 *
 * Depuis le jalon 47, la création et la mise à jour comblent ce vide toutes
 * seules. Ce bloc rattrape ce qui est déjà en base.
 */
export interface DealCompanyPlanView {
  total: number;
  examined: number;
  unresolved: string[];
  rows: Array<{ dealName: string; contactName: string; companyName: string }>;
}

export function DealCompanyBlock({
  plan,
  busy,
  onApply,
}: {
  plan: DealCompanyPlanView;
  busy: boolean;
  onApply: (operation: "deal-companies", expected: number, what: string) => void;
}) {
  return (
    <Block
      title="Affaires sans société, rattachables par leur contact"
      summary={`${plan.total} affaire(s) sur ${plan.examined} sans société peuvent hériter de celle de leur contact principal. Elles sont aujourd'hui absentes des totaux de /societes.`}
      hint="N'écrit que companyId, et seulement sur les affaires dont la colonne est vide : une société déjà choisie n'est jamais remplacée — elle peut différer volontairement de celle du contact. Aucune sauvegarde préalable : la valeur est déduite d'une donnée qui reste en place sur la fiche du contact, rien n'est écrasé."
      disabled={busy || plan.total === 0}
      onApply={() =>
        onApply(
          "deal-companies",
          plan.total,
          `Rattacher ${plan.total} affaire(s) à la société de leur contact principal.`,
        )
      }
    >
      {plan.rows.map((row, index) => (
        <li key={`${index}-${row.dealName}`} className="truncate">
          <b className="font-semibold">{row.dealName}</b>{" "}
          <span className="text-muted">
            — {row.contactName} → {row.companyName}
          </span>
        </li>
      ))}
      {/* Ce qui ne se déduit pas est **nommé**, pas passé sous silence : sans
          contact ou avec un contact sans société, il n'y a rien à hériter, et
          c'est à la main que ça se traite. */}
      {plan.unresolved.length > 0 && (
        <li className="mt-1.5 text-[#9A6410]">
          {plan.unresolved.length} affaire(s) sans rien à déduire (pas de contact, ou
          contact sans société) : {plan.unresolved.slice(0, 4).join(", ")}
          {plan.unresolved.length > 4 ? "…" : ""}
        </li>
      )}
    </Block>
  );
}
