"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { MaintenanceBlock as Block } from "./maintenance-block";
import { StatusesBlock, type StatusPlan } from "./statuses-block";

/**
 * Corrections de données, simulées à l'écran puis confirmées.
 *
 * Railway n'expose pas de terminal attaché au service : sans ce panneau, ces
 * corrections ne seraient exécutables que par quelqu'un ayant le dépôt, la CLI
 * et l'URL de la base. C'est donc le chemin normal, et il appelle exactement le
 * même code que `scripts/` — une seule logique, deux façades.
 *
 * Rien ne s'écrit sans avoir été affiché d'abord : « Simuler » lit, « Appliquer »
 * écrit, et le serveur refuse si la base a bougé entre les deux.
 */
interface SearchPlan {
  total: number;
  contacts: number;
  companies: number;
  deals: number;
  sample: Array<{ label: string; before: string; after: string }>;
}

interface LifecyclePlan {
  total: number;
  unchanged: number;
  uncertain: number;
  warnings: string[];
  changes: Array<{
    label: string;
    from: string;
    to: string;
    lostReason: string;
    evidence: string;
    uncertain: boolean;
  }>;
}

interface NamePlan {
  total: number;
  rows: Array<{ before: string; kept: string; moved: string }>;
}

interface Plans {
  search: SearchPlan;
  lifecycles: LifecyclePlan;
  names: NamePlan;
  statuses: StatusPlan;
}

function isPlans(value: unknown): value is Plans {
  return typeof value === "object" && value !== null && "search" in value && "lifecycles" in value;
}

function isApplied(value: unknown): value is { applied: number; snapshot?: unknown } {
  return typeof value === "object" && value !== null && "applied" in value;
}

const BUTTON =
  "rounded-control px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50";

export function MaintenancePanel() {
  const [plans, setPlans] = useState<Plans | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const simulate = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson("/api/maintenance", { method: "GET" }, isPlans);
    setBusy(false);
    if (result.ok) setPlans(result.data);
    else setError(result.message);
  };

  const apply = async (
    operation: "search" | "lifecycles" | "names" | "statuses",
    expected: number,
    what: string,
  ) => {
    if (!window.confirm(`${what}\n\nCette action écrit en base. Continuer ?`)) return;

    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/maintenance",
      { method: "POST", body: JSON.stringify({ operation, expected }) },
      isApplied,
    );
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    // La sauvegarde descend dans le navigateur : le conteneur n'a pas de disque
    // durable, un fichier écrit à côté disparaîtrait au prochain déploiement.
    if (result.data.snapshot !== undefined) {
      const blob = new Blob([JSON.stringify(result.data.snapshot, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sauvegarde-statuts-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }

    setDone(`${result.data.applied} ligne(s) corrigée(s).`);
    void simulate();
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void simulate()}
          className={`${BUTTON} border border-line bg-surface hover:bg-surface-2`}
        >
          {busy ? "Lecture…" : "Simuler les corrections"}
        </button>
        <span className="text-[12px] text-muted">Aucune écriture : la simulation lit seulement.</span>
      </div>

      {error !== null && (
        <p className="mt-2 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
      {done !== null && <p className="mt-2 text-[12.5px] text-win-d">{done}</p>}

      {plans !== null && (
        <div className="mt-3 grid gap-3">
          <Block
            title="Miroir de recherche"
            summary={`${plans.search.total} ligne(s) à corriger — ${plans.search.contacts} contacts, ${plans.search.companies} sociétés, ${plans.search.deals} affaires.`}
            hint="Champ dérivé : le recalculer ne peut rien perdre. Les fiches importées avant le correctif sont introuvables à la recherche tant que ceci n'est pas passé."
            disabled={busy || plans.search.total === 0}
            onApply={() =>
              void apply(
                "search",
                plans.search.total,
                `Recalculer le miroir de recherche de ${plans.search.total} ligne(s).`,
              )
            }
          >
            {plans.search.sample.map((row) => (
              <li key={row.label} className="truncate">
                {row.label} : « {row.before || "vide"} » → « {row.after} »
              </li>
            ))}
          </Block>

          <Block
            title="Noms débordés"
            summary={`${plans.names.total} nom(s) contenant une note avalée à l'import.`}
            hint="Le débordement part dans les Notes, ajouté à ce qui s'y trouve déjà — jamais substitué. Deux champs touchés : le nom concerné et les notes."
            disabled={busy || plans.names.total === 0}
            onApply={() =>
              void apply(
                "names",
                plans.names.total,
                `Déplacer le débordement de ${plans.names.total} nom(s) vers les Notes.`,
              )
            }
          >
            {plans.names.rows.map((row) => (
              <li key={row.before} className="truncate">
                « {row.before} » → nom « {row.kept} » + notes « {row.moved} »
              </li>
            ))}
          </Block>

          <StatusesBlock plan={plans.statuses} busy={busy} onApply={apply} />

          <Block
            title="Cycles de vie"
            summary={`${plans.lifecycles.total} fiche(s) à modifier, ${plans.lifecycles.unchanged} déjà à jour, ${plans.lifecycles.uncertain} rapprochement(s) incertain(s).`}
            hint="N'écrit que le cycle de vie et le motif de perte. Une interaction est consignée sur chaque fiche, et la sauvegarde est téléchargée avant écriture."
            disabled={busy || plans.lifecycles.total === 0}
            onApply={() =>
              void apply(
                "lifecycles",
                plans.lifecycles.total,
                `Corriger le statut de ${plans.lifecycles.total} fiche(s). Une sauvegarde sera téléchargée.`,
              )
            }
          >
            {plans.lifecycles.warnings.map((warning) => (
              <li key={warning} className="text-[#9A6410]">
                ⚠ {warning}
              </li>
            ))}
            {plans.lifecycles.changes.map((change) => (
              <li key={change.label}>
                <b className="font-semibold">{change.label}</b> — {change.from} → {change.to}
                {change.lostReason === "" ? "" : ` · ${change.lostReason}`}
                {change.uncertain && <span className="text-[#9A6410]"> [incertain]</span>}
              </li>
            ))}
          </Block>
        </div>
      )}
    </section>
  );
}
