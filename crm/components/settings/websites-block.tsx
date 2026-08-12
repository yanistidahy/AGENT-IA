"use client";

import { MaintenanceBlock as Block } from "./maintenance-block";

/**
 * Le site est dans les Notes, pas dans le champ prévu pour lui.
 *
 * Un bloc à part parce que ce qu'il ne fait pas est aussi important que ce
 * qu'il fait : les lignes « SITE : » sans domaine devinable sont listées, pas
 * traitées, et les autres motifs structurés (Canal, Réponse, N°) sont
 * seulement comptés — la décision de les extraire reste ouverte.
 */
export interface WebsitePlan {
  total: number;
  unresolved: string[];
  otherPatterns: { canal: number; reponse: number; numero: number };
  rows: Array<{
    label: string;
    value: string;
    sourceLine: string;
    fillCompanyDomain: boolean;
  }>;
}

export function WebsitesBlock({
  plan,
  busy,
  onApply,
}: {
  plan: WebsitePlan;
  busy: boolean;
  onApply: (operation: "websites", expected: number, what: string) => void;
}) {
  const others = plan.otherPatterns;
  const otherTotal = others.canal + others.reponse + others.numero;

  return (
    <Block
      title="Site depuis les Notes"
      summary={`${plan.total} fiche(s) où un site est extractible depuis les Notes. ${plan.unresolved.length} ligne(s) « SITE : » sans domaine devinable.`}
      hint="N'écrit que website (et domain de la société liée, s'il est vide). Les Notes ne sont jamais modifiées : la ligne source y reste, à l'identique."
      disabled={busy || plan.total === 0}
      onApply={() =>
        onApply(
          "websites",
          plan.total,
          `Extraire le site de ${plan.total} fiche(s) depuis les Notes.`,
        )
      }
    >
      {otherTotal > 0 && (
        <li className="text-[#9A6410]">
          ⚠ Autres motifs structurés repérés dans les mêmes Notes, non extraits ici : {others.canal} ligne(s)
          « Canal : », {others.reponse} ligne(s) « Réponse ? : », {others.numero} ligne(s) « N° : ».
        </li>
      )}
      {plan.unresolved.map((row) => (
        <li key={row} className="text-muted">
          ⏸ non résolu — {row}
        </li>
      ))}
      {plan.rows.map((row) => (
        <li key={row.label} className="truncate">
          <b className="font-semibold">{row.label}</b> — « {row.value} »
          {row.fillCompanyDomain && <span className="text-muted"> (+ domaine société)</span>}
          <span className="text-muted"> — {row.sourceLine}</span>
        </li>
      ))}
    </Block>
  );
}
