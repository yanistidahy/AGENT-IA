/**
 * Propositions de domaine pour les sociétés qui n'en ont pas.
 *
 * **Ce module ne vérifie rien et ne peut rien vérifier.** Il ne fait aucun
 * appel réseau, et c'est délibéré : un domaine deviné qui *répond* peut très
 * bien appartenir à quelqu'un d'autre. Une page qui s'affiche ne prouve pas
 * qu'elle appartient au prospect — elle prouve seulement que le nom est
 * déposé. Vérifier depuis le serveur transformerait une supposition en fait
 * apparent, ce qui est précisément le piège : on découvrirait l'erreur devant
 * un client, avec un lien vers le site d'un tiers.
 *
 * Tout ce qui sort d'ici est donc une **proposition à relire**, jamais une
 * valeur à écrire d'office.
 *
 * Deux règles, et l'écart de fiabilité entre elles est la seule chose à
 * retenir :
 *
 * - `email` — le domaine d'une adresse professionnelle **déjà saisie** sur une
 *   fiche de la société. Ce n'est pas une invention : c'est une déduction à
 *   partir d'une donnée que quelqu'un a tapée. Sur la base vérifiée, elle
 *   couvre 85 des 115 sociétés sans domaine.
 * - `name` — le nom de la société transformé en domaine. C'est une **pure
 *   supposition**, utile comme point de départ de la relecture et rien de plus.
 *
 * Même la règle `email` se trompe : « Absolution » et « Spring » portent des
 * contacts en `@teledyne.com`, une adresse manifestement erronée dans la
 * feuille source. C'est pourquoi il n'y a pas d'application en masse.
 */

/** Fournisseurs grand public : leur domaine n'est jamais celui d'une société. */
const FREE_PROVIDERS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.fr",
  "ymail.com",
  "hotmail.com",
  "hotmail.fr",
  "outlook.com",
  "outlook.fr",
  "live.fr",
  "live.com",
  "msn.com",
  "wanadoo.fr",
  "orange.fr",
  "free.fr",
  "sfr.fr",
  "laposte.net",
  "bbox.fr",
  "numericable.fr",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "gmx.fr",
  "gmx.com",
  "protonmail.com",
  "proton.me",
  "yandex.com",
]);

export type DomainRule = "email" | "name";
export type DomainConfidence = "high" | "low";

export interface DomainProposal {
  readonly value: string;
  readonly rule: DomainRule;
  readonly confidence: DomainConfidence;
  /** Phrase française disant d'où vient la valeur, affichée telle quelle. */
  readonly because: string;
}

/** Le domaine d'une adresse, en minuscules, ou `null` si elle n'en porte pas. */
export function emailDomain(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at === -1) return null;

  const domain = email.trim().toLowerCase().slice(at + 1);
  // Un point au moins, et rien qui ressemble à une adresse tronquée.
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) return null;
  return domain;
}

/** `true` si le domaine est celui d'une messagerie grand public. */
export function isFreeProvider(domain: string): boolean {
  return FREE_PROVIDERS.has(domain.toLowerCase());
}

/**
 * Mots qui décrivent une activité plutôt qu'une marque. Retirés seulement
 * quand il reste quelque chose après — « Agence nateev » donne `nateev`, mais
 * une société qui s'appellerait « Agence » garde son nom.
 */
const GENERIC_WORDS: ReadonlySet<string> = new Set([
  "agence",
  "laboratoire",
  "laboratoires",
  "expert",
  "experts",
  "boutique",
  "groupe",
  "sarl",
  "sas",
  "sasu",
  "eurl",
]);

/**
 * Nom de société transformé en libellé de domaine.
 *
 * Accents retirés, ponctuation et espaces supprimés — c'est la forme qu'ont
 * la plupart des marques DTC françaises (« Comme Avant » → `commeavant`,
 * « Le sourcil » → `lesourcil`). Rend `null` quand il ne reste rien
 * d'exploitable.
 */
export function nameSlug(name: string): string | null {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "");

  if (words.length === 0) return null;

  const kept = words.filter((word) => !GENERIC_WORDS.has(word));
  const slug = (kept.length > 0 ? kept : words).join("");

  // Un slug d'un seul caractère ne désigne rien ; deux chiffres non plus.
  return slug.length >= 2 && /[a-z]/.test(slug) ? slug : null;
}

/**
 * Une proposition pour une société, ou `null` s'il n'y a rien d'honnête à
 * proposer.
 *
 * L'ordre des règles est l'ordre de fiabilité : une adresse professionnelle
 * déjà saisie l'emporte toujours sur le nom. Une société dont tous les
 * contacts sont chez Gmail retombe donc sur le nom, en confiance basse.
 */
export function proposeDomain(
  companyName: string,
  contactEmails: readonly string[],
): DomainProposal | null {
  const counts = new Map<string, number>();
  for (const email of contactEmails) {
    const domain = emailDomain(email);
    if (domain === null || isFreeProvider(domain)) continue;
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }

  if (counts.size > 0) {
    // Le plus fréquent ; à égalité, l'ordre alphabétique tranche pour que deux
    // simulations sur la même base ne proposent jamais deux valeurs
    // différentes.
    const ranked = [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    );
    const best = ranked[0];
    if (best !== undefined) {
      const [value, count] = best;
      const ambiguous = counts.size > 1;
      return {
        value,
        rule: "email",
        confidence: ambiguous ? "low" : "high",
        because: ambiguous
          ? `${counts.size} domaines différents parmi les adresses des contacts ; « ${value} » est le plus fréquent (${count})`
          : `adresse professionnelle déjà saisie sur ${count} fiche(s) de cette société`,
      };
    }
  }

  const slug = nameSlug(companyName);
  if (slug === null) return null;

  return {
    value: `${slug}.com`,
    rule: "name",
    confidence: "low",
    because: "supposition à partir du nom de la société — aucune adresse professionnelle sur ses fiches",
  };
}
