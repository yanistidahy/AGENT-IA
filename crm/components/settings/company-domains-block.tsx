"use client";

import { MaintenanceBlock as Block } from "./maintenance-block";

/**
 * Le domaine de la société, déduit des adresses électroniques de ses fiches.
 *
 * **Une déduction ponctuelle devient une donnée permanente.** Alex sait déjà
 * lire `dermoplant.com` dans `roxana.beraud@dermoplant.com` pour choisir quoi
 * documenter (jalon 75) ; tant que la société ne porte pas ce domaine, chaque
 * écran affiche un champ vide et la carte annonce une cible « déduite » là où
 * elle pourrait annoncer un fait saisi.
 *
 * Le bloc n'écrit **que la déduction** — jamais la supposition tirée du nom,
 * qui reste à relire ligne à ligne dans « Domaines proposés » (jalons 25 et
 * 26). Les cas douteux — plusieurs domaines parmi les fiches d'une même
 * maison — sont remontés en tête, parce que c'est là que la relecture compte.
 */
export interface CompanyDomainPlanView {
  total: number;
  withoutClue: number;
  rows: Array<{ name: string; value: string; because: string; ambiguous: boolean }>;
}

export function CompanyDomainsBlock({
  plan,
  busy,
  onApply,
}: {
  plan: CompanyDomainPlanView;
  busy: boolean;
  onApply: (operation: "company-domains", expected: number, what: string) => void;
}) {
  return (
    <Block
      title="Domaine de société, depuis les adresses email"
      summary={`${plan.total} société(s) sans domaine dont une adresse professionnelle en porte un. ${plan.withoutClue} autre(s) n'offrent aucune déduction.`}
      hint="N'écrit que domain (et son miroir de recherche), et seulement s'il est vide. Aucune adresse n'est appelée : le domaine est lu dans la valeur saisie, pas deviné du nom de la marque."
      disabled={busy || plan.total === 0}
      onApply={() =>
        onApply(
          "company-domains",
          plan.total,
          `Renseigner le domaine de ${plan.total} société(s) depuis les adresses de leurs fiches.`,
        )
      }
    >
      {plan.rows.map((row) => (
        <li key={`${row.name}-${row.value}`} className={row.ambiguous ? "text-[#9A6410]" : ""}>
          {row.ambiguous ? "⚠ " : ""}
          <span className="font-semibold">{row.name}</span> → {row.value}
          <span className="text-muted"> — {row.because}</span>
        </li>
      ))}
    </Block>
  );
}
