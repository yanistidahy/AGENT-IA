"use client";

import { useState } from "react";

/**
 * Test de connexion à l'API Anthropic, depuis l'écran.
 *
 * L'intérêt n'est pas de dire « ça marche / ça ne marche pas » — un 400 le
 * disait déjà. Il est de dire **quel champ** est refusé et **ce que l'API
 * répond**, sans avoir à lire les journaux du conteneur ni à ouvrir un ticket.
 */

interface Step {
  readonly adds: string;
  readonly outcome: "ok" | "failed" | "skipped";
  readonly status: number | null;
  readonly detail: string;
  readonly requestId: string | null;
  readonly durationMs: number;
}

interface Report {
  readonly model: string;
  readonly steps: readonly Step[];
  readonly verdict: string;
}

function isReport(value: unknown): value is Report {
  return (
    typeof value === "object" &&
    value !== null &&
    "steps" in value &&
    Array.isArray((value as { steps: unknown }).steps)
  );
}

const MARK: Record<Step["outcome"], string> = { ok: "✓", failed: "✗", skipped: "·" };
const TONE: Record<Step["outcome"], string> = {
  ok: "text-win-d",
  failed: "text-[#B2311F]",
  skipped: "text-muted",
};

export function ApiDiagnostic() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch("/api/agents/diagnostic", { method: "POST" });
      const payload: unknown = await response.json();
      if (!response.ok || !isReport(payload)) {
        setError("Le serveur n'a pas pu exécuter le diagnostic.");
        return;
      }
      setReport(payload);
    } catch {
      setError("La connexion au serveur a été interrompue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-[12.5px] text-muted">
        Envoie une suite de requêtes minimales à l'API, chacune ajoutant un paramètre à la
        précédente. La première qui échoue nomme le champ refusé et affiche la réponse exacte
        de l'API. Coût : quelques jetons.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="rounded-control border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        {busy ? "Test en cours…" : "Tester la connexion à l'API"}
      </button>

      {error !== null && <p className="mt-2 text-[12.5px] text-[#B2311F]">{error}</p>}

      {report !== null && (
        <div className="mt-2.5">
          <p className="text-[12.5px] font-semibold">{report.verdict}</p>
          <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
            modèle {report.model}
          </p>

          <ul className="mt-1.5 grid gap-1">
            {report.steps.map((step) => (
              <li
                key={step.adds}
                className="rounded-control border border-line bg-surface-2 px-2.5 py-1.5"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`font-mono text-[12px] ${TONE[step.outcome]}`}>
                    {MARK[step.outcome]}
                  </span>
                  <span className="flex-1 text-[12.5px]">{step.adds}</span>
                  {step.status !== null && (
                    <span className="font-mono text-[10px] text-muted">
                      {step.status} · {step.durationMs} ms
                    </span>
                  )}
                </div>
                {step.outcome !== "ok" && (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{step.detail}</p>
                )}
                {step.requestId !== null && (
                  <p className="mt-0.5 font-mono text-[10px] text-muted">
                    request_id {step.requestId}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
