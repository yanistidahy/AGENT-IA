"use client";

import { useState } from "react";
import { TYPE_LABELS, type OutreachType } from "@/lib/domain/outreach";

/**
 * **« Reprendre l'historique du CRM » : le bouton qui manquait.**
 *
 * La reprise du jalon 109 existe depuis ce jalon-là et **rien ne l'appelait** :
 * ni passage quotidien, ni workflow, ni démarrage, ni bouton. Elle vivait
 * derrière un `POST /api/outreach/backfill` que seule une requête HTTP écrite à
 * la main pouvait atteindre — c'est-à-dire, en pratique, personne. C'est le
 * raisonnement exact du jalon 12, où les corrections de maintenance n'étaient
 * exécutables que par quelqu'un ayant le dépôt, la CLI et l'URL de la base sous
 * la main.
 *
 * **Conséquence mesurée en production** : `/pilotage` n'affiche rien en
 * septembre alors que le CRM a envoyé une cinquantaine d'emails de campagne à
 * ce moment-là. Les envois sont en base, dans `email_sends` ; ils n'ont
 * simplement jamais été transformés en événements.
 *
 * Le panneau montre les comptes **avant et après, type par type**. « 33
 * événements » sans dire lesquels n'apprend rien, et c'est ce qui permet de
 * voir qu'un second passage n'écrit rien — la reprise est idempotente, chaque
 * ligne portant un identifiant déterministe dérivé de sa source.
 */

interface Counts {
  readonly [type: string]: number;
}

interface Report {
  readonly before: Counts;
  readonly after: Counts;
  readonly written: Counts;
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type as OutreachType] ?? type;
}

function total(counts: Counts): number {
  let sum = 0;
  for (const value of Object.values(counts)) sum += value;
  return sum;
}

export function BackfillPanel() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [said, setSaid] = useState("");

  async function run(): Promise<void> {
    setBusy(true);
    setSaid("");
    try {
      const response = await fetch("/api/outreach/backfill", { method: "POST" });
      const body = (await response.json()) as Report & { readonly error?: { message?: string } };
      if (body.error !== undefined) {
        setSaid(body.error.message ?? "La reprise a échoué.");
        return;
      }
      setReport(body);
      const written = total(body.written);
      setSaid(
        written === 0
          ? "Rien à reprendre : tout l'historique était déjà dans le journal."
          : `${written} événement${written > 1 ? "s" : ""} repris.`,
      );
    } catch {
      setSaid("L'appel a échoué : l'application n'a pas répondu.");
    } finally {
      setBusy(false);
    }
  }

  const types =
    report === null
      ? []
      : [...new Set([...Object.keys(report.before), ...Object.keys(report.after)])].sort((a, b) =>
          typeLabel(a).localeCompare(typeLabel(b), "fr"),
        );

  return (
    <section className="rounded-xl border border-line bg-white p-5" data-backfill-panel>
      <h3 className="font-title text-lg text-ink">Reprendre l&apos;historique du CRM</h3>

      <p className="mt-2 text-sm text-muted">
        Transforme en événements de prospection ce que le CRM porte déjà : les emails du journal
        des envois, les clics sur le lien de la démonstration, les interactions consignées et les
        affaires gagnées. <strong className="text-ink">Aucune table source n&apos;est touchée</strong> —
        ni envoi, ni réponse, ni clic, ni interaction n&apos;est modifié.
      </p>
      <p className="mt-1.5 text-sm text-muted">
        Idempotente : chaque ligne reprise porte un identifiant déterministe dérivé de sa source,
        donc un second passage n&apos;écrit rien. À lancer une fois après une mise en production,
        et à relancer sans risque si <code>/pilotage</code> paraît incomplet sur une période
        ancienne.
      </p>

      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        data-backfill-run
        className="mt-4 min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-d disabled:opacity-60"
      >
        {busy ? "Reprise en cours…" : "Reprendre l'historique"}
      </button>

      {said !== "" ? (
        <p className="mt-3 text-sm text-ink" data-backfill-said>
          {said}
        </p>
      ) : null}

      {report !== null ? (
        <table className="mt-3 w-full text-sm" data-backfill-report>
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1.5 font-medium">Type d&apos;événement</th>
              <th className="py-1.5 text-right font-medium">Avant</th>
              <th className="py-1.5 text-right font-medium">Après</th>
              <th className="py-1.5 text-right font-medium">Repris</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type} className="border-b border-line-2 last:border-0">
                <td className="py-1.5 text-ink">{typeLabel(type)}</td>
                <td className="py-1.5 text-right text-muted">{report.before[type] ?? 0}</td>
                <td className="py-1.5 text-right text-ink" data-backfill-after={type}>
                  {report.after[type] ?? 0}
                </td>
                <td className="py-1.5 text-right font-medium text-ink">
                  {report.written[type] ?? 0}
                </td>
              </tr>
            ))}
            <tr className="border-t border-line font-medium">
              <td className="py-1.5 text-ink">Total</td>
              <td className="py-1.5 text-right text-muted">{total(report.before)}</td>
              <td className="py-1.5 text-right text-ink" data-backfill-total>
                {total(report.after)}
              </td>
              <td className="py-1.5 text-right text-ink" data-backfill-written>
                {total(report.written)}
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
