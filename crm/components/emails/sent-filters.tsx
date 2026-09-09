import Link from "next/link";
import type { SentList, SentQuery } from "@/lib/api/email-list";

/**
 * La barre de filtres du journal des envois, et l'URL qu'elle écrit.
 *
 * Séparée du tableau pour la même raison que partout : la limite de 250 lignes
 * n'est pas un caprice, c'est le seuil au-delà duquel on ne relit plus un
 * composant en entier avant de le modifier.
 */

/** Construit une URL en conservant les autres paramètres. */
export function sentHref(query: SentQuery, patch: Partial<SentQuery>): string {
  const merged = { ...query, ...patch };
  const params = new URLSearchParams();
  if (merged.sort !== undefined) params.set("tri", merged.sort);
  if (merged.dir !== undefined) params.set("sens", merged.dir);
  if (merged.signatory !== undefined) params.set("signataire", merged.signatory);
  if (merged.sequence !== undefined) params.set("sequence", merged.sequence);
  if (merged.campaign !== undefined) params.set("campagne", merged.campaign);
  if (merged.state !== undefined) params.set("etat", merged.state);
  const text = params.toString();
  return text === "" ? "/emails" : `/emails?${text}`;
}

export function SentFilters({ list, query }: { readonly list: SentList; readonly query: SentQuery }) {
  const active =
    query.signatory !== undefined ||
    query.sequence !== undefined ||
    query.campaign !== undefined ||
    query.state !== undefined;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface px-3 py-2">
      <Chip href={sentHref({}, {})} active={!active} label={`Tous (${list.total})`} />
      <Chip
        href={sentHref(query, { state: "sans-reponse" })}
        active={query.state === "sans-reponse"}
        label="Sans réponse"
      />
      <Chip
        href={sentHref(query, { state: "repondu" })}
        active={query.state === "repondu"}
        label="Ont répondu"
      />
      <Chip
        href={sentHref(query, { state: "ouvert" })}
        active={query.state === "ouvert"}
        label="Ouverts"
      />

      {list.signatories.length > 1 &&
        list.signatories.map((name) => (
          <Chip
            key={name}
            href={sentHref(query, { signatory: name })}
            active={query.signatory === name}
            label={name}
          />
        ))}

      {/*
        **Les campagnes plutôt que les séquences.** Depuis le jalon 54 une
        séquence n'existe qu'au sein d'une campagne et porte son nom : deux
        rangées de puces identiques feraient choisir entre deux formulations
        d'une même question — c'est ce qui avait fait retirer « Déjà contactés »
        au jalon 31. La puce filtre sur l'**identifiant** ; le nom n'est que son
        libellé.
      */}
      {list.campaigns.map((campaign) => (
        <Chip
          key={campaign.id}
          href={sentHref(query, { campaign: campaign.id })}
          active={query.campaign === campaign.id}
          label={campaign.name}
        />
      ))}

      {/*
        `sequence` reste une valeur valide sans puce : un lien mis en favori
        avant ce jalon doit continuer d'ouvrir sa liste, et un filtre actif
        qu'aucun contrôle ne nomme est un écran qui ment (jalon 31).
      */}
      {query.sequence !== undefined && (
        <Chip
          href={sentHref(query, { sequence: undefined })}
          active
          label={`Séquence : ${query.sequence}`}
        />
      )}

      {active && (
        <Link
          scroll={false}
          href={sentHref({}, {})}
          className="ml-auto text-[11.5px] text-brand-d hover:underline"
        >
          Réinitialiser · {list.rows.length} sur {list.total}
        </Link>
      )}
    </div>
  );
}

function Chip({
  href: target,
  active,
  label,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly label: string;
}) {
  return (
    <Link
      scroll={false}
      href={target}
      className={`rounded-full border px-2.5 py-[3px] text-[11.5px] transition-colors ${
        active
          ? "border-brand bg-brand-l font-medium text-brand-d"
          : "border-line bg-surface text-muted hover:bg-surface-2"
      }`}
    >
      {label}
    </Link>
  );
}
