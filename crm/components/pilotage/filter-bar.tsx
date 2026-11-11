"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CHANNEL_LABELS, OUTREACH_CHANNELS } from "@/lib/domain/outreach";
import { PERIOD_KEYS, PERIOD_LABELS, sourceLabel } from "@/lib/domain/pilotage";

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
  niches,
  groups,
  sources,
}: {
  readonly campaigns: readonly { readonly id: string; readonly name: string }[];
  readonly owners: readonly string[];
  readonly niches: readonly { readonly key: string; readonly label: string; readonly count: number }[];
  readonly groups: readonly string[];
  readonly sources: readonly string[];
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
    /*
      **Sous 768 px, la barre se fait défiler sur le côté au lieu de s'empiler.**

      Mesuré avant d'y toucher : à 390 px, huit filtres empilés font **534 px de
      haut**, c'est-à-dire les deux tiers d'un écran de téléphone consommés par
      des menus qu'on ne change presque jamais. C'est ce qui repoussait le
      compteur manuel sous la ligne de flottaison, et le jalon 114 demande
      précisément qu'il soit cliquable sans défiler.

      Une rangée qui se défile du doigt est le même geste que la bande de
      portraits du jalon 15, et au-dessus de 768 px `flex-wrap` revient : la
      barre du bureau est **inchangée**, enveloppe comprise.
    */
    <div
      data-filter-bar
      className="mb-4 flex items-end gap-2 overflow-x-auto rounded-board border border-line bg-surface px-3.5 py-3 [&>*]:shrink-0 md:flex-wrap md:overflow-x-visible md:[&>*]:shrink"
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

      <Field label="Niche">
        <select
          value={value("niche")}
          data-filter="niche"
          onChange={(event) => write({ niche: event.target.value })}
          className={SELECT}
        >
          <option value="">Toutes</option>
          {niches.map((niche) => (
            <option key={niche.key} value={niche.key}>
              {niche.label} ({niche.count})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Fonction">
        <select
          value={value("fonction")}
          data-filter="fonction"
          onChange={(event) => write({ fonction: event.target.value })}
          className={SELECT}
        >
          <option value="">Toutes</option>
          {groups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </Field>

      {/*
        **L'origine, et c'est le filtre qu'on cherche en premier devant un total
        qui surprend.** Trois chemins écrivent des messages depuis le jalon 112 —
        le CRM, lemlist, le compteur manuel — et « ça vient d'où ? » est la
        première question posée à un chiffre inattendu.
      */}
      <Field label="Origine">
        <select
          value={value("origine")}
          data-filter="origine"
          onChange={(event) => write({ origine: event.target.value })}
          className={SELECT}
        >
          <option value="">Toutes</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {sourceLabel(source)}
            </option>
          ))}
        </select>
      </Field>

      {/*
        **La tranche de taille n'est pas dans la barre**, et c'est volontaire :
        le prototype ne la demande pas, et l'onglet « Segments » est l'écran qui
        la pose. Le filtre existe tout de même (`taille=` dans l'URL), parce que
        les liens de cet onglet doivent pouvoir ouvrir la liste d'une tranche.
        Quand il est posé, la barre le dit et sait le retirer — un filtre actif
        invisible est un filtre dont on accuse les chiffres.
      */}
      {value("taille") !== "" && (
        <button
          type="button"
          data-filter-clear="taille"
          onClick={() => write({ taille: "" })}
          className="h-9 rounded-control border border-brand bg-brand-l px-2.5 text-[12.5px] font-medium text-brand-d"
        >
          Tranche filtrée · retirer
        </button>
      )}
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
