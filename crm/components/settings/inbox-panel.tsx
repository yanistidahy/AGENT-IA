"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { formatDateLong } from "@/lib/format";
import { InboxDetail, type ExaminedMessage, type PollDetail } from "./inbox-detail";
import { BackfillSection, type Backfill, type Relink } from "./backfill-report";

/**
 * Le relevé de la boîte de réception.
 *
 * **Ce panneau existe surtout pour dire ce que le relevé ne fait pas.** Lire la
 * boîte du prospect est la fonction la plus intrusive du produit en apparence,
 * et la moins intrusive en réalité : sept en-têtes, jamais un corps, jamais un
 * sujet reçu, en lecture seule. Le dire ici est la moitié du travail — l'autre
 * moitié est que ce soit vrai, et c'est `lib/api/inbox.ts` qui la porte.
 */
export interface InboxStatus {
  enabled: boolean;
  configured: boolean;
  lastPollAt: string | null;
  stale: boolean;
  hours: number | null;
}

interface Report {
  skipped: string | null;
  examined: number;
  messages: ExaminedMessage[];
  knownSent: number;
  searchSince: string | null;
  mailbox: string;
  replies: number;
  alreadyLogged: number;
  sequencesStopped: number;
  ignoredAuto: number;
  ignoredBounce: number;
  unrelated: number;
  sendingDomain: string;
  error: string | null;
}

function isBackfill(value: unknown): value is { report: Backfill; relink: Relink } {
  return typeof value === "object" && value !== null && "report" in value && "relink" in value;
}

function isHealth(value: unknown): value is { health: InboxStatus } {
  return typeof value === "object" && value !== null && "health" in value;
}

function isPoll(value: unknown): value is { report: Report; health: InboxStatus } {
  return typeof value === "object" && value !== null && "report" in value;
}

const BUTTON =
  "rounded-control px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50";

export function InboxPanel({ initial }: { readonly initial: InboxStatus }) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PollDetail | null>(null);
  const [backfill, setBackfill] = useState<{ report: Backfill; relink: Relink } | null>(null);

  /**
   * L'interrupteur bouge tout de suite, et revient si le serveur refuse.
   *
   * Trouvé au navigateur : une case pilotée par la réponse du serveur reste
   * immobile le temps de l'aller-retour, et une case qui ignore le clic se lit
   * comme une panne. Même optimisme local et réversible que la file d'accueil
   * du jalon 20 — l'écran ne ment jamais plus de quelques centaines de
   * millisecondes, et jamais en silence.
   */
  const toggle = async (enabled: boolean) => {
    const previous = status;
    setStatus({ ...status, enabled });
    setBusy(true);
    setError(null);
    setDone(null);

    const result = await requestJson(
      "/api/mail/inbox",
      { method: "PATCH", body: JSON.stringify({ inboxPollEnabled: enabled }) },
      isHealth,
    );
    setBusy(false);
    if (result.ok) {
      setStatus(result.data.health);
      setDone("Enregistré.");
    } else {
      setStatus(previous);
      setError(result.message);
    }
  };

  const pollNow = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson("/api/mail/inbox", { method: "POST" }, isPoll);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const report = result.data.report;
    setStatus(result.data.health);
    setDone(describe(report));
    setDetail({
      messages: report.messages ?? [],
      knownSent: report.knownSent ?? 0,
      searchSince: report.searchSince ?? null,
      mailbox: report.mailbox ?? "",
      sendingDomain: report.sendingDomain ?? "",
    });
    if (report.error !== null) setError(report.error);
  };

  /**
   * Le rattrapage : simulation d'abord, application ensuite.
   *
   * Deux boutons distincts plutôt qu'une case à cocher : « Simuler » et
   * « Appliquer » ne se confondent pas au clic, et c'est une écriture sur le
   * journal des envois.
   */
  const runBackfill = async (apply: boolean) => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson(
      "/api/mail/backfill",
      { method: "POST", body: JSON.stringify({ apply }) },
      isBackfill,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBackfill(result.data);
    if (result.data.report.error !== null) setError(result.data.report.error);
    else setDone(apply ? "Rattrapage appliqué." : "Simulation terminée — rien n'a été écrit.");
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h3 className="font-display text-[15px] font-semibold">
        Détection des réponses (relevé IMAP)
      </h3>
      <p className="mt-1 text-[12.5px] text-muted">
        Toutes les quinze minutes, le CRM regarde votre boîte de réception et rapproche les
        réponses de vos envois par leurs en-têtes de fil.{" "}
        <b className="font-semibold text-ink">
          Sept en-têtes sont lus, jamais un corps de message
        </b>{" "}
        — votre boîte n'est pas recopiée dans le CRM. La boîte est ouverte en lecture seule :
        rien n'est marqué comme lu.
      </p>
      <p className="mt-1 text-[12.5px] text-muted">
        Le rapprochement est <b className="font-semibold text-ink">exact</b> :{" "}
        <code>In-Reply-To</code> et <code>References</code> contre les identifiants de vos
        propres messages. Aucune supposition sur l'expéditeur ni le sujet — une fausse
        correspondance consignerait une réponse sur la mauvaise fiche. Les répondeurs
        d'absence et les avis de non-remise sont écartés.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={status.enabled}
            disabled={busy}
            onChange={(event) => void toggle(event.target.checked)}
          />
          <span className="text-[12.5px]">Relever la boîte automatiquement</span>
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={() => void pollNow()}
          className={`${BUTTON} border border-line bg-surface hover:bg-paper`}
        >
          Relever maintenant
        </button>
      </div>

      <p className="mt-2 text-[12px] text-muted">{statusLine(status)}</p>

      {done !== null && <p className="mt-2 text-[12px] text-win-d">{done}</p>}
      {error !== null && <p className="mt-2 text-[12px] text-[#B2311F]">{error}</p>}
      {detail !== null && <InboxDetail detail={detail} />}

      <BackfillSection
        busy={busy}
        data={backfill}
        onRun={(apply) => void runBackfill(apply)}
      />
    </section>
  );
}

function statusLine(status: InboxStatus): string {
  if (!status.configured) {
    return "IMAP n'est pas configuré : renseignez l'hôte ci-dessus, l'identifiant et le mot de passe du SMTP.";
  }
  if (!status.enabled) return "Relevé désactivé : les réponses restent à consigner à la main.";
  if (status.lastPollAt === null) {
    return "Aucun relevé n'a encore eu lieu. Vérifiez que le workflow GitHub est actif et que ses secrets sont posés.";
  }
  const when = formatDateLong(new Date(status.lastPollAt));
  return status.stale
    ? `Dernier relevé réussi : ${when} — il y a plus de ${status.hours ?? 2} heures.`
    : `Dernier relevé réussi : ${when}.`;
}

/** Ce que le relevé a fait, en une phrase — y compris quand il n'a rien fait. */
function describe(report: Report): string {
  if (report.skipped !== null) return report.skipped;

  const parts = [`${report.examined} message${report.examined > 1 ? "s" : ""} examiné`];
  if (report.replies > 0) parts.push(`${report.replies} réponse(s) consignée(s)`);
  if (report.alreadyLogged > 0) {
    parts.push(`${report.alreadyLogged} déjà consignée(s) à la main`);
  }
  if (report.sequencesStopped > 0) parts.push(`${report.sequencesStopped} séquence(s) arrêtée(s)`);
  if (report.ignoredAuto > 0) parts.push(`${report.ignoredAuto} réponse(s) automatique(s) ignorée(s)`);
  if (report.ignoredBounce > 0) parts.push(`${report.ignoredBounce} rebond(s) ignoré(s)`);
  return `${parts.join(" · ")}.`;
}
