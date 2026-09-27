import { CONTACT_GROUPS, GROUP_LABELS, isContactGroup, type ContactGroup } from "./contact-group";

/**
 * **Une variante d'étape par groupe de fonction, et un défaut qui rattrape le
 * reste.**
 *
 * Le fondateur, la responsable e-commerce et le commercial d'une même maison
 * reçoivent trois messages différents — mais un groupe pour lequel personne n'a
 * écrit de variante **reçoit le message par défaut de l'étape**, jamais rien et
 * jamais un texte approchant. C'est ce qui fait qu'une campagne d'avant ce jalon
 * se comporte exactement comme avant : aucune variante, donc le défaut partout.
 *
 * Le module est **pur** : il sert la composition côté serveur *et* l'aperçu en
 * direct côté navigateur. Une seconde règle de choix montrerait un aperçu que
 * l'envoi ne produit pas — ce qui est pire que pas d'aperçu.
 */

export interface StepTemplate {
  readonly subject: string;
  readonly body: string;
}

export interface StepVariant extends StepTemplate {
  readonly group: ContactGroup;
}

/** Une variante compte pour rien tant qu'elle ne porte ni objet ni message. */
export function isWrittenVariant(variant: StepTemplate): boolean {
  return variant.subject.trim() !== "" || variant.body.trim() !== "";
}

export interface ChosenTemplate extends StepTemplate {
  /** Le groupe dont la variante a servi, ou `null` quand c'est le défaut. */
  readonly variantOf: ContactGroup | null;
  /**
   * **L'objet vient-il du défaut de l'étape alors que le corps vient d'une
   * variante ?**
   *
   * Une variante peut porter un message sans objet — c'est même le cas le plus
   * fréquent, puisque l'objet est souvent le même pour les quatre groupes. Elle
   * retombe alors **explicitement** sur l'objet de l'étape, et l'aperçu le dit :
   * un en-tête `Subject:` vide part sans avertissement et se lit comme un
   * message cassé, ou ne se lit pas du tout.
   */
  readonly subjectFromStep: boolean;
}

/**
 * Le texte qui partira à ce contact, et **de quelle variante il vient**.
 *
 * `variantOf` n'est pas décoratif : c'est ce que l'aperçu affiche pour qu'on
 * sache lequel des cinq textes on est en train de lire. Sans lui, un aperçu qui
 * montre le défaut et un aperçu qui montre une variante se ressemblent, et l'on
 * croit avoir écrit une variante qu'on n'a pas enregistrée.
 *
 * Un groupe jamais classé (`groupSetBy = "none"`) reçoit le défaut : il n'est
 * pas « Autre », c'est une fonction que personne n'a encore lue, et lui servir
 * la variante d'un groupe serait choisir à sa place.
 */
export function templateFor(
  step: StepTemplate,
  variants: readonly StepVariant[],
  group: string | null,
): ChosenTemplate {
  if (group !== null && isContactGroup(group)) {
    const match = variants.find((variant) => variant.group === group);
    if (match !== undefined && isWrittenVariant(match)) {
      const blank = match.subject.trim() === "";
      return {
        subject: blank ? step.subject : match.subject,
        body: match.body.trim() === "" ? step.body : match.body,
        variantOf: match.group,
        subjectFromStep: blank,
      };
    }
  }
  return { subject: step.subject, body: step.body, variantOf: null, subjectFromStep: false };
}

/**
 * **L'objet qui partira réellement, ou la raison de refuser l'enregistrement.**
 *
 * `null` veut dire « aucun objet nulle part » : ni la variante, ni le défaut de
 * l'étape n'en portent. C'est le seul cas où l'enregistrement est refusé, parce
 * que c'est le seul qui produirait un `Subject:` vide — et un message sans objet
 * n'est pas un message maladroit, c'est un message que les filtres écartent et
 * que le destinataire ne voit pas.
 */
export function effectiveSubject(
  step: StepTemplate,
  variant: StepTemplate | undefined,
): string | null {
  const own = variant?.subject.trim() ?? "";
  if (own !== "") return own;
  const fallback = step.subject.trim();
  return fallback === "" ? null : fallback;
}

/** Ce que l'aperçu écrit au-dessus de l'objet, pour qu'on sache d'où il vient. */
export function describeSubjectSource(chosen: ChosenTemplate): string {
  if (chosen.variantOf === null) return "objet du message par défaut";
  return chosen.subjectFromStep
    ? `objet du message par défaut (la variante « ${GROUP_LABELS[chosen.variantOf]} » n'en porte pas)`
    : `objet de la variante « ${GROUP_LABELS[chosen.variantOf]} »`;
}

/* ------------------------- le routage d'« Autre » et des fiches non classées */

/**
 * **Quelle variante reçoivent les contacts « Autre » et « Non classé ».**
 *
 * C'est du **routage, jamais un classement** : le groupe de la fiche n'est pas
 * touché, et une garde statique l'impose. Un contact dont on n'a pas su lire la
 * fonction reste un contact dont on n'a pas su lire la fonction — mais il doit
 * bien recevoir *un* texte, et « le message par défaut de l'étape » n'est pas
 * toujours celui qu'on veut lui envoyer.
 *
 * `default` reproduit exactement le comportement d'avant ce réglage, et c'est ce
 * que portent les campagnes existantes : elles ne changent pas d'un octet.
 */
export const OTHER_ROUTINGS = ["default", "direction", "marketing", "commercial"] as const;
export type OtherRouting = (typeof OTHER_ROUTINGS)[number];

export function isOtherRouting(value: string): value is OtherRouting {
  return (OTHER_ROUTINGS as readonly string[]).includes(value);
}

export function toOtherRouting(raw: string): OtherRouting {
  return isOtherRouting(raw) ? raw : "default";
}

export const ROUTING_LABELS: Record<OtherRouting, string> = {
  default: "Message par défaut",
  direction: GROUP_LABELS.direction,
  marketing: GROUP_LABELS.marketing,
  commercial: GROUP_LABELS.commercial,
};

/**
 * Le groupe **dont la variante servira** à ce contact — `null` pour le défaut.
 *
 * Une fiche jamais classée (`none`) et une fiche « Autre » sont routées
 * ensemble : dans les deux cas, personne n'a d'angle à leur servir, et c'est le
 * réglage de la campagne qui tranche. Tout autre groupe passe droit.
 */
export function routedGroup(
  group: string,
  source: string,
  routing: OtherRouting,
): ContactGroup | null {
  /*
    **`default` reproduit le comportement d'avant ce réglage à l'octet près**, et
    les deux branches diffèrent — c'est ce qui l'oblige à les distinguer :

    - une fiche jamais classée recevait le **défaut de l'étape**, jamais la
      variante « Autre » : elle n'est pas « Autre », c'est une fonction que
      personne n'a lue (jalon 94) ;
    - une fiche « Autre » recevait la **variante « Autre »** quand elle existait,
      et le défaut sinon — le repli ordinaire de `templateFor`.

    Les fondre en un seul `null` aurait privé de sa variante toute campagne
    existante qui en a écrit une pour « Autre ». Le routage ne change que ce
    qu'on lui demande de changer.
  */
  if (source === "none") return routing === "default" ? null : routing;
  if (group !== "autre") return isContactGroup(group) ? group : null;
  return routing === "default" ? "autre" : routing;
}

/** « Autre 6 → reçoivent Direction » — vide quand personne n'est concerné. */
export function describeRouting(
  counts: { readonly autre: number; readonly unclassified: number },
  routing: OtherRouting,
): string {
  const total = counts.autre + counts.unclassified;
  if (total === 0) return "";
  const parts: string[] = [];
  if (counts.autre > 0) parts.push(`Autre ${counts.autre}`);
  if (counts.unclassified > 0) parts.push(`Non classé ${counts.unclassified}`);
  const who = parts.join(" · ");
  return routing === "default"
    ? `${who} → reçoivent le message par défaut de l'étape`
    : `${who} → reçoivent ${ROUTING_LABELS[routing]}`;
}

/**
 * La variante qu'un éditeur est en train de **modifier**, vide si elle n'existe
 * pas encore.
 *
 * Distincte de `templateFor`, et la distinction est le sujet : celle-ci répond
 * « quel texte je tape », celle-là « quel texte partira ». Les confondre ferait
 * ouvrir l'éditeur sur le message par défaut dès qu'un groupe n'a pas encore de
 * variante, donc écrire dans le défaut en croyant écrire une variante.
 */
export function editedVariant(
  variants: readonly StepVariant[],
  group: ContactGroup,
): StepTemplate {
  const match = variants.find((variant) => variant.group === group);
  return match === undefined ? { subject: "", body: "" } : { subject: match.subject, body: match.body };
}

/** Le libellé de ce qu'un aperçu est en train de montrer. */
export function describeChoice(chosen: ChosenTemplate): string {
  return chosen.variantOf === null
    ? "message par défaut de l'étape"
    : `variante « ${GROUP_LABELS[chosen.variantOf]} »`;
}

/* -------------------------------------- le filtre de groupes d'une campagne */

/**
 * Les groupes visés par une campagne, lus depuis `Campaign.groupFilter`.
 *
 * **Vide veut dire « tous »**, et c'est ce qui laisse les campagnes existantes
 * inchangées : elles portent une chaîne vide, donc aucune restriction. Une
 * valeur inconnue est ignorée plutôt que de vider le filtre — un filtre devenu
 * vide par accident élargirait le public en silence, ce qui est exactement
 * l'erreur qu'on ne peut pas rattraper une fois les messages partis.
 */
export function parseGroupFilter(raw: string): readonly ContactGroup[] {
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const kept = parts.filter(isContactGroup);
  return [...new Set(kept)];
}

export function serializeGroupFilter(groups: readonly string[]): string {
  const kept = CONTACT_GROUPS.filter((group) => groups.includes(group));
  // Les quatre groupes cochés ne contraignent rien : autant l'écrire comme
  // « tous », pour qu'un écran n'ait pas deux façons de dire la même chose.
  return kept.length === CONTACT_GROUPS.length ? "" : kept.join(",");
}

/** Le filtre retient-il ce contact ? Vide = tous, jamais personne. */
export function filterKeeps(raw: string, group: string, source: string): boolean {
  const groups = parseGroupFilter(raw);
  if (groups.length === 0) return true;
  /*
    **Une fiche jamais classée n'est retenue par aucun groupe**, et c'est
    volontaire : la retenir sous « Autre » l'enverrait sous un angle décidé par
    notre retard de classement plutôt que par sa fonction. L'écran dit combien
    de fiches sont dans ce cas, avec le bouton pour les classer.
  */
  if (source === "none") return false;
  return isContactGroup(group) && groups.includes(group);
}

export function describeGroupFilter(raw: string): string {
  const groups = parseGroupFilter(raw);
  if (groups.length === 0) return "Tous les groupes";
  return groups.map((group) => GROUP_LABELS[group]).join(" · ");
}

/**
 * La ligne de compteurs affichée avant d'envoyer — « Direction 14 · Marketing 9
 * · Commercial 3 · Autre 6 ».
 *
 * Les groupes à zéro sont omis : une ligne qui énumère des zéros fait chercher
 * l'information au lieu de la donner. « Non classé » est compté **à part et
 * nommé** : le confondre avec « Autre » ferait d'un chiffre le reflet de notre
 * retard plutôt que du portefeuille.
 */
export function describeCounts(counts: {
  readonly byGroup: Readonly<Record<ContactGroup, number>>;
  readonly unclassified: number;
}): string {
  const parts = CONTACT_GROUPS.filter((group) => counts.byGroup[group] > 0).map(
    (group) => `${GROUP_LABELS[group]} ${counts.byGroup[group]}`,
  );
  if (counts.unclassified > 0) parts.push(`Non classé ${counts.unclassified}`);
  return parts.length === 0 ? "Aucun destinataire" : parts.join(" · ");
}

/** L'avertissement de ruling 3, ou une chaîne vide quand tout est classé. */
export function unclassifiedWarning(unclassified: number): string {
  if (unclassified === 0) return "";
  return `${unclassified} contacts jamais classés : recalculez les groupes`;
}
