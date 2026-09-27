"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client/http";
import { CONTACT_GROUPS, GROUP_LABELS } from "@/lib/domain/contact-group";
import {
  describeCounts,
  parseGroupFilter,
  unclassifiedWarning,
} from "@/lib/domain/step-variants";

/**
 * **À qui cette campagne parle, et qui n'est pas encore classé.**
 *
 * Deux choses, et la seconde est la plus importante : le compteur par groupe
 * **avant** d'envoyer, et l'avertissement quand des fiches n'ont jamais été
 * classées. Sans ce dernier, un filtre « Direction » posé sur un portefeuille
 * non classé rendrait une liste silencieusement fausse — et la bonne réponse
 * n'est pas de compter ces fiches sous « Autre », c'est de les classer, d'où le
 * bouton ici même plutôt qu'un renvoi vers un autre écran.
 */

interface Counts {
  readonly byGroup: Readonly<Record<string, number>>;
  readonly unclassified: number;
  readonly total: number;
}

function isPayload(value: unknown): value is { message?: string } {
  return typeof value === "object" && value !== null;
}

export function GroupTargeting({
  campaignId,
  groupFilter,
  counts,
}: {
  readonly campaignId: string;
  readonly groupFilter: string;
  readonly counts: Counts;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const selected = parseGroupFilter(groupFilter);
  const warning = unclassifiedWarning(counts.unclassified);

  const toggle = async (group: string) => {
    const next = selected.includes(group as (typeof CONTACT_GROUPS)[number])
      ? selected.filter((entry) => entry !== group)
      : [...selected, group];
    setBusy(true);
    await requestJson(
      "/api/campaigns/actions",
      {
        method: "POST",
        body: JSON.stringify({ action: "group-filter", campaignId, groups: next }),
      },
      isPayload,
    );
    setBusy(false);
    router.refresh();
  };

  const recompute = async () => {
    setBusy(true);
    const result = await requestJson(
      "/api/contact-groups",
      { method: "POST", body: JSON.stringify({ action: "recompute" }) },
      isPayload,
    );
    setBusy(false);
    setNote(result.ok ? (result.data.message ?? "Groupes recalculés.") : result.message);
    router.refresh();
  };

  return (
    <section className="mt-4 rounded-card border border-line bg-surface p-3.5">
      <h3 className="font-display text-[14px]">Groupes de fonction</h3>

      <p className="mt-1 text-[12.5px] text-ink">{describeCounts(counts)}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11.5px] font-semibold text-muted">Écrire à</span>
        {CONTACT_GROUPS.map((group) => {
          const active = selected.includes(group);
          return (
            <button
              key={group}
              type="button"
              aria-pressed={active}
              disabled={busy}
              onClick={() => void toggle(group)}
              className={`min-h-[44px] rounded-control border px-2.5 text-[12px] disabled:opacity-45 lg:min-h-0 lg:py-1 ${
                active
                  ? "border-brand bg-brand-l font-semibold text-brand-d"
                  : "border-line bg-surface text-muted hover:border-brand"
              }`}
            >
              {GROUP_LABELS[group]} {counts.byGroup[group] ?? 0}
            </button>
          );
        })}
      </div>

      <p className="mt-1.5 text-[11.5px] text-muted">
        {selected.length === 0
          ? "Aucun groupe coché : la campagne écrit à tout le monde, comme avant les groupes."
          : "Seuls les groupes cochés seront inscrits à la prochaine inscription. Les inscrits actuels ne sont pas retirés."}
      </p>

      {warning !== "" && (
        <p className="mt-2 rounded-control border border-danger bg-surface p-2 text-[12px] text-danger">
          {warning}
          <button
            type="button"
            disabled={busy}
            onClick={() => void recompute()}
            className="ml-2 min-h-[44px] rounded-control border border-danger px-2 font-semibold disabled:opacity-45 lg:min-h-0 lg:py-1"
          >
            Recalculer les groupes
          </button>
          <span className="mt-1 block text-[11.5px] text-muted">
            Une fiche jamais classée n&apos;est pas « Autre » : c&apos;est une fonction que
            personne n&apos;a encore lue. Elle n&apos;entre dans aucun groupe, donc aucun
            filtre ne la retient.
          </span>
        </p>
      )}

      {note !== null && <p className="mt-2 text-[12px] text-win-d">{note}</p>}
    </section>
  );
}
