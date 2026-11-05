"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CHANNEL_LABELS, OUTREACH_CHANNELS } from "@/lib/domain/outreach";
import { SEGMENTS, SEGMENT_LABELS } from "@/lib/domain/pilotage";
import { PERIOD_KEYS, PERIOD_LABELS } from "@/lib/api/pilotage";

/**
 * La barre de filtres du pilotage.
 *
 * **Tout l'état vit dans l'URL** : la vue se partage, se met en favori et
 * survit à un rechargement — la règle du jalon 1, et la seule façon de garder
 * la page en rendu serveur. Le composant écrit dans l'URL ; il ne reçoit aucun
 * gestionnaire, parce qu'une fonction ne franchit pas la frontière serveur →
 * client (jalon 12).
 *
 * Changer un filtre **remet la liste de détail à zéro** : on revient au tableau
 * de bord, pas sur une liste filtrée autrement que le nombre qui l'a ouverte.
 */
export function FilterBar({
  campaigns,
  owners,
}: {
  readonly campaigns: readonly { readonly id: string; readonly name: string }[];
  readonly owners: readonly string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const value = (key: string) => params.get(key) ?? "";

  function write(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, raw] of Object.entries(changes)) {
      if (raw === "") next.delete(key);
      else next.set(key, raw);
    }
    // Le tri et la métrique ouverte appartiennent à la vue d'avant.
    next.delete("metric");
    router.push(`${pathname}?${next.toString()}`);
  }

  const periode = value("periode") === "" ? "semaine" : value("periode");

  return (
    <div
      data-filter-bar
      className="mb-4 flex flex-wrap items-end gap-2 rounded-card border border-line bg-surface px-3.5 py-3"
    >
      <Field label="Période">
        <select
          value={periode}
          data-filter="periode"
          onChange={(event) => write({ periode: event.target.value })}
          className={SELECT}
        >
          {PERIOD_KEYS.map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </select>
      </Field>

      {periode === "libre" && (
        <>
          <Field label="Du">
            <input
              type="date"
              value={value("du")}
              data-filter="du"
              onChange={(event) => write({ du: event.target.value })}
              className={SELECT}
            />
          </Field>
          <Field label="Au">
            <input
              type="date"
              value={value("au")}
              data-filter="au"
              onChange={(event) => write({ au: event.target.value })}
              className={SELECT}
            />
          </Field>
        </>
      )}

      <Field label="Campagne">
        <select
          value={value("campagne")}
          data-filter="campagne"
          onChange={(event) => write({ campagne: event.target.value })}
          className={SELECT}
        >
          <option value="">Toutes</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Canal">
        <select
          value={value("canal")}
          data-filter="canal"
          onChange={(event) => write({ canal: event.target.value })}
          className={SELECT}
        >
          <option value="">Tous</option>
          {OUTREACH_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {CHANNEL_LABELS[channel]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Propriétaire">
        <select
          value={value("proprietaire")}
          data-filter="proprietaire"
          onChange={(event) => write({ proprietaire: event.target.value })}
          className={SELECT}
        >
          <option value="">Tous</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Segment">
        <select
          value={value("segment")}
          data-filter="segment"
          onChange={(event) => write({ segment: event.target.value })}
          className={SELECT}
        >
          <option value="">Tous</option>
          {SEGMENTS.map((segment) => (
            <option key={segment} value={segment}>
              {SEGMENT_LABELS[segment]}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

const SELECT =
  "h-9 rounded-control border border-line bg-surface px-2.5 text-[13px] focus:border-brand focus:outline-none";

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}
