"use client";

import { useCallback, useEffect, useState } from "react";
import { requestJson } from "@/lib/client/http";
import {
  REPLY_CATEGORIES,
  REPLY_CATEGORY_LABELS,
  UNCATEGORISED_LABEL,
} from "@/lib/domain/outreach";

/**
 * **Les trois faits qu'on consigne à la main, et le classement des réponses.**
 *
 * « Démo envoyée », « Démo testée », « Retour reçu » : trois interrupteurs,
 * annulables, qui écrivent chacun **un** événement dans le journal de
 * prospection. Les trois ensemble font une démo qualifiée — retirer « Retour
 * reçu » la retire, par construction et non par une seconde règle.
 *
 * Un interrupteur et non un bouton : se tromper de fiche arrive, et une démo
 * qualifiée à tort fausse le seul chiffre sur lequel on décide d'insister. Le
 * libellé dit donc l'état (« Démo envoyée ✓ ») et le clic le renverse.
 *
 * « Démo testée » peut déjà être posée par un **clic réel** sur le lien de la
 * démonstration. L'écran le dit au lieu de laisser croire à une saisie, et
 * l'annulation ne retire que ce qui a été saisi : un clic est un fait, on ne
 * l'efface pas depuis une fiche.
 *
 * Le panneau lit son propre état (`GET /api/outreach?contact=…`) : le tiroir
 * sert quatre onglets, et lui faire porter une donnée qu'un seul panneau
 * affiche l'alourdirait pour tout le monde.
 */

const TOGGLES = [
  { type: "demo_sent", label: "Démo envoyée" },
  { type: "demo_tested", label: "Démo testée" },
  { type: "feedback_received", label: "Retour reçu" },
] as const;

interface ReplyRow {
  readonly id: string;
  readonly occurredAt: string;
  readonly category: string;
  readonly campaignName: string;
}

interface Payload {
  readonly state: Record<string, boolean>;
  readonly replies: readonly ReplyRow[];
}

function isPayload(value: unknown): value is Payload {
  if (typeof value !== "object" || value === null) return false;
  return "state" in value && "replies" in value && Array.isArray(value.replies);
}

function isToggleResult(value: unknown): value is { present: boolean; message: string } {
  return typeof value === "object" && value !== null && "present" in value;
}

function isCategoryResult(value: unknown): value is { ok: boolean; message: string } {
  return typeof value === "object" && value !== null && "message" in value;
}

export function OutreachBox({ contactId }: { readonly contactId: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await requestJson(
      `/api/outreach?contact=${encodeURIComponent(contactId)}`,
      { method: "GET" },
      isPayload,
    );
    if (result.ok) setPayload(result.data);
    else setError(result.message);
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (type: string, present: boolean) => {
    setBusy(type);
    setError(null);
    setNotice(null);
    const result = await requestJson(
      "/api/outreach",
      { method: "POST", body: JSON.stringify({ contactId, type, present }) },
      isToggleResult,
    );
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message);
    await load();
  };

  const classify = async (eventId: string, category: string) => {
    setBusy(eventId);
    setError(null);
    setNotice(null);
    const result = await requestJson(
      "/api/outreach",
      { method: "PATCH", body: JSON.stringify({ eventId, category }) },
      isCategoryResult,
    );
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message);
    await load();
  };

  return (
    <section data-outreach-box className="mt-5">
      <h3 className="mb-2.5 font-display text-sm font-semibold">Démonstration et réponses</h3>

      <div className="rounded-card border border-line px-3.5 py-3">
        <div className="flex flex-wrap gap-2">
          {TOGGLES.map((item) => {
            const on = payload?.state[item.type] === true;
            return (
              <button
                key={item.type}
                type="button"
                data-manual={item.type}
                data-on={on ? "1" : "0"}
                disabled={payload === null || busy === item.type}
                onClick={() => void toggle(item.type, !on)}
                className={`rounded-control border px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50 ${
                  on
                    ? "border-[#B9E7DC] bg-win-l text-win-d"
                    : "border-line bg-surface hover:bg-surface-2"
                }`}
              >
                {on ? `${item.label} ✓` : item.label}
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          Les trois ensemble font une démo qualifiée. « Démo testée » se pose aussi d'elle-même
          quand la personne clique sur le lien de la démonstration ; retirer l'étiquette ne retire
          que ce qui a été saisi ici, jamais un clic constaté.
        </p>

        {notice !== null && <p className="mt-2 text-[12px] text-win-d">{notice}</p>}
        {error !== null && <p className="mt-2 text-[12px] text-[#B2311F]">{error}</p>}
      </div>

      {payload !== null && payload.replies.length > 0 && (
        <ul className="mt-2.5 grid gap-1.5">
          {payload.replies.map((reply) => (
            <li
              key={reply.id}
              data-reply={reply.id}
              className="flex flex-wrap items-center gap-2 rounded-card border border-line px-3 py-2 text-[12.5px]"
            >
              <span className="font-medium">Réponse du {day(reply.occurredAt)}</span>
              {reply.campaignName !== "" && (
                <span className="text-muted">· {reply.campaignName}</span>
              )}
              <select
                data-category
                value={reply.category}
                disabled={busy === reply.id}
                onChange={(event) => void classify(reply.id, event.target.value)}
                className="ml-auto h-8 rounded-control border border-line bg-surface px-2 text-[12.5px] focus:border-brand focus:outline-none disabled:opacity-50"
              >
                <option value="">{UNCATEGORISED_LABEL}</option>
                {REPLY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {REPLY_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Le jour parisien : le serveur tourne en UTC (jalon 93). */
function day(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(at);
}
