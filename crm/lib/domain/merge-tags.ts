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
 * | `{nom}` | retirée — comme le prénom, elle ne casse pas la phrase qui la porte |
 * | `{societe}` (et son alias `{marque}`) | **la phrase qui la porte est retirée** |
 * | `{fonction}` | idem |
 * | `{site}` | idem |
 * | `{video}` | idem — sans vidéo configurée, la phrase qui l'annonce disparaît |
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
    tag: "{nom}",
    label: "Nom",
    fallback: "sans nom de famille connu, la balise est simplement retirée",
  },
  {
    tag: "{societe}",
    label: "Société",
    fallback: "sans société, la phrase qui la nomme est retirée",
  },
  {
    /*
      **`{marque}` est un alias de `{societe}`, pas une seconde valeur.** Une
      maison de e-commerce se nomme par sa marque, et c'est bien la société du
      CRM (c'est aussi l'en-tête du fichier d'import). Deux valeurs distinctes
      finiraient par se contredire ; ici les deux balises rendent la même
      chaîne, et `canonicalTags` le ramène à une seule avant toute substitution.
    */
    tag: "{marque}",
    label: "Marque (alias de Société)",
    fallback: "identique à {societe} : sans elle, la phrase qui la nomme est retirée",
  },
  {
    tag: "{fonction}",
    label: "Fonction",
    fallback: "sans fonction renseignée, la phrase qui la cite est retirée",
  },
  {
    tag: "{site}",
    label: "Site",
    fallback:
      "site de la fiche, à défaut celui de la société, à défaut le domaine de l'adresse email ; sans rien, la phrase qui le cite est retirée",
  },
  {
    tag: "{video}",
    label: "Vidéo",
    fallback:
      "libellé cliquable de la vidéo réglée dans /reglages → Messagerie ; sans vidéo configurée, la phrase qui l'annonce est retirée",
  },
];

export interface MergeValues {
  readonly prenom: string;
  /** Le nom de famille. Vide sur une fiche de marque sans personne (jalon 50). */
  readonly nom: string;
  /** Le nom de la société — ce que rendent **`{societe}` et `{marque}`**. */
  readonly societe: string;
  /** L'intitulé de poste, tel qu'il est saisi. Vide = non renseigné. */
  readonly fonction: string;
  /** L'hôte seul : `dermoplant.com`. Résolu comme la cible de recherche. */
  readonly site: string;
  /**
   * **Le libellé de la vidéo, pas son adresse.**
   *
   * `{video}` se substitue comme `DemoLink` depuis le jalon 34 : le gabarit
   * reçoit un texte, et la couche d'envoi en fait une vignette cliquable côté
   * HTML et « Libellé : https://… » côté texte. Écrire l'adresse ici la
   * rendrait nue dans les deux parties, et la vignette n'aurait plus de mot
   * sur lequel s'accrocher. Vide = aucune vidéo réglée.
   */
  readonly video: string;
}

/** Les balises **du gabarit** qui n'auront pas de valeur pour ce contact. */
export function unresolvedTags(template: string, values: MergeValues): readonly string[] {
  const missing: string[] = [];
  if (template.includes("{prenom}") && values.prenom.trim() === "") missing.push("{prenom}");
  if (template.includes("{nom}") && values.nom.trim() === "") missing.push("{nom}");
  if (template.includes("{fonction}") && values.fonction.trim() === "") missing.push("{fonction}");
  if (template.includes("{societe}") && values.societe.trim() === "") missing.push("{societe}");
  if (template.includes("{marque}") && values.societe.trim() === "") missing.push("{marque}");
  if (template.includes("{site}") && values.site.trim() === "") missing.push("{site}");
  if (template.includes("{video}") && values.video.trim() === "") missing.push("{video}");
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
  const unknown: string[] = [];

  /*
    **La double accolade est signalée, jamais tolérée.** `{{prenom}}` est la
    syntaxe d'autres outils, et elle vient sous les doigts. La recherche de
    balises simples y trouvait `{prenom}` — une balise connue — et laissait
    donc partir « {Bonjour Marie} » chez le destinataire : les accolades
    restantes se lisent comme une fusion ratée. **Le produit n'a qu'une
    syntaxe**, et l'écart est nommé avant l'enregistrement.
  */
  for (const match of template.match(/\{\{[^{}\n]{0,40}\}\}/g) ?? []) {
    unknown.push(match);
  }

  const singles = template.replace(/\{\{[^{}\n]{0,40}\}\}/g, " ");
  for (const tag of singles.match(/\{[^{}\n]{1,40}\}/g) ?? []) {
    if (!known.has(tag)) unknown.push(tag);
  }

  return [...new Set(unknown)];
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
/**
 * Ramène les alias à une seule balise, avant tout le reste.
 *
 * `{marque}` devient `{societe}` : le retrait de phrase, la substitution et le
 * nettoyage n'ont ainsi qu'un seul cas à traiter, et un alias ajouté demain ne
 * demande pas de doubler trois branches.
 */
function canonicalTags(template: string): string {
  return template.replaceAll("{marque}", "{societe}");
}

export function renderTemplate(input: string, values: MergeValues): string {
  let text = canonicalTags(input);

  if (values.fonction.trim() === "") text = dropSentencesWith(text, "{fonction}");
  if (values.societe.trim() === "") text = dropSentencesWith(text, "{societe}");
  if (values.site.trim() === "") text = dropSentencesWith(text, "{site}");
  // Sans vidéo réglée, la phrase qui l'annonce part entièrement : « Voici une
  // courte vidéo :  » laisserait un deux-points suspendu, et un lien mort
  // coûterait plus que la phrase qu'il portait.
  if (values.video.trim() === "") text = dropSentencesWith(text, "{video}");

  text = text
    .replaceAll("{prenom}", values.prenom.trim())
    .replaceAll("{nom}", values.nom.trim())
    .replaceAll("{fonction}", values.fonction.trim())
    .replaceAll("{societe}", values.societe.trim())
    .replaceAll("{site}", values.site.trim())
    .replaceAll("{video}", values.video.trim());

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
    canonicalTags(template)
      .replaceAll("{prenom}", values.prenom.trim())
      .replaceAll("{nom}", values.nom.trim())
      .replaceAll("{fonction}", values.fonction.trim())
      .replaceAll("{societe}", values.societe.trim())
      .replaceAll("{site}", values.site.trim())
      .replaceAll("{video}", values.video.trim()),
  )
    .split("\n")
    .join(" ")
    .trim();
}
