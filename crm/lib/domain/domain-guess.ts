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

/* ------------------------------------------------- ressemblance nom ↔ domaine */

/** Forme comparable d'une chaîne : sans accents, sans ponctuation, minuscule. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * L'étiquette d'un domaine : ce qui identifie la marque, sans `www.` ni
 * extension. `www.nubiance.fr` → `nubiance`, `march-lab.com` → `marchlab`.
 */
export function domainLabel(domain: string): string {
  const host = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return normalize((host ?? "").split(".")[0] ?? "");
}

/** Coefficient de Dice sur les bigrammes — 0 pour rien en commun, 1 pour identique. */
function diceCoefficient(left: string, right: string): number {
  if (left.length < 2 || right.length < 2) return left === right ? 1 : 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < left.length - 1; i += 1) {
    const pair = left.slice(i, i + 2);
    bigrams.set(pair, (bigrams.get(pair) ?? 0) + 1);
  }

  let shared = 0;
  for (let i = 0; i < right.length - 1; i += 1) {
    const pair = right.slice(i, i + 2);
    const left_ = bigrams.get(pair) ?? 0;
    if (left_ > 0) {
      bigrams.set(pair, left_ - 1);
      shared += 1;
    }
  }

  return (2 * shared) / (left.length - 1 + (right.length - 1));
}

/**
 * À quel point le domaine proposé ressemble-t-il au nom de la société ?
 *
 * **Ce n'est pas une mesure de justesse, c'est une mesure d'étonnement.** Un
 * score bas ne dit pas que le domaine est faux : « AGENCE INCARE Marketing »
 * chez `oomylab.com` peut très bien être exact, une agence n'ayant pas
 * l'obligation de porter le nom de son domaine. Il dit seulement que la valeur
 * mérite un regard avant d'être écrite.
 *
 * Ce que le score attrape réellement, et c'est pour cela qu'il existe :
 * l'adresse **erronée** dans la feuille source. « Absolution » et « Spring »
 * portent toutes deux un contact en `@teledyne.com` — deux sociétés françaises
 * de cosmétique rattachées à un électronicien américain. La ressemblance y est
 * nulle, et c'est le signal.
 *
 * L'inclusion vaut 1 : « nateev » dans « agencenateev », « 23beauty » dans
 * « 23beautyparis ». Le reste passe par Dice sur les bigrammes.
 */
export function nameSimilarity(companyName: string, domain: string): number {
  const name = normalize(companyName);
  const label = domainLabel(domain);
  if (name === "" || label === "") return 0;
  if (name === label) return 1;
  if (name.includes(label) || label.includes(name)) return 1;
  return diceCoefficient(name, label);
}

/**
 * En dessous de ce score, la ligne est remontée en tête et porte un repère.
 *
 * Calé sur la base vérifiée : au-dessus, on trouve les correspondances
 * évidentes (`numorning.com` pour Numorning) ; en dessous, les domaines qui
 * n'ont rien à voir avec le nom — dont les deux `teledyne.com`.
 */
export const SUSPICIOUS_BELOW = 0.34;

export function isSuspicious(companyName: string, domain: string): boolean {
  return nameSimilarity(companyName, domain) < SUSPICIOUS_BELOW;
}

/* --------------------------------------------- compte rendu d'une acceptation */

/**
 * Pourquoi une ligne a été ignorée, au singulier et au pluriel.
 *
 * Deux formes plutôt qu'un « (s) » collé : le compte rendu d'une action qui
 * vient d'écrire quatre-vingts lignes se lit une fois et doit être limpide du
 * premier coup. « 4 ignorés (déjà renseignés) » se lit ; « 4 ignoré(s) (déjà
 * renseigné) » se déchiffre.
 */
export const SKIP_REASONS = {
  filled: { one: "déjà renseigné", many: "déjà renseignés" },
  notDeduced: { one: "n'est plus une déduction", many: "ne sont plus des déductions" },
  changed: { one: "la proposition a changé", many: "les propositions ont changé" },
  missing: { one: "société introuvable", many: "sociétés introuvables" },
} as const;

export type SkipReason = keyof typeof SKIP_REASONS;

/**
 * « 84 domaines écrits · 4 ignorés (déjà renseignés) » — ce qui s'est passé,
 * exactement, sans avoir à ouvrir le détail.
 */
export function describeBulkOutcome(
  written: number,
  skipped: readonly SkipReason[],
): string {
  const wrote = written === 1 ? "1 domaine écrit" : `${written} domaines écrits`;
  if (skipped.length === 0) return wrote;

  // Une raison par catégorie présente, accordée sur le nombre de lignes
  // qu'elle a fait écarter — pas sur le total ignoré.
  const counts = new Map<SkipReason, number>();
  for (const reason of skipped) counts.set(reason, (counts.get(reason) ?? 0) + 1);

  const parts = [...counts.entries()].map(([reason, count]) =>
    count === 1 ? SKIP_REASONS[reason].one : SKIP_REASONS[reason].many,
  );

  const ignored = skipped.length === 1 ? "1 ignoré" : `${skipped.length} ignorés`;
  return `${wrote} · ${ignored} (${parts.join(", ")})`;
}
