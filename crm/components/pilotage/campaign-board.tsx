import { Fragment } from "react";
import Link from "next/link";
import { rateLabel, sourceLabel, NO_DATA } from "@/lib/domain/pilotage";
import {
  BOARD_STATE_LABELS,
  type BoardLine,
  type BoardSort,
  type BoardState,
  type SortDir,
} from "@/lib/domain/campaigns-board";
import { ReliabilityChip } from "./reliability-chip";
import { CampaignSteps } from "./campaign-steps";

/**
 * **« Campagnes côte à côte » — les deux outils dans un seul tableau.**
 *
 * Un **vrai tableau** depuis le jalon 114, et ce n'est pas une préférence de
 * balisage : le brief demande des colonnes triables au clic sur leur en-tête,
 * avec `aria-sort`. `aria-sort` est défini sur un `<th>` et sur rien d'autre ;
 * la liste de cartes du jalon 113 v2 n'avait pas d'en-têtes, donc pas de place
 * pour le dire au lecteur d'écran. Rendre les colonnes triables sans l'annoncer
 * aurait fait un tri que seule la souris peut voir.
 *
 * Les en-têtes sont des **liens**, pas des boutons : le tri vit dans l'URL,
 * donc la vue triée se partage et survit à un rechargement (la règle du jalon
 * 1), et l'écran reste rendu côté serveur.
 *
 * **Deux honnêtetés qui demandent une phrase à l'écran** :
 *
 * 1. **les invitations LinkedIn comptent dans « messages »**, parce qu'inviter
 *    est un acte de prospection (la définition de `messagesSent`, jalon 109).
 *    Sans la note, l'écart entre ce total et le nombre d'emails partis serait
 *    mis sur le dos d'un bug. La colonne « Invitations » le détaille, et
 *    « Invitations acceptées » est **à part** : une invitation acceptée n'est
 *    pas une réponse, c'est une porte qui s'ouvre ;
 * 2. **« terminée » est un fait relevé chez lemlist** depuis le jalon 114 —
 *    `GET /campaigns` publie l'état. Tant qu'une campagne n'a pas été relue,
 *    l'état reste déduit d'un silence de trente jours, et le survol de la puce
 *    dit lequel des deux on regarde.
 */

const STATE_STYLES: Record<BoardState, string> = {
  running: "border-win/30 bg-win-l text-win-d",
  paused: "border-gold/40 bg-gold-l text-gold-d",
  done: "border-line bg-line-2 text-closed",
};

/** Quelle question la puce répond, selon qu'elle vient d'un relevé ou d'un silence. */
function stateHint(line: BoardLine): string {
  if (line.origin === "lemlist" && line.reportedState) {
    return `État publié par lemlist et relevé par la synchronisation.${
      line.waiting === null ? "" : ` ${line.waiting} prospect(s) en attente de lancement.`
    }`;
  }
  if (line.state === "done") {
    return "Campagne du CRM archivée — une décision humaine, donc un fait.";
  }
  if (line.state === "running") return "Déduit d'un fait dans les trente derniers jours.";
  return "Déduit d'un silence de plus de trente jours : lemlist n'a pas encore été relu pour cette campagne.";
}

export type BoardColumn =
  | "people"
  | "messages"
  | "invites"
  | "accepted"
  | "replies"
  | "demos"
  | "qualified";

/** Les colonnes numériques, dans l'ordre du tableau, avec leur clé de tri. */
const COLUMNS: readonly {
  readonly sort: BoardSort;
  readonly label: string;
  readonly column: BoardColumn | null;
  readonly value: (line: BoardLine) => number;
}[] = [
  { sort: "personnes", label: "Personnes", column: "people", value: (l) => l.people.length },
  { sort: "messages", label: "Messages", column: "messages", value: (l) => l.messages },
  { sort: "invitations", label: "Invitations", column: "invites", value: (l) => l.invites },
  {
    sort: "acceptees",
    label: "Invitations acceptées",
    column: "accepted",
    value: (l) => l.invitesAccepted,
  },
  { sort: "reponses", label: "Réponses", column: "replies", value: (l) => l.replies },
  { sort: "demos", label: "Démos envoyées", column: "demos", value: (l) => l.demos },
  { sort: "qualifiees", label: "Démos qualifiées", column: "qualified", value: (l) => l.qualified },
];

export function CampaignBoard({
  lines,
  sort,
  dir,
  sortHref,
  cellHref,
}: {
  readonly lines: readonly BoardLine[];
  readonly sort: BoardSort;
  readonly dir: SortDir;
  readonly sortHref: (key: BoardSort) => string;
  readonly cellHref: (line: BoardLine, column: BoardColumn) => string | null;
}) {
  /** `aria-sort` ne se pose que sur la colonne réellement triée. */
  const ariaSort = (key: BoardSort) =>
    sort === key ? (dir === "asc" ? "ascending" : "descending") : "none";

  return (
    <section data-campaign-board className="rounded-board border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Campagnes côte à côte
          <span className="ml-2 text-[12px] font-normal text-muted">
            CRM et lemlist dans le même tableau
          </span>
        </h3>
        <p className="mt-0.5 text-[11.5px] text-muted" data-board-note>
          « Messages » compte les invitations LinkedIn envoyées : inviter est un acte de
          prospection, et les exclure ferait paraître une campagne LinkedIn deux fois moins active.
          Une invitation <strong className="font-semibold">acceptée</strong> est comptée à part :
          ce n'est pas une réponse.
        </p>
      </header>

      {lines.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted">{NO_DATA}</p>
      ) : (
        <div className="overflow-x-auto" data-board-frame>
          <table className="w-full min-w-[980px] text-[12.5px]">
            <caption className="sr-only">
              Campagnes du CRM et de lemlist, triables par colonne.
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                <th scope="col" aria-sort={ariaSort("campagne")} className="px-4 py-2 font-semibold">
                  <SortLink
                    href={sortHref("campagne")}
                    label="Campagne"
                    active={sort === "campagne"}
                    dir={dir}
                    sort="campagne"
                  />
                </th>
                {COLUMNS.map((column) => (
                  <th
                    key={column.sort}
                    scope="col"
                    aria-sort={ariaSort(column.sort)}
                    className="px-3 py-2 text-right font-semibold"
                  >
                    <SortLink
                      href={sortHref(column.sort)}
                      label={column.label}
                      active={sort === column.sort}
                      dir={dir}
                      sort={column.sort}
                    />
                  </th>
                ))}
                <th
                  scope="col"
                  aria-sort={ariaSort("taux")}
                  className="px-3 py-2 text-right font-semibold"
                >
                  <SortLink
                    href={sortHref("taux")}
                    label="Taux de réponse"
                    active={sort === "taux"}
                    dir={dir}
                    sort="taux"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <Fragment key={line.key}>
                  <tr data-board-line={line.key} className="border-b border-line-2">
                    <th scope="row" className="max-w-[260px] px-4 py-2.5 text-left align-top">
                      <span className="block truncate font-medium text-ink">{line.label}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <span
                          data-board-state={line.state}
                          data-reported={line.reportedState ? "1" : "0"}
                          title={stateHint(line)}
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATE_STYLES[line.state]}`}
                        >
                          {BOARD_STATE_LABELS[line.state]}
                        </span>
                        <span
                          data-board-origin={line.origin}
                          className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-closed"
                        >
                          {sourceLabel(line.origin)}
                        </span>
                      </span>
                    </th>

                    {COLUMNS.map((column) => (
                      <Cell
                        key={column.sort}
                        sort={column.sort}
                        value={column.value(line)}
                        href={column.column === null ? null : cellHref(line, column.column)}
                      />
                    ))}

                    <td
                      className="px-3 py-2.5 text-right align-top"
                      data-board-cell="taux"
                      /*
                        La valeur brute à côté de son rendu : la recette lit
                        l'ordre d'une colonne sans avoir à analyser « 33 % », et
                        un taux absent se lit `""` plutôt que `0` — ce qui est
                        exactement la différence que le tri doit respecter.
                      */
                      data-value={line.rate === null ? "" : line.rate}
                    >
                      <span className="flex flex-col items-end gap-1">
                        <span
                          data-board-rate
                          className={`text-[14px] tabular-nums ${line.reliability === "unusable" ? "text-closed" : "font-semibold text-ink"}`}
                        >
                          {rateLabel(line.rate)}
                        </span>
                        <ReliabilityChip n={line.people.length} reliability={line.reliability} />
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-line-2">
                    <td colSpan={COLUMNS.length + 2} className="px-4 pb-3">
                      <CampaignSteps line={line} />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * L'en-tête cliquable, et la flèche qui dit le sens.
 *
 * La flèche **et** `aria-sort` sur le `<th>` : la première se voit, la seconde
 * se dit. Une seule des deux ferait un tri que la moitié des gens ne peut pas
 * lire — c'est la règle « jamais la couleur seule » appliquée à une direction.
 */
function SortLink({
  href,
  label,
  active,
  dir,
  sort,
}: {
  readonly href: string;
  readonly label: string;
  readonly active: boolean;
  readonly dir: SortDir;
  readonly sort: BoardSort;
}) {
  return (
    <Link
      href={href}
      data-board-sort={sort}
      data-active={active ? "1" : "0"}
      className={active ? "text-brand-d" : "hover:text-ink"}
    >
      {label}
      {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </Link>
  );
}

function Cell({
  sort,
  value,
  href,
}: {
  readonly sort: BoardSort;
  readonly value: number;
  readonly href: string | null;
}) {
  return (
    <td
      className="px-3 py-2.5 text-right align-top tabular-nums"
      data-board-cell={sort}
      data-value={value}
    >
      {href === null || value === 0 ? (
        <span className={value === 0 ? "text-muted" : "font-semibold text-ink"}>{value}</span>
      ) : (
        <Link href={href} className="font-semibold text-brand-d hover:underline">
          {value}
        </Link>
      )}
    </td>
  );
}
