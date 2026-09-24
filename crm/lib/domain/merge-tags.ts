/**
 * **Une étape écrite à la main, avec des balises remplacées par contact.**
 *
 * Jusqu'ici une étape ne portait qu'une *consigne* : Alex écrivait le message,
 * contact par contact, et c'était un appel au modèle par personne. Une étape
 * `manual` porte le texte lui-même, une fois pour toutes, et la composition se
 * réduit à une substitution — instantanée, gratuite, et identique d'un contact
 * à l'autre à ses trois valeurs près.
 *
 * ### Ce qui décide de ce module : une balise sans valeur
 *
 * Le danger d'un publipostage n'est pas la balise remplacée, c'est **la balise
 * qui ne l'est pas**. Trois façons de rater, dans l'ordre de gravité :
 *
 * 1. `{site}` part littéralement chez le prospect — il lit une accolade et sait
 *    qu'il est le n-ième d'une liste ;
 * 2. la balise disparaît et laisse la phrase mutilée : « ce que cela donnerait
 *    sur . » se lit aussi mal que l'accolade ;
 * 3. l'appel pend : « Bonjour , » — le défaut nommé au jalon 50.
 *
 * D'où trois traitements distincts, et **aucun repli inventé** : on ne fabrique
 * jamais une valeur qu'on n'a pas (jalons 25 et 48).
 *
 * | Balise | Sans valeur |
 * |---|---|
 * | `{prenom}` | retirée, et l'appel réparé par `repairGreeting` — « Bonjour, » |
 * | `{societe}` | **la phrase qui la porte est retirée** |
 * | `{site}` | idem |
 *
 * Retirer la phrase plutôt que la seule balise est le seul choix honnête pour
 * les deux dernières : une phrase construite autour d'un nom qu'on n'a pas ne
 * survit pas à son retrait. Le prénom, lui, est presque toujours dans l'appel,
 * que `repairGreeting` sait rendre correct — et ailleurs, sa disparition ne
 * casse pas la phrase de la même façon.
 *
 * Le module est **pur** : il sert la composition côté serveur *et* l'aperçu en
 * direct côté navigateur. Une seconde implémentation pour l'aperçu montrerait
 * un texte que l'envoi ne produit pas, ce qui est pire que pas d'aperçu.
 */

/** Les modes d'une étape. Toute autre valeur retombe sur `alex`. */
export const STEP_MODES = ["alex", "manual"] as const;
export type StepMode = (typeof STEP_MODES)[number];

export function toStepMode(raw: string): StepMode {
  return raw === "manual" ? "manual" : "alex";
}

export interface MergeTag {
  /** La balise telle qu'on l'écrit : `{prenom}`. */
  readonly tag: string;
  readonly label: string;
  /** Ce qui se passe quand la valeur manque, dit à l'écran avant d'écrire. */
  readonly fallback: string;
}

export const MERGE_TAGS: readonly MergeTag[] = [
  {
    tag: "{prenom}",
    label: "Prénom",
    fallback: "sans prénom connu, l'appel devient « Bonjour, » — aucun nom n'est inventé",
  },
  {
    tag: "{societe}",
    label: "Société",
    fallback: "sans société, la phrase qui la nomme est retirée",
  },
  {
    tag: "{site}",
    label: "Site",
    fallback:
      "site de la fiche, à défaut celui de la société, à défaut le domaine de l'adresse email ; sans rien, la phrase qui le cite est retirée",
  },
];

export interface MergeValues {
  readonly prenom: string;
  readonly societe: string;
  /** L'hôte seul : `dermoplant.com`. Résolu comme la cible de recherche. */
  readonly site: string;
}

/** Les balises **du gabarit** qui n'auront pas de valeur pour ce contact. */
export function unresolvedTags(template: string, values: MergeValues): readonly string[] {
  const missing: string[] = [];
  if (template.includes("{prenom}") && values.prenom.trim() === "") missing.push("{prenom}");
  if (template.includes("{societe}") && values.societe.trim() === "") missing.push("{societe}");
  if (template.includes("{site}") && values.site.trim() === "") missing.push("{site}");
  return missing;
}

/**
 * Les balises écrites dans un gabarit mais inconnues du produit.
 *
 * `{prénom}`, `{firstname}`, `{Societe}` : une faute de frappe partirait telle
 * quelle chez le destinataire, et c'est exactement le mode de défaillance le
 * plus grave. L'éditeur les nomme avant d'enregistrer.
 */
export function unknownTags(template: string): readonly string[] {
  const known = new Set(MERGE_TAGS.map((entry) => entry.tag));
  const found = template.match(/\{[^{}\n]{1,40}\}/g) ?? [];
  return [...new Set(found.filter((tag) => !known.has(tag)))];
}

/**
 * Retire les phrases qui portent une balise sans valeur, paragraphe par
 * paragraphe.
 *
 * Le découpage se fait sur la ponctuation forte **suivie d'une espace** : une
 * abréviation en fin de phrase reste un cas rare, et le pire qu'elle produise
 * est de retirer un mot de trop dans une phrase déjà condamnée. Un paragraphe
 * qui se vide entièrement disparaît — laisser une ligne blanche à sa place
 * ferait un trou visible à la réception.
 */
function dropSentencesWith(text: string, tag: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) =>
          line
            .split(/(?<=[.!?…])\s+/)
            .filter((sentence) => !sentence.includes(tag))
            .join(" ")
            .trim(),
        )
        .filter((line) => line !== "")
        .join("\n"),
    )
    .filter((paragraph) => paragraph !== "")
    .join("\n\n");
}

/**
 * Nettoie ce qu'un retrait laisse derrière lui.
 *
 * Deux espaces, une espace avant une virgule, une ligne devenue vide : rien de
 * tout cela n'est visible en relisant le gabarit, et tout se voit à la
 * réception.
 */
function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]{2,}/g, " ")
        // Seulement la virgule et le point : en français, « ? », « ! », « ; »
        // et « : » prennent une espace **devant**, et la retirer abîmerait une
        // phrase que personne n'a demandé de corriger. La virgule orpheline,
        // elle, vient bien d'une balise sans valeur.
        .replace(/[ \t]+([,.])/g, "$1")
        .replace(/\(\s*\)/g, "")
        .trimEnd(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Le gabarit, rendu pour un contact.
 *
 * L'ordre compte : on retire d'abord les phrases orphelines, **puis** on
 * substitue ce qui reste. L'inverse retirerait une phrase sur une balise déjà
 * remplacée, donc au hasard de ce que contient la valeur.
 */
export function renderTemplate(template: string, values: MergeValues): string {
  let text = template;

  if (values.societe.trim() === "") text = dropSentencesWith(text, "{societe}");
  if (values.site.trim() === "") text = dropSentencesWith(text, "{site}");

  text = text
    .replaceAll("{prenom}", values.prenom.trim())
    .replaceAll("{societe}", values.societe.trim())
    .replaceAll("{site}", values.site.trim());

  return tidy(text);
}

/**
 * L'objet, rendu.
 *
 * Même substitution, **sans découpage en phrases** : un objet est une ligne, et
 * en retirer « la phrase » le viderait entièrement. Une balise sans valeur y
 * est donc simplement retirée, et le nettoyage recolle la ponctuation.
 */
export function renderSubject(template: string, values: MergeValues): string {
  return tidy(
    template
      .replaceAll("{prenom}", values.prenom.trim())
      .replaceAll("{societe}", values.societe.trim())
      .replaceAll("{site}", values.site.trim()),
  )
    .split("\n")
    .join(" ")
    .trim();
}
