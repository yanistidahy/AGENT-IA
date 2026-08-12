"use client";

import { MaintenanceBlock as Block } from "./maintenance-block";

/**
 * Les adresses réellement écrites dans la feuille.
 *
 * Le résumé porte le fait qui compte, et il est décevant : sur 152 lignes, la
 * colonne `SITE` n'en contient que quatorze qui soient des adresses. Le dire à
 * l'écran évite de rouvrir le tableur dans six mois pour vérifier.
 */
export interface SitePlan {
  total: number;
  unchanged: number;
  sheetTotal: number;
  warnings: string[];
  changes: Array<{
    label: string;
    row: string;
    url: string;
    source: string;
    company: string;
    fillCompanyDomain: boolean;
  }>;
}

export function SitesBlock({
  plan,
  busy,
  onApply,
}: {
  plan: SitePlan;
  busy: boolean;
  onApply: (operation: "sites", expected: number, what: string) => void;
}) {
  return (
    <Block
      title="Sites depuis la feuille"
      summary={`${plan.total} fiche(s) à renseigner sur les ${plan.sheetTotal} adresses que la feuille contient réellement. ${plan.unchanged} déjà pourvue(s).`}
      hint="La feuille porte une colonne SITE, mais sur 152 lignes elle ne contient que 14 adresses — les autres valeurs sont des titres de page. N'écrit que website du contact et domain de sa société, et seulement s'ils sont vides. Les Notes ne sont pas touchées ; la sauvegarde est téléchargée avant écriture."
      disabled={busy || plan.total === 0}
      onApply={() =>
        onApply(
          "sites",
          plan.total,
          `Reporter ${plan.total} adresse(s) depuis la feuille. Une sauvegarde sera téléchargée.`,
        )
      }
    >
      {plan.warnings.map((warning) => (
        <li key={warning} className="text-[#9A6410]">
          ⚠ {warning}
        </li>
      ))}
      {plan.changes.map((change) => (
        <li key={`${change.row}-${change.label}`} className="truncate">
          <b className="font-semibold">{change.label}</b>{" "}
          <span className="text-muted">({change.company})</span> — « {change.url} »
          {change.fillCompanyDomain && <span className="text-muted"> + domaine société</span>}
          <span className="text-muted"> — ligne {change.row}</span>
        </li>
      ))}
    </Block>
  );
}
