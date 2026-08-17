"use client";

import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/client/http";
import { Drawer } from "@/components/ui/drawer";
import { paragraphCount } from "@/lib/domain/email-format";
import { isEdited, popVersion, pushVersion, type DraftVersion } from "./draft-revisions";
import { ReviseBox, type Exchange } from "./revise-box";

/**
 * Rédiger et envoyer un courriel.
 *
 * Alex propose, l'utilisateur relit, l'envoi part sans seconde confirmation —
 * c'est ce qui a été demandé, et c'est défendable : le texte est sous les yeux
 * et modifiable jusqu'au dernier instant, donc le clic *est* la confirmation.
 *
 * **Mais l'adresse du destinataire est affichée en grand**, et c'est le seul
 * ornement de ce panneau. Se tromper de personne est la faute qu'aucune
 * annulation ne rattrape : un courriel parti est parti. Le reste — objet, corps
 * — se corrige par un second message ; le destinataire, non.
 */
interface Draft {
  subject: string;
  body: string;
  to: string;
  contactName: string;
}

interface Sent {
  to: string;
  contactName: string;
  subject: string;
  activityId: string;
  suggestedReminder: string;
}

function isDraft(value: unknown): value is { draft: Draft } {
  return typeof value === "object" && value !== null && "draft" in value;
}

function isSent(value: unknown): value is { sent: Sent } {
  return typeof value === "object" && value !== null && "sent" in value;
}

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] focus:border-brand focus:outline-none";

export function ComposePanel({
  open,
  contactId,
  fromActivityId,
  onClose,
  onSent,
}: {
  readonly open: boolean;
  readonly contactId: string | null;
  /** L'échange qui vient d'être consigné : le brouillon doit s'y référer. */
  readonly fromActivityId?: string;
  readonly onClose: () => void;
  readonly onSent: (sent: Sent) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Versions successives, la plus récente en dernier. Voir `draft-revisions.ts`. */
  const [history, setHistory] = useState<readonly DraftVersion[]>([]);
  const [exchanges, setExchanges] = useState<readonly Exchange[]>([]);

  // Le brouillon se demande une fois par ouverture. Sans ce garde-fou, chaque
  // rendu du parent relancerait un appel au modèle — payant, et il écraserait
  // le texte en cours de réécriture.
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!open || contactId === null) {
      asked.current = null;
      return;
    }

    const key = `${contactId}:${fromActivityId ?? ""}`;
    if (asked.current === key) return;
    asked.current = key;

    setDraft(null);
    setSubject("");
    setBody("");
    setError(null);
    setHistory([]);
    setExchanges([]);
    setBusy(true);

    void requestJson(
      "/api/emails",
      { method: "POST", body: JSON.stringify({ mode: "draft", contactId, fromActivityId }) },
      isDraft,
    ).then((result) => {
      setBusy(false);
      if (result.ok) {
        setDraft(result.data.draft);
        setSubject(result.data.draft.subject);
        setBody(result.data.draft.body);
        setHistory([{ subject: result.data.draft.subject, body: result.data.draft.body }]);
      } else setError(result.message);
    });
  }, [open, contactId, fromActivityId]);

  /**
   * Demander une reprise.
   *
   * **On envoie `subject` et `body` tels qu'ils sont à l'écran**, pas le
   * brouillon d'origine : quelqu'un qui a réécrit un paragraphe puis demande
   * « fais plus court » veut *son* paragraphe raccourci. Repartir de l'original
   * jetterait son travail sans le dire.
   */
  const revise = async (instruction: string) => {
    if (contactId === null) return;
    setBusy(true);
    setError(null);

    const result = await requestJson(
      "/api/emails",
      {
        method: "POST",
        body: JSON.stringify({
          mode: "revise",
          contactId,
          subject,
          body,
          instruction,
          fromActivityId,
        }),
      },
      isDraft,
    );
    setBusy(false);

    if (!result.ok) {
      setExchanges((current) => [
        ...current,
        { instruction, outcome: result.message, failed: true },
      ]);
      return;
    }

    // La version d'avant reprise est empilée **avant** d'écrire la nouvelle :
    // c'est elle que « revenir au brouillon précédent » restaure, retouches
    // manuelles comprises.
    setHistory((current) => pushVersion(current, { subject, body }));
    setSubject(result.data.draft.subject);
    setBody(result.data.draft.body);
    setExchanges((current) => [
      ...current,
      { instruction, outcome: "Brouillon repris.", failed: false },
    ]);
  };

  const undo = () => {
    const popped = popVersion(history);
    if (popped === null) return;
    setSubject(popped.restored.subject);
    setBody(popped.restored.body);
    setHistory(popped.rest);
  };

  const send = async () => {
    if (contactId === null) return;
    setBusy(true);
    setError(null);

    const result = await requestJson(
      "/api/emails",
      {
        method: "POST",
        body: JSON.stringify({ mode: "send", contactId, subject, body, fromActivityId }),
      },
      isSent,
    );
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSent(result.data.sent);
  };

  const blocks = paragraphCount(body);

  return (
    <Drawer
      open={open}
      title="Rédiger un email"
      subtitle={draft === null ? "Alex prépare un brouillon…" : `à ${draft.contactName}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            disabled={busy || draft === null || subject.trim() === "" || body.trim() === ""}
            onClick={() => void send()}
            className="rounded-control bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
          >
            {busy ? "Envoi…" : "Envoyer maintenant"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-line px-3.5 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:bg-surface-2"
          >
            Annuler
          </button>
        </>
      }
    >
      {/*
        Le destinataire, en grand et en premier. Tout le reste du panneau est
        rattrapable ; ceci ne l'est pas.
      */}
      {draft !== null && (
        <div className="mb-4 rounded-control border border-brand-lift bg-brand-l px-3.5 py-3">
          <span className="font-mono text-[9.5px] tracking-[0.14em] text-brand-d uppercase">
            Destinataire
          </span>
          <p className="mt-1 font-display text-[19px] leading-tight font-semibold break-all text-brand-d">
            {draft.to}
          </p>
          <p className="mt-0.5 text-[12.5px] text-brand-d">{draft.contactName}</p>
        </div>
      )}

      {error !== null && (
        <p className="mb-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] whitespace-pre-wrap text-[#B2311F]">
          {error}
        </p>
      )}

      {busy && draft === null && (
        <p className="text-[13px] text-muted">
          Alex lit l'historique du contact et rédige. Quelques secondes.
        </p>
      )}

      {draft !== null && (
        <div className="grid gap-3">
          <label>
            <span className="block text-[12px] font-semibold text-muted">Objet</span>
            <input className={FIELD} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label>
            <span className="block text-[12px] font-semibold text-muted">Message</span>
            <textarea
              className={`${FIELD} min-h-[280px] font-sans leading-relaxed`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {/*
              Le compte de paragraphes est le seul retour de mise en forme utile
              avant d'envoyer : il dit que les lignes vides ont bien été comprises
              comme des séparations, ce que le champ de saisie ne montre pas.
            */}
            <span className="mt-1 block text-[11.5px] text-muted">
              {blocks} paragraphe{blocks > 1 ? "s" : ""} — séparés par une ligne vide, comme dans
              le message reçu. Le message se termine par « L'équipe AuraFLOW AI ».
            </span>
          </label>

          <ReviseBox
            exchanges={exchanges}
            busy={busy}
            edited={isEdited(history, { subject, body })}
            canUndo={history.length > 1 || isEdited(history, { subject, body })}
            onSubmit={(instruction) => void revise(instruction)}
            onUndo={undo}
          />
        </div>
      )}
    </Drawer>
  );
}
