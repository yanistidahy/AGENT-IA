"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { OPEN_RATE_CAVEAT } from "@/lib/domain/email-stats";

/**
 * La copie dans « Envoyés », et le suivi d'ouverture.
 *
 * Deux réglages voisins par le sujet et opposés par la nature : le premier est
 * de la plomberie, le second est une décision qui engage — sur la
 * délivrabilité et sur des données personnelles. Le panneau les sépare
 * visuellement pour cette raison, et écrit les deux mises en garde plutôt que
 * de les laisser deviner.
 *
 * **Aucun mot de passe ici non plus.** IMAP réutilise l'identifiant et le
 * secret du SMTP : le panneau le dit, et ne redemande rien.
 */

export interface ImapStatus {
  host: string;
  port: number;
  encryption: "tls" | "starttls";
  sentMailbox: string;
  enabled: boolean;
  ready: boolean;
  missing: readonly string[];
}

export interface TrackingStatus {
  enabled: boolean;
  retentionMonths: number;
  baseUrl: string;
}

export interface SendLimits {
  perHour: number;
  perDay: number;
}

function isPayload(
  value: unknown,
): value is { imap: ImapStatus; tracking: TrackingStatus; limits: SendLimits } {
  return typeof value === "object" && value !== null && "imap" in value;
}

function isCopied(value: unknown): value is { mailbox: string; bySpecialUse: boolean } {
  return typeof value === "object" && value !== null && "mailbox" in value;
}

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none";
const LABEL = "block text-[12px] font-semibold text-muted";
const BUTTON =
  "rounded-control px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50";

export function ImapPanel({
  initial,
  initialTracking,
  initialLimits,
}: {
  readonly initial: ImapStatus;
  readonly initialTracking: TrackingStatus;
  readonly initialLimits: SendLimits;
}) {
  const [imap, setImap] = useState(initial);
  const [tracking, setTracking] = useState(initialTracking);
  const [limits, setLimits] = useState(initialLimits);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson(
      "/api/mail/imap",
      {
        method: "PATCH",
        body: JSON.stringify({
          imapHost: imap.host,
          imapPort: imap.port,
          imapEncryption: imap.encryption,
          imapSentMailbox: imap.sentMailbox,
          imapCopyEnabled: imap.enabled,
          trackOpens: tracking.enabled,
          openRetentionMonths: tracking.retentionMonths,
          sendPerHour: limits.perHour,
          sendPerDay: limits.perDay,
        }),
      },
      isPayload,
    );
    setBusy(false);
    if (result.ok) {
      setImap(result.data.imap);
      setTracking(result.data.tracking);
      setLimits(result.data.limits);
      setDone("Enregistré.");
    } else setError(result.message);
  };

  const test = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson("/api/mail/copy-test", { method: "POST" }, isCopied);
    setBusy(false);
    if (result.ok) {
      setDone(
        `Message d'essai déposé dans « ${result.data.mailbox} » ` +
          (result.data.bySpecialUse
            ? "(dossier trouvé par son drapeau \\Sent)."
            : "(dossier trouvé par le nom de repli — il cassera si le compte change de langue)."),
      );
    } else setError(result.message);
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h3 className="font-display text-[15px] font-semibold">Copie dans « Envoyés » (IMAP)</h3>
      <p className="mt-1 text-[12.5px] text-muted">
        SMTP envoie, mais ne dépose rien dans votre boîte. Le CRM y dépose donc une copie du
        message <b className="font-semibold text-ink">exactement tel qu'il est parti</b>, pour
        qu'une réponse se rattache au bon fil.{" "}
        <b className="font-semibold text-ink">
          Un échec de copie n'empêche jamais l'envoi
        </b>{" "}
        — le message est parti, et l'échec s'affiche sur la fiche du contact.
      </p>
      <p className="mt-1 text-[12.5px] text-muted">
        Identifiant et mot de passe : les mêmes que le SMTP, ci-dessus. Rien à saisir deux fois.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className={LABEL}>Hôte IMAP</span>
          <input
            className={FIELD}
            value={imap.host}
            placeholder="imap.ionos.fr"
            onChange={(event) => setImap({ ...imap, host: event.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={LABEL}>Port</span>
            <input
              className={FIELD}
              type="number"
              value={imap.port}
              onChange={(event) => setImap({ ...imap, port: Number(event.target.value) })}
            />
          </label>
          <label>
            <span className={LABEL}>Chiffrement</span>
            <select
              className={FIELD}
              value={imap.encryption}
              onChange={(event) =>
                setImap({ ...imap, encryption: event.target.value === "tls" ? "tls" : "starttls" })
              }
            >
              <option value="tls">TLS direct (993)</option>
              <option value="starttls">STARTTLS (143)</option>
            </select>
          </label>
        </div>
        <label>
          <span className={LABEL}>Nom du dossier — repli seulement</span>
          <input
            className={FIELD}
            value={imap.sentMailbox}
            placeholder="Sent"
            onChange={(event) => setImap({ ...imap, sentMailbox: event.target.value })}
          />
          <span className="mt-0.5 block text-[11.5px] text-muted">
            Le dossier est cherché par son drapeau <code>\Sent</code>, quel que soit son nom —
            « Sent », « Envoyés », « INBOX.Sent ». Ce champ ne sert que si aucun dossier ne le
            porte, et l'écran le dit quand c'est le cas.
          </span>
        </label>
        <label className="flex items-start gap-2 pt-4">
          <input
            type="checkbox"
            checked={imap.enabled}
            onChange={(event) => setImap({ ...imap, enabled: event.target.checked })}
          />
          <span className="text-[12.5px]">Déposer une copie de chaque envoi</span>
        </label>
      </div>

      <h4 className="mt-5 font-display text-[13.5px] font-semibold">Suivi d'ouverture</h4>
      <p className="mt-1 text-[12.5px] text-muted">
        Un pixel transparent servi depuis notre propre domaine, un jeton unique par message,
        aucun service tiers. <b className="font-semibold text-ink">{OPEN_RATE_CAVEAT}</b> Un
        pixel rend aussi le message détectable comme de la prospection en masse et peut coûter
        la délivrabilité : il se coupe globalement ici, et message par message à la rédaction.
      </p>
      {tracking.baseUrl === "" && (
        <p className="mt-2 rounded-control border border-[#F0DFB8] bg-gold-l px-3 py-2 text-[12px] text-[#9A6410]">
          Aucune adresse publique connue (<code>CRM_PUBLIC_URL</code> ou{" "}
          <code>RAILWAY_PUBLIC_DOMAIN</code>) : aucun pixel n'est posé, quel que soit ce
          réglage. Une adresse devinée produirait une image cassée dans chaque message.
        </p>
      )}

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={tracking.enabled}
            onChange={(event) => setTracking({ ...tracking, enabled: event.target.checked })}
          />
          <span className="text-[12.5px]">Suivre l'ouverture des emails</span>
        </label>
        <label>
          <span className={LABEL}>Conservation des ouvertures (mois)</span>
          <input
            className={FIELD}
            type="number"
            value={tracking.retentionMonths}
            onChange={(event) =>
              setTracking({ ...tracking, retentionMonths: Number(event.target.value) })
            }
          />
          <span className="mt-0.5 block text-[11.5px] text-muted">
            Passé ce délai, jeton et horodatages sont effacés. L'envoi lui-même reste : c'est un
            fait de gestion, pas une donnée de comportement.
          </span>
        </label>
      </div>

      <h4 className="mt-5 font-display text-[13.5px] font-semibold">Plafonds d'envoi</h4>
      <p className="mt-1 text-[12.5px] text-muted">
        Volontairement bas au départ. <b className="font-semibold text-ink">C'est le serveur qui
        connaît la vraie limite</b> : s'il oppose un refus de débit, le plafond horaire descend
        automatiquement à ce qui vient de passer et l'accueil vous le dit. Relever la valeur ici
        acquitte ce bandeau.
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label>
          <span className={LABEL}>Envois par heure</span>
          <input
            className={FIELD}
            type="number"
            value={limits.perHour}
            onChange={(event) => setLimits({ ...limits, perHour: Number(event.target.value) })}
          />
        </label>
        <label>
          <span className={LABEL}>Envois par jour</span>
          <input
            className={FIELD}
            type="number"
            value={limits.perDay}
            onChange={(event) => setLimits({ ...limits, perDay: Number(event.target.value) })}
          />
        </label>
      </div>

      {error !== null && (
        <p className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] whitespace-pre-wrap text-[#B2311F]">
          {error}
        </p>
      )}
      {done !== null && (
        <p className="mt-3 rounded-control border border-[#BEE3DA] bg-win-l px-3 py-2 text-[12.5px] text-win-d">
          {done}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${BUTTON} bg-brand text-white hover:bg-brand-d`}
          disabled={busy}
          onClick={save}
        >
          Enregistrer
        </button>
        <button
          type="button"
          className={`${BUTTON} border border-line hover:bg-surface-2`}
          disabled={busy || !imap.ready}
          onClick={test}
          title={imap.ready ? undefined : `Il manque ${imap.missing.join(", ")}`}
        >
          Tester la copie
        </button>
        {!imap.ready && (
          <span className="text-[12px] text-muted">Il manque {imap.missing.join(", ")}.</span>
        )}
      </div>
    </section>
  );
}
