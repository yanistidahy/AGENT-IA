"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { formatDate } from "@/lib/format";

/**
 * Journal des vacations et déclenchement manuel.
 *
 * Le journal n'est pas décoratif : sans lui, une vacation qui échoue chaque nuit
 * est indiscernable d'une vacation qui n'a rien à dire. Chaque ligne porte donc
 * sa durée, son coût en jetons et son issue — y compris `error`.
 */
interface Run {
  id: string;
  agentId: string;
  startedAt: string;
  durationMs: number | null;
  outcome: string;
  detail: string;
  inputTokens: number;
  outputTokens: number;
  produced: number;
  manual: boolean;
}

interface Payload {
  runs: Run[];
  usage: { runs: number; inputTokens: number; outputTokens: number };
}

function isPayload(value: unknown): value is Payload {
  return typeof value === "object" && value !== null && "runs" in value && "usage" in value;
}

const OUTCOME_LABELS: Record<string, string> = {
  ok: "recommandations produites",
  empty: "rien à signaler",
  skipped: "non lancée",
  error: "échec",
};

const BUTTON =
  "rounded-control border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50";

export function ShiftsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson("/api/shifts", { method: "GET" }, isPayload);
    setBusy(false);
    if (result.ok) setData(result.data);
    else setError(result.message);
  };

  const trigger = async () => {
    if (!window.confirm("Lancer les vacations maintenant ? Elles lisent le CRM et consomment des jetons.")) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/shifts",
      { method: "POST" },
      (value): value is unknown => value !== undefined,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    void load();
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void load()} className={BUTTON}>
          {busy ? "Lecture…" : "Voir le journal"}
        </button>
        <button type="button" disabled={busy} onClick={() => void trigger()} className={BUTTON}>
          Lancer les vacations maintenant
        </button>
      </div>

      {error !== null && <p className="mt-2 text-[12.5px] text-[#B2311F]">{error}</p>}

      {data !== null && (
        <>
          <p className="mt-3 text-[12.5px]">
            <b className="font-mono">{data.usage.runs}</b> vacation(s) ce mois-ci ·{" "}
            <b className="font-mono">{data.usage.inputTokens.toLocaleString("fr-FR")}</b> jetons
            d'entrée ·{" "}
            <b className="font-mono">{data.usage.outputTokens.toLocaleString("fr-FR")}</b> de sortie
          </p>

          <ul className="mt-2 grid max-h-[320px] gap-1 overflow-y-auto text-[12px]">
            {data.runs.length === 0 && (
              <li className="text-muted">Aucune vacation enregistrée.</li>
            )}
            {data.runs.map((run) => (
              <li
                key={run.id}
                className={`rounded-control border px-2.5 py-1.5 ${
                  run.outcome === "error" ? "border-[#F0C9C2] bg-pulse-l" : "border-line"
                }`}
              >
                <b className="font-semibold">{run.agentId}</b> ·{" "}
                {formatDate(new Date(run.startedAt))} ·{" "}
                {OUTCOME_LABELS[run.outcome] ?? run.outcome}
                {run.produced > 0 && ` (${run.produced})`}
                {run.manual && " · manuel"}
                <span className="ml-1 text-muted">
                  {run.durationMs === null ? "" : `${Math.round(run.durationMs / 100) / 10} s`} ·{" "}
                  {run.inputTokens + run.outputTokens} jetons
                </span>
                {run.detail !== "" && (
                  <span className="mt-0.5 block text-muted italic">{run.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
