import Link from "next/link";
import { rateLabel, sourceLabel, NO_DATA } from "@/lib/domain/pilotage";
import { BOARD_STATE_LABELS, type BoardLine, type BoardState } from "@/lib/domain/campaigns-board";
import { ReliabilityChip } from "./reliability-chip";

/**
 * **« Campagnes côte à côte » — les deux outils dans un seul tableau.**
 *
 * Une puce d'état, une puce d'origine, les colonnes, et le détail par étape
 * replié dans un `<details>`. Replié parce que trois campagnes à cinq étapes
 * font quinze lignes qui noient les trois lignes qu'on venait comparer ; ouvert
 * par le `<summary>` sans JavaScript.
 *
 * **Deux honnêtetés qui demandent une phrase à l'écran** :
 *
 * 1. **les invitations LinkedIn comptent dans « messages »**, parce qu'inviter
 *    est un acte de prospection (la définition de `messagesSent`, jalon 109).
 *    Sans la note, l'écart entre ce total et le nombre d'emails partis serait
 *    mis sur le dos d'un bug ;
 * 2. **« terminée » n'est un fait que pour une campagne du CRM archivée.** Une
 *    activité lemlist ne porte aucun état de campagne, donc une campagne
 *    lemlist arrêtée pour de bon et une campagne simplement silencieuse se
 *    lisent toutes deux « en pause ». Le titre de la puce le dit.
 */

const STATE_STYLES: Record<BoardState, string> = {
  running: "border-win/30 bg-win-l text-win-d",
  paused: "border-gold/40 bg-gold-l text-gold-d",
  done: "border-line bg-line-2 text-closed",
};

const STATE_HINTS: Record<BoardState, string> = {
  running: "Un fait dans les trente derniers jours.",
  paused: "Des faits, mais plus rien depuis trente jours. Une campagne lemlist arrêtée se lit aussi « en pause » : son activité ne porte pas d'état.",
  done: "Campagne du CRM archivée — le seul cas où « terminée » est un fait.",
};

export function CampaignBoard({
  lines,
  cellHref,
}: {
  readonly lines: readonly BoardLine[];
  readonly cellHref: (line: BoardLine, column: "people" | "messages" | "replies" | "demos" | "qualified") => string | null;
}) {
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
        </p>
      </header>

      {lines.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted">{NO_DATA}</p>
      ) : (
        <ul>
          {lines.map((line) => (
            <li key={line.key} data-board-line={line.key} className="border-b border-line-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h4 className="font-medium text-ink">{line.label}</h4>
                <span
                  data-board-state={line.state}
                  title={STATE_HINTS[line.state]}
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
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-6">
                <Figure label="Personnes" value={line.people.length} href={cellHref(line, "people")} />
                <Figure
                  label="Messages"
                  value={line.messages}
                  href={cellHref(line, "messages")}
                  note={line.invites > 0 ? `dont ${line.invites} invitation${line.invites > 1 ? "s" : ""}` : undefined}
                />
                <Figure label="Réponses" value={line.replies} href={cellHref(line, "replies")} />
                <div>
                  <dt className="text-[11px] text-muted">Taux de réponse</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    <span
                      data-board-rate
                      className={`text-[14px] tabular-nums ${line.reliability === "unusable" ? "text-closed" : "font-semibold text-ink"}`}
                    >
                      {rateLabel(line.rate)}
                    </span>
                    <ReliabilityChip n={line.people.length} reliability={line.reliability} />
                  </dd>
                </div>
                <Figure label="Démos envoyées" value={line.demos} href={cellHref(line, "demos")} />
                <Figure label="Démos qualifiées" value={line.qualified} href={cellHref(line, "qualified")} />
              </dl>

              {line.steps.length > 1 ? (
                <details className="mt-2" data-board-steps={line.key}>
                  <summary className="cursor-pointer text-[12px] font-semibold text-brand-d">
                    Résultat par étape ({line.steps.length})
                  </summary>
                  <table className="mt-2 w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                        <th scope="col" className="py-1.5 pr-3 font-semibold">Étape</th>
                        <th scope="col" className="px-3 py-1.5 text-right font-semibold">Messages</th>
                        <th scope="col" className="px-3 py-1.5 text-right font-semibold">Réponses</th>
                        <th scope="col" className="px-3 py-1.5 text-right font-semibold">Taux</th>
                        <th scope="col" className="py-1.5 pl-3 text-right font-semibold">Fiabilité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {line.steps.map((step) => (
                        <tr
                          key={step.label}
                          data-board-step={step.index === null ? "hors" : String(step.index)}
                          className="border-b border-line-2"
                        >
                          <th scope="row" className="py-1.5 pr-3 text-left font-medium text-ink">
                            {step.label}
                          </th>
                          <td className="px-3 py-1.5 text-right tabular-nums">{step.messages}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{step.replies}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{rateLabel(step.rate)}</td>
                          <td className="py-1.5 pl-3 text-right">
                            <ReliabilityChip n={step.contacted} reliability={step.reliability} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ) : (
                <p className="mt-2 text-[11.5px] text-muted" data-board-nosteps={line.key}>
                  Aucune étape de séquence sur ces faits. Les événements lemlist déjà importés
                  reçoivent leur étape à la prochaine synchronisation ; le CRM et le compteur manuel
                  n'en portent pas.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Figure({
  label,
  value,
  href,
  note,
}: {
  readonly label: string;
  readonly value: number;
  readonly href: string | null;
  readonly note?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-[14px] tabular-nums">
        {href === null || value === 0 ? (
          <span className={value === 0 ? "text-muted" : "font-semibold text-ink"}>{value}</span>
        ) : (
          <Link href={href} className="font-semibold text-brand-d hover:underline">
            {value}
          </Link>
        )}
        {note !== undefined && <span className="ml-1.5 text-[11px] font-normal text-muted">{note}</span>}
      </dd>
    </div>
  );
}
