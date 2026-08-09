"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatBytes } from "@/lib/domain/snapshots";

/**
 * Sauvegardes automatiques : ce qui existe, et comment y revenir.
 *
 * La liste vient du **magasin**, pas du journal : ce qui compte au moment de
 * restaurer, c'est ce qui est réellement là. Le journal sert à comprendre
 * pourquoi il manque quelque chose.
 */

interface Snapshot {
  readonly key: string;
  readonly takenAt: string;
  readonly bytes: number;
}

interface Run {
  readonly id: string;
  readonly startedAt: string;
  readonly outcome: string;
  readonly key: string;
  readonly bytes: number;
  readonly pruned: number;
  readonly detail: string;
  readonly manual: boolean;
}

interface Payload {
  readonly configured: boolean;
  readonly where: string;
  readonly durable: boolean;
  readonly snapshots: readonly Snapshot[];
  readonly problem: string | null;
  readonly runs: readonly Run[];
}

function isPayload(value: unknown): value is Payload {
  return typeof value === "object" && value !== null && "snapshots" in value;
}

const WHEN = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const BUTTON =
  "rounded-control border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50";

export function SnapshotsPanel() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/snapshots");
      const payload: unknown = await response.json();
      if (response.ok && isPayload(payload)) setData(payload);
    } catch {
      setError("Impossible de lire l'état des sauvegardes.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: unknown, done: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error: { message?: unknown } }).error?.message === "string"
            ? (payload as { error: { message: string } }).error.message
            : "L'opération a échoué.";
        setError(message);
        return;
      }
      setNotice(done);
      await load();
      router.refresh();
    } catch {
      setError("La connexion au serveur a été interrompue.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  return (
    <div>
      {data !== null && (
        <p className="mb-1.5 text-[12.5px] text-muted">
          Destination : <b className="font-semibold">{data.where}</b>
          {!data.durable && (
            <span className="ml-1.5 text-[#B2311F]">
              — ce disque est effacé à chaque déploiement, il ne protège de rien en production.
            </span>
          )}
        </p>
      )}

      {data?.problem !== null && data?.problem !== undefined && (
        <p className="mb-2 text-[12.5px] text-[#B2311F]">{data.problem}</p>
      )}

      <button type="button" className={BUTTON} disabled={busy} onClick={() => void post({ action: "take" }, "Sauvegarde effectuée.")}>
        {busy ? "En cours…" : "Sauvegarder maintenant"}
      </button>

      {notice !== null && <p className="mt-2 text-[12.5px] text-flux-d">{notice}</p>}
      {error !== null && <p className="mt-2 text-[12.5px] text-[#B2311F]">{error}</p>}

      {data !== null && data.snapshots.length === 0 && data.problem === null && (
        <p className="mt-2 text-[12.5px] text-muted">
          Aucun instantané pour l'instant. Le premier arrivera au prochain passage quotidien.
        </p>
      )}

      {data !== null && data.snapshots.length > 0 && (
        <ul className="mt-2.5 grid gap-1">
          {data.snapshots.map((snapshot) => (
            <li
              key={snapshot.key}
              className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface-2 px-2.5 py-1.5"
            >
              <span className="text-[12.5px]">{WHEN.format(new Date(snapshot.takenAt))}</span>
              <span className="font-mono text-[11px] text-muted">{formatBytes(snapshot.bytes)}</span>
              <span className="flex-1" />

              {confirming === snapshot.key ? (
                <>
                  {/* La restauration remplace tout : elle mérite un second geste. */}
                  <span className="text-[11.5px] text-[#B2311F]">
                    Remplacer toutes les données actuelles ?
                  </span>
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={busy}
                    onClick={() =>
                      void post(
                        { action: "restore", key: snapshot.key },
                        `Restauré depuis ${snapshot.key}.`,
                      )
                    }
                  >
                    Oui, restaurer
                  </button>
                  <button type="button" className={BUTTON} disabled={busy} onClick={() => setConfirming(null)}>
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={BUTTON}
                  disabled={busy}
                  onClick={() => setConfirming(snapshot.key)}
                >
                  Restaurer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {data !== null && data.runs.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] text-muted">Journal des sauvegardes</summary>
          <ul className="mt-1.5 grid gap-1">
            {data.runs.map((run) => (
              <li
                key={run.id}
                className={`rounded-control border px-2.5 py-1.5 text-[12px] ${
                  run.outcome === "ok" ? "border-line bg-surface" : "border-[#F0C9C2] bg-pulse-l"
                }`}
              >
                <span className="font-mono text-[11px] text-muted">
                  {new Date(run.startedAt).toLocaleString("fr-FR")}
                </span>{" "}
                — {run.outcome === "ok" ? `${formatBytes(run.bytes)}` : "échec"}
                {run.pruned > 0 && ` · ${run.pruned} élagué(s)`}
                {run.manual && " · manuelle"}
                {run.detail !== "" && (
                  <span className="mt-0.5 block leading-relaxed text-muted">{run.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
