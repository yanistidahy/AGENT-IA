import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { SentList, SentQuery, SentSort } from "@/lib/api/email-list";
import { SentFilters, sentHref } from "./sent-filters";

/**
 * Le journal de ce qui est parti.
 *
 * **C'est la pièce qui manquait à cet écran.** Deux graphiques disent le
 * volume ; aucun ne dit à qui l'on a écrit, ni ce qu'on lui a écrit, ni s'il a
 * répondu. Une ligne par message, la plus récente en tête, et un clic ouvre la
 * fiche : le tableau est le point de départ du travail, pas un rapport.
 *
 * Composant serveur : le tri et les filtres passent par des liens, comme le
 * portefeuille du jalon 12. Aucun JavaScript n'est envoyé pour trier.
 */

/**
 * Les colonnes se masquent sur la largeur **du panneau**, pas de la fenêtre.
 *
 * Le tableau vit dans une colonne d'une grille : à 1440 px de fenêtre il n'en
 * occupe que 700. Une règle en `lg:` afficherait donc huit colonnes dans un
 * cadre qui en tient six, et les deux dernières — signataire, séquence —
 * sortiraient du champ sans que rien ne le signale. Les requêtes de conteneur
 * de Tailwind v4 posent la question à la bonne largeur.
 *
 * La séquence, elle, n'a pas de colonne : une pastille dans la cellule de
 * l'objet dit la même chose en un quart de la place. Elle reste filtrable par
 * les puces au-dessus du tableau — c'est ainsi qu'on s'en sert, on ne trie pas
 * par nom de séquence.
 */

const COLUMNS: ReadonlyArray<{
  readonly key: SentSort | null;
  readonly label: string;
  readonly width: string;
  readonly numeric?: boolean;
  readonly hide?: string;
}> = [
  { key: "date", label: "Date", width: "w-[62px]" },
  { key: "contact", label: "Contact", width: "w-[19%]" },
  { key: "societe", label: "Société", width: "w-[17%]", hide: "hidden @xl:table-cell" },
  { key: "objet", label: "Objet", width: "w-auto" },
  { key: "ouvertures", label: "Ouv.", width: "w-[58px]", numeric: true },
  { key: null, label: "Rép.", width: "w-[56px]" },
  { key: "signataire", label: "Signataire", width: "w-[16%]", hide: "hidden @2xl:table-cell" },
];

const CELL = "truncate border-b border-line-2 px-3 py-1.5 text-[12.5px] whitespace-nowrap";

function shortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function SentTable({ list, query }: { readonly list: SentList; readonly query: SentQuery }) {
  const sort = query.sort ?? "date";
  const dir = query.dir ?? (sort === "date" ? "desc" : "asc");

  return (
    <div className="@container overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <SentFilters list={list} query={query} />

      {list.rows.length === 0 ? (
        <p className="px-3.5 py-8 text-center text-[13px] text-muted">
          Aucun envoi ne correspond à ce filtre. {list.total} message
          {list.total > 1 ? "s" : ""} sur la période.
        </p>
      ) : (
        <div className="max-h-[52vh] overflow-auto">
          {/* `table-fixed` : sans lui, une colonne large pousse le tableau
              au-delà de son cadre et la dernière sort du champ sans qu'aucun
              signal ne l'annonce. Les largeurs se partagent, la troncature
              devient prévisible. */}
          <table className="w-full table-fixed border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className={`border-b border-line bg-surface-2 px-3 py-2 font-mono text-[9.5px] font-medium tracking-[0.12em] whitespace-nowrap text-muted uppercase ${
                      column.numeric === true ? "text-right" : "text-left"
                    } ${column.width} ${column.hide ?? ""}`}
                  >
                    {column.key === null ? (
                      column.label
                    ) : (
                      <Link
                        scroll={false}
                        href={sentHref(query, {
                          sort: column.key,
                          // Recliquer la colonne active inverse le sens ; en
                          // choisir une autre repart de son sens naturel.
                          dir: sort === column.key && dir === "asc" ? "desc" : "asc",
                        })}
                        className="uppercase transition-colors hover:text-ink"
                      >
                        {column.label}
                        {sort === column.key && (dir === "asc" ? " ↑" : " ↓")}
                      </Link>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-2">
                  {/* Date courte : dans un journal de cent lignes, « 19/08 »
                      se lit aussi vite que « 19 août 26 » et rend trente
                      pixels à l'objet, qui en manque. La date entière reste au
                      survol. */}
                  <td
                    className={`${CELL} px-2 font-mono text-[11px] text-muted`}
                    title={formatDate(row.sentAt)}
                  >
                    {shortDate(row.sentAt)}
                  </td>
                  <td className={`${CELL} font-medium`}>
                    {row.contactId === null ? (
                      row.contactName
                    ) : (
                      <Link
                        href={`/contacts?lifecycle=all&fiche=${encodeURIComponent(row.contactId)}`}
                        className="text-brand-d hover:underline"
                      >
                        {row.contactName}
                      </Link>
                    )}
                  </td>
                  <td className={`${CELL} hidden text-muted @xl:table-cell`}>
                    {row.company}
                  </td>
                  {/* Flex plutôt que troncature simple : une pastille placée
                      après un objet long serait coupée avec lui, c'est-à-dire
                      invisible exactement sur les lignes qu'elle décrit. */}
                  <td className={CELL}>
                    <span className="flex items-center gap-1.5 overflow-hidden">
                    <span className="min-w-0 truncate" title={row.subject}>
                      {row.subject}
                    </span>
                    {row.sequence !== "" && (
                      <span
                        className="shrink-0 rounded-full bg-brand-l px-1.5 py-[1px] text-[10px] font-medium text-brand-d"
                        title={`Séquence « ${row.sequence} », étape ${row.step ?? "?"}`}
                      >
                        seq. {row.step ?? "?"}
                      </span>
                    )}
                    {row.copyFailed && (
                      <span
                        className="shrink-0 text-[10.5px] text-[#9A6410]"
                        title="La copie IMAP dans « Envoyés » a échoué. Le message est bien parti."
                      >
                        copie ✗
                      </span>
                    )}
                    </span>
                  </td>
                  <td className={`${CELL} px-2 text-right font-mono text-[11px] tabular-nums`}>
                    <Opens row={row} />
                  </td>
                  <td className={CELL}>
                    {row.replied ? (
                      <span className="rounded-full bg-win-l px-1.5 py-[1px] text-[11px] font-medium text-win-d">
                        oui
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={`${CELL} hidden text-muted @2xl:table-cell`}>{row.signatory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Un envoi non suivi n'a pas zéro ouverture : il en a un nombre **inconnu**.
 * Afficher `0` ferait passer une mesure absente pour un échec de lecture.
 */
function Opens({ row }: { readonly row: SentList["rows"][number] }) {
  if (!row.tracked) {
    return (
      <span className="text-muted" title="Suivi désactivé pour ce message : rien n'a été mesuré.">
        —
      </span>
    );
  }
  if (row.openedAt === null) return <span className="text-muted">0</span>;
  return <span title={`Première ouverture le ${formatDate(row.openedAt)}`}>{row.openCount}</span>;
}
