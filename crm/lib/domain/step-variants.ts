import { CONTACT_GROUPS, GROUP_LABELS, isContactGroup, type ContactGroup } from "./contact-group";
import type { MergeValues } from "./merge-tags";

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

/* ----------------------------------------- l'objet d'une étape, et son mode ----- */

export const SUBJECT_MODES = ["thread", "custom"] as const;
export type SubjectMode = (typeof SUBJECT_MODES)[number];

/** Un mode inconnu vaut « garder le fil » : jamais une conversation de plus. */
export function toSubjectMode(value: string): SubjectMode {
  return value === "custom" ? "custom" : "thread";
}

export const SUBJECT_MODE_LABELS: Record<SubjectMode, string> = {
  thread: "Garder l'objet de l'étape 1 (même conversation)",
  custom: "Objet personnalisé (nouvelle conversation)",
};

/**
 * La conséquence, dite en une ligne au-dessus du champ.
 *
 * Elle décrit **ce que le destinataire verra**, pas le réglage : « ouvre une
 * nouvelle conversation » est une propriété de sa messagerie, et c'est la seule
 * chose qui compte au moment de choisir.
 */
export const CUSTOM_SUBJECT_WARNING =
  "Avec un objet différent, ce message arrive dans une nouvelle conversation, " +
  "sans votre premier mail au-dessus.";

/** Une étape telle que le décideur la lit : son objet, son mode, ses variantes. */
export interface StepSubjectSource {
  readonly position: number;
  readonly subject: string;
  readonly subjectMode?: string;
  readonly variants?: readonly {
    readonly group: string;
    readonly subject: string;
    readonly body: string;
  }[];
}

export interface SubjectPlan {
  /** Le gabarit retenu, celui qu'on rend. */
  readonly template: string;
  /**
   * Le gabarit du **fil** — le repli quand le précédent rend une chaîne vide.
   * Égal à `template` en mode `thread` : il n'y a alors rien à rattraper.
   */
  readonly fallback: string;
  readonly mode: SubjectMode;
  /** L'objet vient-il d'une variante, ou du défaut de son étape ? */
  readonly fromVariant: boolean;
}

/** Les variantes d'une étape, filtrées sur les groupes connus. */
function variantsOf(step: StepSubjectSource | undefined): StepVariant[] {
  return (step?.variants ?? [])
    .filter((variant) => isContactGroup(variant.group))
    .map((variant) => ({
      group: variant.group as ContactGroup,
      subject: variant.subject,
      body: variant.body,
    }));
}

/** L'objet d'une étape pour un groupe : sa variante si elle en porte un. */
function ownSubject(step: StepSubjectSource | undefined, group: ContactGroup | null): {
  readonly subject: string;
  readonly fromVariant: boolean;
} {
  if (group !== null) {
    const variant = variantsOf(step).find((entry) => entry.group === group);
    if (variant !== undefined && variant.subject.trim() !== "") {
      return { subject: variant.subject, fromVariant: true };
    }
  }
  return { subject: step?.subject ?? "", fromVariant: false };
}

/**
 * **L'objet d'une étape quelconque pour un groupe quelconque — la seule fonction
 * qui le décide.**
 *
 * Trois règles, et elles se lisent dans cet ordre :
 *
 * 1. **l'étape 1 porte son propre objet**, variante du groupe d'abord, défaut de
 *    l'étape ensuite. C'est lui que les relances hériteront ;
 * 2. une relance en mode **`thread`** (le défaut) reprend **l'objet de l'étape 1
 *    pour son groupe** — et **ignore tout objet stocké sur elle** : la règle du
 *    jalon 101, parce qu'une relance qui change d'objet ouvre une seconde
 *    conversation chez le destinataire et que le message auquel elle répond s'y
 *    perd ;
 * 3. une relance en mode **`custom`** porte **son** objet : sa variante de groupe
 *    si elle en a une, à défaut l'objet par défaut de cette étape. C'est un choix
 *    explicite, et l'écran en dit la conséquence.
 *
 * `fallback` porte toujours l'objet du fil. Il sert au cas que seul le rendu
 * révèle : un objet personnalisé réduit à `{prenom}` est non vide comme gabarit
 * et **vide une fois rendu** pour une fiche sans prénom. On ne part jamais sans
 * objet (jalon 96) ; `renderSubjectPlan` applique ce repli, à un seul endroit.
 *
 * `group === null` demande l'objet hors de tout groupe, c'est-à-dire ce que
 * reçoit un contact dont aucune variante ne parle.
 */
export function subjectForGroup(
  steps: readonly StepSubjectSource[],
  position: number,
  group: ContactGroup | null,
): SubjectPlan {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const first = ordered[0];
  const step = steps.find((entry) => entry.position === position);
  const thread = ownSubject(first, group);

  // L'étape 1, ou une séquence qui n'en porte qu'une : son propre objet.
  if (first === undefined || first.position === position) {
    return { template: thread.subject, fallback: thread.subject, mode: "thread", fromVariant: thread.fromVariant };
  }

  const mode = toSubjectMode(step?.subjectMode ?? "thread");
  if (mode === "thread") {
    return { template: thread.subject, fallback: thread.subject, mode, fromVariant: thread.fromVariant };
  }

  const own = ownSubject(step, group);
  // Un objet personnalisé vide comme gabarit n'est pas un choix : on garde le fil.
  if (own.subject.trim() === "") {
    return { template: thread.subject, fallback: thread.subject, mode, fromVariant: false };
  }
  return { template: own.subject, fallback: thread.subject, mode, fromVariant: own.fromVariant };
}

/**
 * **D'où vient l'objet affiché, dit en clair sous l'aperçu.**
 *
 * Quatre provenances, et elles n'engagent pas la même chose : l'objet du fil,
 * l'objet personnalisé de l'étape, celui de sa variante, et — le seul qui soit
 * une réparation — le **repli** appliqué parce que l'objet retenu rendait une
 * chaîne vide. Un repli silencieux serait un texte qu'on relit sans savoir qu'il
 * a été réparé (règle du jalon 101).
 */
export function describeSubjectPlan(
  plan: SubjectPlan,
  group: ContactGroup | null,
  usedFallback: boolean,
): string {
  if (usedFallback) {
    return "objet de l'étape 1 — l'objet personnalisé rendait une chaîne vide pour cette fiche";
  }
  if (plan.mode === "thread") {
    return plan.fromVariant && group !== null
      ? `objet de l'étape 1, variante « ${GROUP_LABELS[group]} »`
      : "objet de l'étape 1";
  }
  return plan.fromVariant && group !== null
    ? `objet personnalisé, variante « ${GROUP_LABELS[group]} »`
    : "objet personnalisé de cette étape";
}

export interface RenderedSubject {
  readonly subject: string;
  /** Le gabarit retenu rendait une chaîne vide : on a repris l'objet du fil. */
  readonly usedFallback: boolean;
}

/**
 * **Le rendu de l'objet, et le seul endroit où le repli de vide s'applique.**
 *
 * Un objet vide n'est pas un objet maladroit : c'est un message que les filtres
 * écartent et que le destinataire ne voit pas (jalon 96). Quand le gabarit
 * retenu ne rend rien — `{prenom}` seul sur une fiche sans prénom —, on reprend
 * l'objet du fil plutôt que de laisser partir un `Subject:` vide. Le dire est la
 * moitié de la règle : l'aperçu le nomme, et ce drapeau est ce qui le lui permet.
 */
export function renderSubjectPlan(
  plan: SubjectPlan,
  values: MergeValues,
  render: (template: string, values: MergeValues) => string,
): RenderedSubject {
  const rendered = render(plan.template, values);
  if (rendered.trim() !== "") return { subject: rendered, usedFallback: false };
  if (plan.fallback.trim() === "" || plan.fallback === plan.template) {
    return { subject: rendered, usedFallback: false };
  }
  return { subject: render(plan.fallback, values), usedFallback: true };
}

/**
 * Les variantes de l'étape de plus petite position, **celles qui portent
 * l'objet du fil**.
 *
 * Lues dans les étapes déjà chargées plutôt que par une seconde requête : les
 * lectures qui composent un gabarit ramènent de toute façon les variantes, et
 * une requête de plus serait une occasion de plus de ramener autre chose que ce
 * que la première a vu.
 */
export function firstVariantsOf(steps: readonly StepSubjectSource[]): StepVariant[] {
  return variantsOf([...steps].sort((a, b) => a.position - b.position)[0]);
}

/**
 * **Le gabarit d'une étape, objet décidé par `subjectForGroup`.**
 *
 * Elle sert deux lectures qui ont besoin du gabarit *avant* de connaître un
 * contact : **l'empreinte de péremption** (jalon 96) et **l'aperçu par groupe**.
 * L'envoi, lui, passe par `renderManualStep`, qui appelle le décideur avec le
 * groupe lu sur la fiche.
 *
 * Deux conséquences portées ici :
 *
 * - **l'empreinte bouge quand l'objet du fil bouge.** Elle lit le plan de chaque
 *   groupe, donc changer l'objet de la variante Direction de l'étape 1 rend bien
 *   périmés les départs d'étape 2 de ce groupe ;
 * - **un groupe qui porte un objet du fil sans variante de relance en reçoit
 *   une**, avec un corps vide : `templateFor` retombe alors sur le corps par
 *   défaut de l'étape — mesuré — et le fil tient pour ce groupe-là. Sans elle, ce
 *   contact recevrait le défaut de l'étape, donc un autre objet que son premier
 *   message, donc une seconde conversation.
 */
export function threadTemplate(
  steps: readonly (StepSubjectSource & { readonly body: string })[],
  position: number,
  variants: readonly StepVariant[],
): { readonly step: StepTemplate; readonly variants: readonly StepVariant[] } {
  const own = steps.find((entry) => entry.position === position);
  const first = [...steps].sort((a, b) => a.position - b.position)[0];
  const isFirst = first === undefined || first.position === position;
  const base = subjectForGroup(steps, position, null);

  if (isFirst) return { step: { subject: base.template, body: own?.body ?? "" }, variants };

  const byGroup = new Map(variants.map((variant) => [variant.group, variant]));
  const groups = new Set<ContactGroup>([
    ...byGroup.keys(),
    // Les groupes dont l'objet diffère du défaut : ils doivent garder le leur,
    // même sans variante de relance à eux.
    ...CONTACT_GROUPS.filter(
      (group) => subjectForGroup(steps, position, group).template !== base.template,
    ),
  ]);

  return {
    step: { subject: base.template, body: own?.body ?? "" },
    variants: [...groups].map((group) => {
      /*
        Laissé **vide** quand l'objet vaut celui du défaut, pour que
        `templateFor` rende `subjectFromStep: true` et que l'aperçu continue de
        dire d'où l'objet vient (jalon 95) — le poser en dur ferait passer un
        repli pour un objet écrit à la main.
      */
      const plan = subjectForGroup(steps, position, group);
      return {
        group,
        subject: plan.template === base.template ? "" : plan.template,
        body: byGroup.get(group)?.body ?? "",
      };
    }),
  };
}

