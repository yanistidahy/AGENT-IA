"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client/http";
import { CONTACT_GROUPS, GROUP_LABELS } from "@/lib/domain/contact-group";
import {
  describeCounts,
  describeRouting,
  OTHER_ROUTINGS,
  parseGroupFilter,
  ROUTING_LABELS,
  serializeGroupFilter,
  unclassifiedWarning,
  type OtherRouting,
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

export interface MissingValueRow {
  readonly value: string;
  readonly contacts: readonly { readonly id: string; readonly name: string }[];
}

export function GroupTargeting({
  campaignId,
  groupFilter,
  otherRouting,
  counts,
  missing,
}: {
  readonly campaignId: string;
  readonly groupFilter: string;
  readonly otherRouting: OtherRouting;
  readonly counts: Counts;
  /** Les destinataires dont une valeur utilisée par le texte manque. */
  readonly missing: readonly MissingValueRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /*
    **Les deux réglages sont tenus ici, en local, et c'est un correctif.**

    `campaign-detail.tsx` recopie la campagne dans son propre `useState` au
    montage : `router.refresh()` réécrit bien la prop, et ce `useState` l'ignore.
    Conséquence mesurée dans un navigateur avant ce correctif : le clic écrivait
    en base et **la phrase ne bougeait pas** — un contrôle qui répond sans que
    l'écran change se lit comme une panne, et l'on reclique (jalons 41, 60).

    L'état local est donc optimiste : il change au clic, et **revient en arrière**
    si le serveur refuse. Il ne dépend d'aucun rafraîchissement qu'un parent
    pourrait avaler.
  */
  const [filter, setFilter] = useState(groupFilter);
  const [routing, setRouting] = useState(otherRouting);

  const routingNote = describeRouting(
    { autre: counts.byGroup.autre ?? 0, unclassified: counts.unclassified },
    routing,
  );
  const selected = parseGroupFilter(filter);
  const warning = unclassifiedWarning(counts.unclassified);

  const toggle = async (group: string) => {
    const next = selected.includes(group as (typeof CONTACT_GROUPS)[number])
      ? selected.filter((entry) => entry !== group)
      : [...selected, group];
    const previous = filter;
    setFilter(serializeGroupFilter(next));
    setBusy(true);
    const result = await requestJson(
      "/api/campaigns/actions",
      {
        method: "POST",
        body: JSON.stringify({ action: "group-filter", campaignId, groups: next }),
      },
      isPayload,
    );
    setBusy(false);
    if (!result.ok) {
      setFilter(previous);
      setNote(result.message);
      return;
    }
    router.refresh();
  };

  const route = async (next: OtherRouting) => {
    const previous = routing;
    setRouting(next);
    setBusy(true);
    const result = await requestJson(
      "/api/campaigns/actions",
      {
        method: "POST",
        body: JSON.stringify({ action: "other-routing", campaignId, routing: next }),
      },
      isPayload,
    );
    setBusy(false);
    if (!result.ok) {
      setRouting(previous);
      setNote(result.message);
      return;
    }
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

      {/*
        **Le routage, et il ne classe personne.** « Autre » et « Non classé »
        doivent bien recevoir *un* texte, et « le message par défaut de l'étape »
        n'est pas toujours celui qu'on veut leur envoyer. Ce réglage choisit
        **quelle variante ils reçoivent** — il n'écrit jamais le groupe de la
        fiche, et le dire ici évite de croire qu'on vient de reclasser six
        personnes.
      */}
      <div className="mt-3 rounded-control border border-line bg-surface-2 p-2.5">
        <p className="text-[12px] font-semibold text-ink">
          Les contacts Autre et non classés reçoivent
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {OTHER_ROUTINGS.map((entry) => {
            const active = routing === entry;
            return (
              <button
                key={entry}
                type="button"
                data-routing={entry}
                aria-pressed={active}
                disabled={busy}
                onClick={() => void route(entry)}
                className={`min-h-[44px] rounded-control border px-2.5 text-[12px] disabled:opacity-45 lg:min-h-0 lg:py-1 ${
                  active
                    ? "border-brand bg-brand-l font-semibold text-brand-d"
                    : "border-line bg-surface text-muted hover:border-brand"
                }`}
              >
                {ROUTING_LABELS[entry]}
              </button>
            );
          })}
        </div>
        {routingNote !== "" && (
          <p className="mt-1.5 text-[12px] text-ink" data-routing-note>
            {routingNote}
          </p>
        )}
        <p className="mt-1 text-[11.5px] text-muted">
          Routage seulement : le groupe de fonction de la fiche n&apos;est pas modifié.
        </p>
      </div>

      {/*
        **Les phrases qui vont disparaître, comptées avant l'envoi.** Le retrait
        est la bonne règle — une phrase construite autour d'un nom qu'on n'a pas
        ne survit pas à son retrait — mais il se découvrait à la réception. Ici
        il se lit, avec le lien vers chaque fiche : c'est souvent la société qui
        manque, et elle se saisit en dix secondes.
      */}
      {missing.map((row) => (
        <div
          key={row.value}
          className="mt-2 rounded-control border border-gold bg-gold-l p-2 text-[12px] text-ink"
        >
          <p className="font-semibold">
            {row.contacts.length} destinataire{row.contacts.length > 1 ? "s" : ""} sans{" "}
            {row.value} : une phrase sera retirée de leur mail
          </p>
          <p className="mt-1 text-[11.5px]">
            {row.contacts.slice(0, 12).map((contact, index) => (
              <span key={contact.id}>
                {index > 0 ? " · " : ""}
                <a
                  href={`/contacts?fiche=${encodeURIComponent(contact.id)}`}
                  className="text-brand-d hover:underline"
                >
                  {contact.name}
                </a>
              </span>
            ))}
            {row.contacts.length > 12 ? ` · et ${row.contacts.length - 12} autres` : ""}
          </p>
        </div>
      ))}

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
