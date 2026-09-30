import { ourSiteLabel } from "./our-site";

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
 * | `{notresite}` | idem — sans adresse réglée, la phrase qui la cite disparaît |
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
    label: "Son site (celui du prospect)",
    fallback:
      "LE SITE DU PROSPECT, pas le nôtre : site de la fiche, à défaut celui de la société, à défaut le domaine de l'adresse email ; sans rien, la phrase qui le cite est retirée",
  },
  {
    /*
      **`{notresite}` est notre site, `{site}` est le sien.** Les deux balises se
      ressemblent à l'écrit et désignent des choses opposées : se tromper fait
      inviter le prospect à visiter sa propre boutique. Le libellé et l'infobulle
      de la puce les opposent donc explicitement, plutôt que de décrire chacune
      dans son coin.
    */
    tag: "{notresite}",
    label: "Notre site (pas le sien)",
    fallback:
      "notre adresse, réglée dans /reglages → Messagerie : lien cliquable en HTML, adresse entière en texte. Sans adresse réglée, la phrase qui la cite est retirée",
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
  /**
   * **L'adresse de notre site, entière** — pas son libellé.
   *
   * C'est l'écart avec `{video}`, et il est voulu : l'adresse substituée telle
   * quelle rend la partie `text/plain` juste sans aucun développement, et c'est
   * la couche d'envoi qui en fait une ancre côté HTML (`withOurSiteLink`). Une
   * règle de rendu en moins, donc une divergence de moins entre les deux
   * parties. Vide = aucune adresse réglée, donc la phrase disparaît.
   */
  readonly notresite: string;
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
  if (template.includes("{notresite}") && values.notresite.trim() === "") {
    missing.push("{notresite}");
  }
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
 * **Les balises dont l'absence retire une phrase entière**, et le mot qui le dit.
 *
 * Le libellé est au singulier et sans article : il s'insère tel quel dans
 * « Phrase retirée pour ce contact : société absente » comme dans « 7
 * destinataires sans société ».
 */
const SENTENCE_TAGS: readonly { tag: string; label: string; missing: string }[] = [
  { tag: "{societe}", label: "société absente", missing: "société" },
  { tag: "{fonction}", label: "fonction absente", missing: "fonction" },
  { tag: "{site}", label: "site absent", missing: "site" },
  { tag: "{video}", label: "vidéo non réglée", missing: "vidéo" },
  { tag: "{notresite}", label: "adresse de notre site non réglée", missing: "notre site" },
];

/** Les valeurs du contact que le texte utilise et qui lui manquent. */
export function missingSentenceValues(
  template: string,
  values: MergeValues,
): readonly string[] {
  const text = canonicalTags(template);
  return SENTENCE_TAGS.filter(
    (entry) => text.includes(entry.tag) && valueFor(entry.tag, values).trim() === "",
  ).map((entry) => entry.missing);
}

export interface DroppedSentence {
  /** La balise responsable, canonique : `{marque}` est ramené à `{societe}`. */
  readonly tag: string;
  /** « société absente » — la raison, prête à être affichée. */
  readonly label: string;
  /** La phrase retirée, telle qu'elle est écrite dans le gabarit. */
  readonly sentence: string;
}

/**
 * **Les phrases que le rendu va retirer pour ce contact, et pourquoi.**
 *
 * Le retrait date du jalon 87 et il est juste : une phrase construite autour
 * d'un nom qu'on n'a pas ne survit pas à son retrait. Ce qui manquait, c'est
 * qu'il soit **visible** — un message dont la première phrase disparaît s'ouvre
 * sur « Mais il y a une partie… », et l'incohérence ne se découvre qu'à la
 * réception. Cette fonction ne change pas la règle, elle la rend lisible : même
 * découpage que `dropSentencesWith`, donc ce qu'elle annonce est exactement ce
 * qui partira.
 */
export function droppedSentences(
  template: string,
  values: MergeValues,
): readonly DroppedSentence[] {
  const text = canonicalTags(template);
  const dropped: DroppedSentence[] = [];

  for (const entry of SENTENCE_TAGS) {
    if (valueFor(entry.tag, values).trim() !== "") continue;
    for (const paragraph of text.split(/\n{2,}/)) {
      for (const line of paragraph.split("\n")) {
        for (const sentence of line.split(/(?<=[.!?…])\s+/)) {
          if (!sentence.includes(entry.tag)) continue;
          const trimmed = sentence.trim();
          if (trimmed !== "") {
            dropped.push({ tag: entry.tag, label: entry.label, sentence: trimmed });
          }
        }
      }
    }
  }

  return dropped;
}

function valueFor(tag: string, values: MergeValues): string {
  if (tag === "{societe}") return values.societe;
  if (tag === "{fonction}") return values.fonction;
  if (tag === "{site}") return values.site;
  if (tag === "{notresite}") return values.notresite;
  return values.video;
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
  // Sans adresse réglée, la phrase qui cite notre site part elle aussi : un lien
  // mort vaut moins que la phrase qu'il portait (jalon 89).
  if (values.notresite.trim() === "") text = dropSentencesWith(text, "{notresite}");

  text = text
    .replaceAll("{prenom}", values.prenom.trim())
    .replaceAll("{nom}", values.nom.trim())
    .replaceAll("{fonction}", values.fonction.trim())
    .replaceAll("{societe}", values.societe.trim())
    .replaceAll("{site}", values.site.trim())
    .replaceAll("{video}", values.video.trim())
    .replaceAll("{notresite}", values.notresite.trim());

  return tidy(text);
}

/**
 * ## L'objet, et pourquoi il ne se rend pas comme un corps
 *
 * Un corps est fait de phrases : une balise sans valeur y fait **retirer la
 * phrase** qui la porte, parce qu'une phrase construite autour d'un nom qu'on
 * n'a pas ne survit pas à son retrait (jalon 87).
 *
 * **Un objet est une ligne.** Y retirer « la phrase » le viderait entièrement,
 * et un message sans objet n'arrive pas. Retirer la seule balise ne vaut pas
 * mieux : « Une démonstration préparée pour » se lit comme une fusion ratée,
 * et « , une question sur » commence par une virgule orpheline.
 *
 * D'où des **replis neutres**, et c'est le seul endroit du produit où l'on
 * remplace une valeur manquante par un mot choisi à l'avance :
 *
 * | Balise | Sans valeur, dans un objet |
 * |---|---|
 * | `{societe}` / `{marque}` | « votre marque » |
 * | `{site}` | « votre site » |
 * | `{prenom}`, `{nom}`, `{fonction}` | retirées, et la ponctuation recollée |
 * | `{notresite}` | retirée — sans adresse réglée il n'y a rien à nommer |
 * | `{video}` | **refusée à l'écriture** : un lien ne se clique pas dans un objet |
 *
 * Ce n'est pas la contradiction du « aucun repli inventé » des jalons 25 et 48.
 * Ceux-là interdisent d'**affirmer un fait** qu'on ne connaît pas — un domaine,
 * un DM, un angle de métier. « votre marque » n'affirme rien : c'est la
 * deuxième personne, exactement ce qu'on écrirait à la main en ne connaissant
 * pas le nom de la maison. Le corps garde donc sa règle, et l'objet la sienne.
 */

/** Ce qu'un objet met à la place d'une valeur manquante, et rien d'autre. */
const SUBJECT_FALLBACKS: readonly { readonly tag: string; readonly text: string }[] = [
  { tag: "{societe}", text: "votre marque" },
  { tag: "{site}", text: "votre site" },
];

/** La balise qu'un objet ne peut pas porter, et la raison, dite une seule fois. */
export const SUBJECT_FORBIDDEN: readonly { readonly tag: string; readonly reason: string }[] = [
  {
    tag: "{video}",
    reason:
      "un objet ne porte pas de lien cliquable : la vidéo s'annonce dans le message, pas dans l'objet",
  },
];

/**
 * Les balises que cet objet ne peut pas porter, avec leur raison.
 *
 * Rendu par le domaine et non composé par l'écran : l'éditeur et la route
 * d'enregistrement disent ainsi exactement la même phrase.
 */
export function subjectTagErrors(
  template: string,
): readonly { readonly tag: string; readonly reason: string }[] {
  const text = canonicalTags(template);
  return SUBJECT_FORBIDDEN.filter((entry) => text.includes(entry.tag));
}

/**
 * Les replis que **ce** contact déclenchera dans cet objet, dits en clair.
 *
 * C'est la moitié utile de la fonction : un repli silencieux ferait partir
 * « votre marque » à quelqu'un dont on connaît pourtant la société, sans que
 * personne s'aperçoive que la fiche est incomplète.
 */
export function subjectFallbacks(
  template: string,
  values: MergeValues,
): readonly string[] {
  const text = canonicalTags(template);
  return SUBJECT_FALLBACKS.filter(
    (entry) => text.includes(entry.tag) && valueFor(entry.tag, values).trim() === "",
  ).map((entry) =>
    entry.tag === "{societe}"
      ? `société absente, remplacée par « ${entry.text} »`
      : `site absent, remplacé par « ${entry.text} »`,
  );
}

/**
 * Recolle la ponctuation d'un objet dont une balise a disparu.
 *
 * Trois cas, dans cet ordre : la ponctuation **en tête** (« , une question »),
 * celle restée **collée à une autre** (« Bonjour , Dermoplant »), et les
 * espaces doubles. `tidy` ne sait pas faire les deux premiers : dans un corps,
 * une virgule en tête de ligne vient d'une phrase qu'on a le droit de retirer
 * entièrement, ici elle vient d'un mot manquant au milieu d'une ligne qu'il
 * faut sauver.
 */
function tidySubject(line: string): string {
  const head = line.replace(/^[\s,;:.!?…-]+/, "");
  const cleaned = head
    .replace(/([,;:])\s*(?=[,;:])/g, "")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  /*
    **La majuscule n'est remise que si l'on a coupé la tête.** « {prenom}, une
    question sur {site} » sans prénom commencerait par une minuscule, ce qui se
    lit comme une phrase tronquée. Quand rien n'a été retiré, on ne touche pas à
    la casse : l'auteur a écrit son objet comme il l'entend, et le corriger
    serait décider à sa place.
  */
  if (head === line.trimStart() || cleaned === "") return cleaned;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * L'objet, rendu pour un contact.
 *
 * **Le seul chemin par lequel un objet devient du texte**, et une garde
 * statique le vérifie : un second rendu ferait partir un `Subject:` que
 * l'aperçu n'a jamais montré.
 *
 * `{notresite}` y rend le **libellé** (« auraflowai.fr »), pas l'adresse : une
 * URL entière dans un objet ne se clique pas et occupe la place du sujet.
 */
export function renderSubject(template: string, values: MergeValues): string {
  let text = canonicalTags(template);

  for (const entry of SUBJECT_FALLBACKS) {
    if (valueFor(entry.tag, values).trim() === "") {
      text = text.replaceAll(entry.tag, entry.text);
    }
  }

  const site = values.notresite.trim();
  text = text
    .replaceAll("{prenom}", values.prenom.trim())
    .replaceAll("{nom}", values.nom.trim())
    .replaceAll("{fonction}", values.fonction.trim())
    .replaceAll("{societe}", values.societe.trim())
    .replaceAll("{site}", values.site.trim())
    .replaceAll("{video}", values.video.trim())
    .replaceAll("{notresite}", site === "" ? "" : ourSiteLabel(site));

  return tidySubject(text.split("\n").join(" "));
}

/**
 * L'objet d'une étape : celui de l'étape 1, pour toutes les étapes.
 *
 * **Une relance qui change d'objet ouvre un nouveau fil.** Les messageries
 * regroupent par objet et par participants : le prospect verrait alors deux
 * conversations parallèles, et perdrait le message auquel la relance répond.
 * C'était déjà la règle du discours d'Alex (jalon 84) ; les étapes écrites à la
 * main portaient chacune son champ, et rien ne les empêchait de diverger.
 *
 * Pas de « Re: » non plus : un « Re: » sur un message qui n'est pas une réponse
 * est un faux signal de conversation, et les clients rattachent très bien sans.
 */
export function subjectForStep(
  steps: readonly { readonly position: number; readonly subject: string }[],
  position: number,
): string {
  const first = [...steps].sort((a, b) => a.position - b.position)[0];
  const own = steps.find((entry) => entry.position === position);
  // Une seule étape, ou l'étape 1 elle-même : son propre objet.
  if (first === undefined || first.position === position) return own?.subject ?? "";
  return first.subject;
}
