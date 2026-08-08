"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import {
  DISMISS_REASONS,
  SEVERITY_LABELS,
  type Evidence,
  type ProposedAction,
  type Severity,
} from "@/lib/domain/recommendations";

/**
 * Une recommandation, avec ses preuves et ses trois décisions.
 *
 * **Accepter n'écrit rien.** Le statut passe à « accepté » et les actions
 * proposées apparaissent, chacune derrière son propre bouton. Accepter un
 * constat et vouloir toutes ses conséquences ne sont pas la même chose : c'est
 * la même règle que la carte de confirmation d'une conversation, et le même
 * code d'exécution en dessous.
 */
export interface RecommendationView {
  readonly id: string;
  readonly agentId: string;
  readonly severity: Severity;
  readonly status: string;
  readonly title: string;
  readonly rationale: string;
  readonly evidence: readonly Evidence[];
  readonly actions: readonly ProposedAction[];
}

const TONES: Record<Severity, string> = {
  urgent: "border-[#F0C9C2] bg-pulse-l",
  attention: "border-[#F0DFB8] bg-gold-l",
  info: "border-line bg-surface-2",
};

const BUTTON =
  "rounded-control border border-line bg-surface px-2.5 py-1 text-[11.5px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50";

/** La preuve mène au tiroir de la fiche : elle se vérifie en un clic. */
function hrefFor(item: Evidence): string {
  switch (item.type) {
    case "contact":
      return `/contacts?lifecycle=all&fiche=${encodeURIComponent(item.id)}`;
    case "company":
      return `/societes?fiche=${encodeURIComponent(item.id)}`;
    case "deal":
      return `/affaires?status=all&fiche=${encodeURIComponent(item.id)}`;
    case "task":
      return "/taches";
  }
}

export function RecommendationCard({ item }: { item: RecommendationView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(item.status);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const send = async (body: Record<string, unknown>, done: (payload: unknown) => string) => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      `/api/recommendations/${item.id}`,
      { method: "PATCH", body: JSON.stringify(body) },
      (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
    );
    setBusy(false);
    if (result.ok) {
      setNotice(done(result.data));
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  return (
    <li className={`rounded-card border px-3.5 py-3 ${TONES[item.severity]}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
          {item.agentId} · {SEVERITY_LABELS[item.severity]}
        </span>
        {status !== "new" && (
          <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            {status === "accepted" ? "accepté" : status === "dismissed" ? "écarté" : "en sommeil"}
          </span>
        )}
      </div>

      <b className="mt-0.5 block text-[13.5px] font-semibold">{item.title}</b>
      {item.rationale !== "" && (
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{item.rationale}</p>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {item.evidence.map((evidence) => (
          <Link
            key={`${evidence.type}-${evidence.id}`}
            href={hrefFor(evidence)}
            className="rounded-control border border-line bg-surface px-2 py-0.5 text-[11.5px] hover:border-flux"
          >
            {evidence.label}
          </Link>
        ))}
      </div>

      {notice !== null && <p className="mt-1.5 text-[12px] text-flux-d">{notice}</p>}
      {error !== null && <p className="mt-1.5 text-[12px] text-[#B2311F]">{error}</p>}

      {status === "new" && !asking && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            className={BUTTON}
            onClick={() =>
              void send({ decision: "accept" }, () => {
                setStatus("accepted");
                return item.actions.length === 0
                  ? "Accepté. Aucune action à exécuter."
                  : "Accepté. Les actions ci-dessous attendent votre confirmation.";
              })
            }
          >
            Accepter
          </button>
          <button type="button" disabled={busy} className={BUTTON} onClick={() => setAsking(true)}>
            Écarter
          </button>
          <button
            type="button"
            disabled={busy}
            className={BUTTON}
            onClick={() =>
              void send({ decision: "snooze", days: 7 }, () => {
                setStatus("snoozed");
                return "Remis à dans 7 jours.";
              })
            }
          >
            Plus tard (7 j)
          </button>
        </div>
      )}

      {asking && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted">Pourquoi ?</span>
          {DISMISS_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              disabled={busy}
              className={BUTTON}
              onClick={() =>
                void send({ decision: "dismiss", reason }, () => {
                  setStatus("dismissed");
                  setAsking(false);
                  return `Écarté : ${reason}.`;
                })
              }
            >
              {reason}
            </button>
          ))}
        </div>
      )}

      {status === "accepted" && item.actions.length > 0 && (
        <div className="mt-2 grid gap-1.5">
          {item.actions.map((action, index) => (
            <div
              key={`${action.tool}-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5"
            >
              <span className="flex-1 text-[12.5px]">{action.summary}</span>
              <button
                type="button"
                disabled={busy}
                className={BUTTON}
                onClick={() =>
                  void send({ execute: index }, (payload) => {
                    const bag: Record<string, unknown> = { ...(payload as object) };
                    return typeof bag.summary === "string"
                      ? `Fait : ${bag.summary}`
                      : "Action exécutée.";
                  })
                }
              >
                Confirmer cette action
              </button>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
