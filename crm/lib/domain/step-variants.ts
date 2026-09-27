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
      return { subject: match.subject, body: match.body, variantOf: match.group };
    }
  }
  return { subject: step.subject, body: step.body, variantOf: null };
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
