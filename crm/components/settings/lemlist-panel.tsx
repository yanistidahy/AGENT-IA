"use client";

import { useState } from "react";
import { TYPE_LABELS, type OutreachType } from "@/lib/domain/outreach";
import { LEMLIST_STATUS_LABELS } from "@/lib/domain/lemlist";

/**
 * **La section lemlist de `/reglages`.**
 *
 * Elle répond à quatre questions, dans l'ordre où on se les pose : est-ce que
 * c'est branché, quand est-ce que ça a marché pour la dernière fois, qu'est-ce
 * que ça a rapporté, et qu'est-ce qui n'a pas marché. Les deux boutons viennent
 * après, parce qu'on ne clique qu'après avoir lu.
 *
 * **La clé n'apparaît nulle part**, et ce n'est pas qu'une intention : ce
 * composant ne reçoit jamais sa valeur. Il reçoit un état (`connecté`, `clé
 * absente`, `clé refusée par lemlist`), des comptes et des phrases. Le serveur
 * ne la lui envoie pas, donc le HTML de la page ne peut pas la porter — c'est la
 * même garantie que pour `SMTP_PASSWORD` depuis le jalon 32, et un test la
 * vérifie sur le HTML réellement servi.
 */

export interface LemlistPanelState {
  readonly status: string;
  readonly statusLabel: string;
  readonly lastSuccessAt: string | null;
  readonly lastAttemptAt: string | null;
  readonly lastError: string;
  readonly lastRead: number;
  readonly lastWritten: number;
  readonly historyDone: boolean;
  readonly byType: ReadonlyArray<{ readonly type: string; readonly count: number }>;
  readonly unmappedTypes: ReadonlyArray<{
    readonly key: string;
    readonly detail: string;
    readonly seen: number;
  }>;
  readonly ambiguous: ReadonlyArray<{
    readonly key: string;
    readonly detail: string;
    readonly seen: number;
  }>;
}

interface Props {
  readonly initial: LemlistPanelState;
}

function moment(iso: string | null): string {
  if (iso === null) return "jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

/**
 * Les libellés d'état, **la même table que le serveur**.
 *
 * Importés de `lib/domain/lemlist-status.ts` plutôt que recopiés : deux tables
 * de libellés finiraient par se contredire, et c'est l'écran qui mentirait.
 */
const STATUS_LABELS = LEMLIST_STATUS_LABELS;

/** Le voyant : vert branché, ambre à configurer, rouge refusé. */
function tone(status: string): string {
  if (status === "connected") return "bg-win-l text-win-d";
  if (status === "refused") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-800";
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type as OutreachType] ?? type;
}

export function LemlistPanel({ initial }: Props) {
  const [state, setState] = useState<LemlistPanelState>(initial);
  const [busy, setBusy] = useState<"" | "sync" | "test">("");
  const [said, setSaid] = useState("");

  async function call(what: "sync" | "test") {
    setBusy(what);
    setSaid("");
    try {
      const response = await fetch(`/api/lemlist/${what}`, { method: "POST" });
      // `jsonOk` rend la charge utile **à plat** (jalon 16) ; `fail` l'enveloppe
      // dans `error`. Les deux formes sont lues, sinon un refus s'afficherait
      // « Réponse inattendue » au lieu de dire ce qui ne va pas.
      const body = (await response.json()) as {
        readonly message?: string;
        readonly status?: string;
        readonly error?: { readonly message?: string };
      };
      setSaid(body.message ?? body.error?.message ?? "Réponse inattendue.");
      /*
        Le relevé a pu écrire : on relit l'état plutôt que de recomposer à la
        main ce que le serveur sait. Recomposer ici produirait un second avis
        sur « combien d'événements » — et c'est ainsi qu'une pastille finit par
        contredire sa liste (jalons 49, 78, 105).
      */
      if (what === "sync") {
        const fresh = await fetch("/api/lemlist/status", { cache: "no-store" });
        if (fresh.ok) setState((await fresh.json()) as LemlistPanelState);
      } else if (body.status !== undefined) {
        const status = body.status;
        setState((current) => ({
          ...current,
          status,
          statusLabel: STATUS_LABELS[status] ?? current.statusLabel,
        }));
      }
    } catch {
      setSaid("L'appel a échoué : l'application n'a pas répondu.");
    } finally {
      setBusy("");
    }
  }

  const total = state.byType.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="rounded-xl border border-line bg-white p-5" data-lemlist-panel>
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="font-title text-lg text-ink">Synchronisation lemlist</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone(state.status)}`}
          data-lemlist-status={state.status}
        >
          {state.statusLabel}
        </span>
      </header>

      <p className="mt-2 text-sm text-muted">
        Les activités de lemlist — emails, LinkedIn, WhatsApp — entrent dans le journal de
        prospection, et <code>/pilotage</code> les compte comme les autres. La clé vit dans la
        variable <code>LEMLIST_API_KEY</code> du service et n&apos;est jamais affichée ici.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Dernier succès</dt>
          <dd className="text-sm text-ink" data-lemlist-last-success>
            {moment(state.lastSuccessAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Dernière tentative</dt>
          <dd className="text-sm text-ink">{moment(state.lastAttemptAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Au dernier passage</dt>
          <dd className="text-sm text-ink">
            {state.lastRead} lues, {state.lastWritten} écrites
          </dd>
        </div>
      </dl>

      {state.lastError !== "" ? (
        <p
          className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          data-lemlist-error
        >
          {state.lastError}
        </p>
      ) : null}

      {!state.historyDone ? (
        <p className="mt-4 rounded-lg bg-brand-l px-3 py-2 text-sm text-brand-d">
          La reprise de l&apos;historique complet n&apos;a pas encore abouti. Le prochain passage
          continuera là où le dernier s&apos;est arrêté.
        </p>
      ) : null}

      <h4 className="mt-5 text-sm font-medium text-ink">
        Événements importés {total > 0 ? `(${total})` : ""}
      </h4>
      {state.byType.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Aucun événement importé pour l&apos;instant.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line-2 text-sm" data-lemlist-by-type>
          {state.byType.map((row) => (
            <li key={row.type} className="flex justify-between py-1.5">
              <span className="text-ink">{typeLabel(row.type)}</span>
              <span className="font-medium text-ink" data-lemlist-count={row.type}>
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/*
        **Ce qui n'a pas de correspondance se lit ici, jamais nulle part.**
        C'est l'exigence du jalon : un type lemlist qu'on ne sait pas traduire
        est rangé en « Autre activité », compté nulle part, et **nommé** — pour
        qu'on puisse décider de le traduire, plutôt que de découvrir six mois
        plus tard qu'un canal entier manquait.
      */}
      {state.unmappedTypes.length > 0 ? (
        <details className="mt-5" data-lemlist-unmapped>
          <summary className="cursor-pointer text-sm font-medium text-ink">
            Types lemlist sans correspondance ({state.unmappedTypes.length})
          </summary>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            {state.unmappedTypes.map((issue) => (
              <li key={issue.key}>
                <code className="text-ink">{issue.key}</code> — {issue.detail} (vu {issue.seen} fois)
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {state.ambiguous.length > 0 ? (
        <details className="mt-3" open data-lemlist-ambiguous>
          <summary className="cursor-pointer text-sm font-medium text-red-700">
            Rapprochements à trancher à la main ({state.ambiguous.length})
          </summary>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            {state.ambiguous.map((issue) => (
              <li key={issue.key}>
                <code className="text-ink">{issue.key}</code> — {issue.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void call("sync")}
          disabled={busy !== ""}
          className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-d disabled:opacity-60"
        >
          {busy === "sync" ? "Synchronisation…" : "Synchroniser maintenant"}
        </button>
        <button
          type="button"
          onClick={() => void call("test")}
          disabled={busy !== ""}
          className="min-h-11 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-line-2 disabled:opacity-60"
        >
          {busy === "test" ? "Test…" : "Tester la connexion"}
        </button>
      </div>

      {said !== "" ? (
        <p className="mt-3 text-sm text-ink" data-lemlist-said>
          {said}
        </p>
      ) : null}
    </section>
  );
}
