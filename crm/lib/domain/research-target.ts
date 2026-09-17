import { emailDomain, isFreeProvider } from "./domain-guess";

/**
 * **Quel site Alex va lire, et d'où vient cette adresse.**
 *
 * Jusqu'au jalon 74, la cible s'arrêtait à deux champs saisis : le site de la
 * fiche, à défaut le domaine de la société. Or l'adresse électronique porte le
 * domaine **littéralement** : `roxana.beraud@dermoplant.com` dit que le site
 * est `dermoplant.com`. Ne pas le lire faisait afficher « aucun site connu »
 * sur des fiches qui en portaient un depuis toujours.
 *
 * ### Ce n'est pas la supposition refusée au jalon 25
 *
 * La règle `name` de `domain-guess` fabrique `bacha.com` à partir de « Bacha »
 * et se trompe : rien dans la donnée ne dit que ce domaine existe, encore moins
 * qu'il appartient au prospect. Ici, la chaîne est **dans la valeur saisie** :
 * on ne devine pas le domaine, on le lit. C'est la même distinction que le
 * jalon 25 faisait déjà entre ses deux règles, et c'est pour cela que seule la
 * règle `email` avait le droit d'être acceptée en bloc.
 *
 * **Un cran moins sûr qu'un champ saisi, tout de même**, et c'est pourquoi la
 * source voyage jusqu'à l'écran : une adresse peut être celle d'un revendeur,
 * d'une agence, ou fausse dans le fichier source (`@teledyne.com` sur deux
 * marques de cosmétique, jalon 26). Si la lecture rend autre chose qu'un site
 * marchand, c'est un **échec de recherche** à nommer, jamais une licence à
 * inventer des faits : la règle du jalon 73 ne bouge pas d'un pouce.
 *
 * ### Les fournisseurs grand public sont exclus, évidemment
 *
 * Une adresse `@gmail.com` ne dit rien de la société, et documenter `gmail.com`
 * serait absurde. La liste est celle de `domain-guess` (jalon 25) : **une
 * seule**, parce que deux listes d'exclusion finiraient par diverger et que
 * c'est toujours la seconde qu'on oublie de compléter.
 */

export type TargetSource = "contact-site" | "company-domain" | "email";

/** Ce que l'écran dit de la provenance. Accordé pour tenir entre parenthèses. */
export const TARGET_LABELS: Readonly<Record<TargetSource, string>> = {
  "contact-site": "fiche",
  "company-domain": "société",
  email: "déduit de l'adresse email",
};

export interface ResearchTarget {
  /** L'adresse complète à lire, schéma compris. */
  readonly url: string;
  /** L'hôte seul, pour l'afficher : `dermoplant.com`. */
  readonly host: string;
  readonly source: TargetSource;
}

/**
 * Une valeur saisie devient une adresse lisible, ou `null`.
 *
 * Un « site » qui n'est pas un domaine — « Shopify », un titre de page — ne se
 * lit pas. C'est le cas des 59 fiches du jalon 24, et le deviner enverrait le
 * modèle chercher une entreprise qui n'existe pas.
 */
export function normalizeSite(raw: string): { url: string; host: string } | null {
  const value = raw.trim();
  if (value === "") return null;

  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname.includes(".")) return null;
    return { url: parsed.toString(), host: parsed.hostname.replace(/^www\./i, "") };
  } catch {
    return null;
  }
}

export interface TargetInput {
  /** Le champ « site » de la fiche du contact. */
  readonly website: string;
  /** Le domaine de la société rattachée. */
  readonly companyDomain: string;
  /** Les adresses des fiches de cette société, la plus pertinente d'abord. */
  readonly emails: readonly string[];
}

/**
 * La cible de recherche, dans l'ordre de certitude décroissante.
 *
 * L'ordre **est** la décision : un champ que quelqu'un a saisi l'emporte
 * toujours sur une déduction, et la déduction ne sert qu'à combler un vide. Une
 * fiche dont le site est renseigné ne verra jamais son adresse électronique
 * consultée, même si les deux se contredisent — corriger un champ saisi à
 * partir d'une déduction serait décider à la place de l'utilisateur (jalon 8).
 */
export function resolveResearchTarget(input: TargetInput): ResearchTarget | null {
  const fromSite = normalizeSite(input.website);
  if (fromSite !== null) return { ...fromSite, source: "contact-site" };

  const fromCompany = normalizeSite(input.companyDomain);
  if (fromCompany !== null) return { ...fromCompany, source: "company-domain" };

  for (const email of input.emails) {
    const domain = emailDomain(email);
    // **L'exclusion vient en premier** : un domaine de messagerie grand public
    // passe parfaitement `normalizeSite`, et lire `gmail.com` produirait des
    // « faits » sur Google attribués au prospect.
    if (domain === null || isFreeProvider(domain)) continue;
    const site = normalizeSite(domain);
    if (site !== null) return { ...site, source: "email" };
  }

  return null;
}

/** « dermoplant.com (déduit de l'adresse email) », pour la carte. */
export function describeTarget(target: ResearchTarget): string {
  return `${target.host} (${TARGET_LABELS[target.source]})`;
}

/**
 * La cible telle qu'elle a été enregistrée, relue depuis deux colonnes texte.
 *
 * Une recherche antérieure au jalon 75 n'en porte aucune : on rend `null`
 * plutôt qu'une source inventée, et la carte se tait sur la provenance au lieu
 * d'affirmer « fiche » par défaut. La lecture vit ici, en un seul exemplaire,
 * parce que deux surfaces la font — la file des départs et la rédaction — et
 * que la seconde est toujours celle qu'on oublie de corriger.
 */
export function storedTarget(host: string, source: string): ResearchTarget | null {
  if (host === "") return null;
  if (source !== "contact-site" && source !== "company-domain" && source !== "email") return null;
  return { url: `https://${host}/`, host, source };
}
