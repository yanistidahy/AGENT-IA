import "server-only";
import { prisma } from "../db";
import { renderSubject, renderTemplate, type MergeValues } from "../domain/merge-tags";
import { resolveResearchTarget } from "../domain/research-target";
import { contactTitle, repairGreeting } from "../domain/contact-identity";
import { enforceSignature, sanitizeSubject } from "../domain/email-format";
import { signatureBlock } from "../agents/prompts/company";
import { forbiddenSigners } from "../agents/email-draft";
import { ourSiteUrlValue, readMailConfig, signatureOf, signatureVideo } from "./mail";
import { listSignatories, pickSignatory } from "./signatories";
import {
  routedGroup,
  templateFor,
  toOtherRouting,
  type StepVariant,
} from "../domain/step-variants";
import { missingSentenceValues } from "../domain/merge-tags";
import { CONTACT_GROUPS } from "../domain/contact-group";
import { TERMINAL_LIFECYCLES } from "../domain/lost";

/**
 * **Composer une étape écrite à la main : une substitution, rien d'autre.**
 *
 * Aucun appel au modèle, donc aucune facture et aucune attente — c'est la
 * moitié de l'intérêt du mode. Ce qui **ne change pas** est l'autre moitié :
 * l'appel est réparé comme partout (jalon 50), la signature est imposée comme
 * partout (jalons 33 et 67), et le départ produit est un départ ordinaire, donc
 * soumis à tous les garde-fous de l'envoi — cycle de vie terminal, opposition
 * au démarchage, plafonds de débit. Une étape manuelle saute Alex pour
 * **l'écriture**, jamais pour la sécurité.
 *
 * Ce qui n'est **pas** appliqué, et c'est délibéré : le nettoyage des tirets
 * longs (jalon 58). Il existe parce qu'un tiret cadratin trahit un texte
 * *engendré* ; ici l'auteur est un humain qui l'a tapé, et lui réécrire sa
 * ponctuation serait corriger une faute qu'il n'a pas commise.
 */

/** Ce qu'il faut savoir d'un contact pour remplacer ses trois balises. */
const CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  title: true,
  email: true,
  instagram: true,
  website: true,
  owner: true,
  contactGroup: true,
  groupSetBy: true,
  company: { select: { name: true, domain: true } },
} as const;

type MergeContact = Awaited<ReturnType<typeof readMergeContact>>;

async function readMergeContact(contactId: string) {
  return prisma.contact.findUnique({ where: { id: contactId }, select: CONTACT_SELECT });
}

/**
 * Les trois valeurs d'un contact.
 *
 * `{site}` passe par `resolveResearchTarget` — **la même résolution que la
 * recherche** : site de la fiche, à défaut domaine de la société, à défaut
 * domaine de l'adresse électronique, les messageries grand public exclues
 * (jalon 75). Une seconde règle de résolution aurait fini par citer un site que
 * la carte de recherche dit ne pas connaître.
 */
/**
 * Les valeurs qui ne dépendent d'aucun contact : la vidéo et notre site.
 *
 * Réunies en une lecture plutôt qu'un paramètre chacune, pour que l'aperçu et la
 * composition ne puissent pas en oublier une — c'est toujours la seconde qu'on
 * oublie de passer, et elle partirait alors comme une phrase retirée sans raison.
 */
export interface TemplateGlobals {
  /** Le libellé cliquable de la vidéo. Vide = aucune vidéo réglée. */
  readonly video: string;
  /** L'adresse entière de notre site. Vide = aucune adresse réglée. */
  readonly notresite: string;
}

export const NO_GLOBALS: TemplateGlobals = { video: "", notresite: "" };

export function mergeValuesOf(
  contact: NonNullable<MergeContact>,
  globals: TemplateGlobals = NO_GLOBALS,
): MergeValues {
  const target = resolveResearchTarget({
    website: contact.website,
    companyDomain: contact.company?.domain ?? "",
    emails: [contact.email],
  });
  return {
    prenom: contact.firstName,
    nom: contact.lastName,
    fonction: contact.title,
    societe: contact.company?.name ?? "",
    site: target?.host ?? "",
    // **Le libellé, pas l'adresse** : `{video}` se substitue comme le lien de
    // démonstration depuis le jalon 34, et c'est la couche d'envoi qui en fait
    // une vignette cliquable côté HTML et « Libellé : https://… » côté texte.
    // Ce n'est pas une valeur du contact — la vidéo est la même pour tout le
    // monde — mais elle passe par ici parce que c'est la seule chose que le
    // gabarit sait substituer, et qu'une seconde voie ferait diverger l'aperçu
    // de l'envoi. Vide = aucune vidéo réglée, donc la phrase disparaît.
    video: globals.video,
    /*
      **L'adresse entière, pas le libellé** — l'écart avec `{video}`, et il est
      voulu : la partie `text/plain` est alors juste sans aucun développement, et
      seule la partie HTML demande une ancre (`withOurSiteLink`). Une règle de
      rendu en moins, donc une divergence de moins entre les deux parties.
    */
    notresite: globals.notresite,
  };
}

/**
 * Le libellé de la vidéo, ou `""`.
 *
 * Lu **par la même fonction que l'envoi** (`signatureVideo`) : un aperçu qui
 * annoncerait une vidéo que l'envoi ne composerait pas — faute d'adresse
 * publique, par exemple — montrerait une phrase qui ne partira pas. C'est le
 * défaut que ce projet a payé plusieurs fois, et la règle du jalon 87 : une
 * seule définition du rendu, pour l'aperçu comme pour la composition.
 */
export async function templateGlobals(): Promise<TemplateGlobals> {
  const [video, notresite] = await Promise.all([signatureVideo(), ourSiteUrlValue()]);
  return { video: video?.label ?? "", notresite };
}

export interface ManualDraft {
  readonly subject: string;
  readonly body: string;
}

/**
 * Le message d'une étape manuelle, pour un contact.
 *
 * `null` quand la fiche a disparu entre la lecture de la file et la
 * composition — le cas est rare et ne mérite pas d'inventer un texte.
 */
export async function renderManualStep(
  contactId: string,
  step: { readonly subject: string; readonly body: string },
  mailboxId: string | undefined,
  /**
   * Les variantes de l'étape. **Le choix se fait ici, avec le groupe lu sur la
   * fiche** — jamais par l'appelant : la composition, l'aperçu et le renvoi
   * d'un départ poseraient sinon la même question de trois façons, et c'est
   * toujours la troisième qui oublie le repli vers le défaut.
   */
  variants: readonly StepVariant[] = [],
  /**
   * Le routage d'« Autre » et des fiches non classées, lu sur la campagne.
   * `"default"` reproduit le comportement d'avant ce réglage, et c'est ce que
   * portent les campagnes existantes.
   */
  routing = "default",
): Promise<ManualDraft | null> {
  const contact = await readMergeContact(contactId);
  if (contact === null) return null;

  const template = templateFor(
    step,
    variants,
    // **Routage, pas classement** : la fiche n'est pas réécrite. Une fiche
    // jamais classée est routée comme « Autre » — dans les deux cas personne
    // n'a d'angle à lui servir, et c'est la campagne qui tranche.
    routedGroup(contact.contactGroup, contact.groupSetBy, toOtherRouting(routing)),
  );

  const values = mergeValuesOf(contact, await templateGlobals());
  const [config, signatories] = await Promise.all([readMailConfig(mailboxId), listSignatories()]);
  const signatory =
    (mailboxId === undefined
      ? undefined
      : signatories.find((entry) => entry.id === mailboxId)) ??
    pickSignatory(signatories, contact.owner);

  const signature =
    signatory === null ? signatureBlock(signatureOf(config)) : signatureBlock(signatory);

  return {
    subject: sanitizeSubject(renderSubject(template.subject, values)),
    // L'ordre des deux garde-fous est celui de la rédaction : l'appel d'abord,
    // il ouvre le message ; la signature ensuite, elle le ferme.
    body: enforceSignature(
      repairGreeting(renderTemplate(template.body, values), contact),
      signature,
      forbiddenSigners(config, signatories),
    ),
  };
}

export interface SampleContact {
  readonly id: string;
  readonly name: string;
  readonly values: MergeValues;
  /** Le groupe de fonction : c'est lui qui choisit la variante à l'aperçu. */
  readonly group: string;
  readonly groupSetBy: string;
}

export interface SampleSet {
  /** Les fiches, triées par nom, tous groupes confondus. */
  readonly contacts: readonly SampleContact[];
  /**
   * Le nombre **réel** par clé de groupe (`direction` … `autre`, plus `none`),
   * même quand la liste est bornée : c'est lui qu'affiche « 23 contacts dans ce
   * groupe ». Le déduire de `contacts` mentirait dès le 501ᵉ destinataire.
   */
  readonly totals: Readonly<Record<string, number>>;
  /** `false` = personne n'est encore inscrit, l'aperçu porte sur tout le CRM. */
  readonly enrolled: boolean;
}

/** Au-delà, on borne la liste — les compteurs restent exacts. */
const SAMPLE_LIMIT = 500;

/**
 * **Les contacts réels de la campagne, pour l'aperçu en direct.**
 *
 * ### Ce que le jalon précédent avait cassé
 *
 * La version d'avant gardait **une fiche par groupe** dans une `Map` : le menu
 * ne pouvait donc jamais porter plus de cinq entrées, et il en portait
 * exactement une quand un seul groupe était inscrit. L'intention — garantir que
 * chaque variante apparaisse dans l'aperçu — était juste ; elle était tenue en
 * plafonnant à un, ce qui rendait le menu inutile pour vérifier une fiche
 * précise. Deux limites secondaires s'y ajoutaient : `take: 40`, et la
 * restriction aux seuls inscrits, qui rendait une liste vide sur une campagne
 * dont personne n'est encore inscrit — c'est-à-dire au moment où l'on écrit.
 *
 * Désormais : **tous** les destinataires, triés par nom (`nameKey`, la clé pliée
 * du jalon 72 — accents et casse absorbés, valeurs vides en fin), et le compte
 * réel par groupe. L'écran filtre par groupe et affiche son compteur.
 *
 * **Le repli sur tout le CRM est nommé, pas silencieux** : `enrolled: false` dit
 * à l'écran d'écrire « aucun inscrit : aperçu sur tous les contacts », pour
 * qu'on ne croie pas relire la campagne.
 */
export async function sampleContacts(sequenceId: string): Promise<SampleSet> {
  const globals = await templateGlobals();

  const enrolled = await prisma.sequenceEnrollment.count({ where: { sequenceId } });
  /*
    **Les fiches closes sortent du repli, jamais des inscrits.** Un aperçu sur
    tout le CRM est une liste de travail, et une fiche « Perdu » n'en fait pas
    partie (jalon 30) ; un inscrit, lui, est montré tel qu'il est — la campagne
    le porte, et le masquer ferait diverger le menu du tableau des inscrits.
  */
  const where =
    enrolled > 0
      ? { enrollments: { some: { sequenceId } } }
      : { lifecycle: { notIn: [...TERMINAL_LIFECYCLES] } };

  const [rows, grouped] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: CONTACT_SELECT,
      orderBy: [{ nameKey: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: SAMPLE_LIMIT,
    }),
    prisma.contact.groupBy({
      by: ["contactGroup", "groupSetBy"],
      where,
      _count: { _all: true },
    }),
  ]);

  const totals: Record<string, number> = { none: 0 };
  for (const group of CONTACT_GROUPS) totals[group] = 0;
  for (const row of grouped) {
    const key = row.groupSetBy === "none" ? "none" : row.contactGroup;
    totals[key] = (totals[key] ?? 0) + row._count._all;
  }

  return {
    contacts: rows.map((contact) => ({
      id: contact.id,
      name: contactTitle(contact),
      values: mergeValuesOf(contact, globals),
      group: contact.contactGroup,
      groupSetBy: contact.groupSetBy,
    })),
    totals,
    enrolled: enrolled > 0,
  };
}

/**
 * Les destinataires dont une valeur utilisée par le texte manque, **avant tout
 * envoi**.
 *
 * Le retrait de phrase (jalon 87) est conservé — c'est le seul choix honnête —
 * mais il devient annonçable : « 7 destinataires sans société : une phrase sera
 * retirée de leur mail », avec le lien vers chaque fiche. Le compte se lit sur
 * les fiches réellement visées, jamais sur un échantillon.
 */
export interface MissingValueReport {
  readonly value: string;
  readonly contacts: readonly { readonly id: string; readonly name: string }[];
}

export async function missingValueReports(
  sequenceId: string,
  templates: readonly string[],
): Promise<readonly MissingValueReport[]> {
  const globals = await templateGlobals();
  const rows = await prisma.contact.findMany({
    where: { enrollments: { some: { sequenceId } } },
    select: CONTACT_SELECT,
    orderBy: [{ nameKey: { sort: "asc", nulls: "last" } }, { id: "asc" }],
  });

  const byValue = new Map<string, { id: string; name: string }[]>();
  for (const contact of rows) {
    const values = mergeValuesOf(contact, globals);
    const missing = new Set(
      templates.flatMap((template) => missingSentenceValues(template, values)),
    );
    for (const value of missing) {
      const list = byValue.get(value) ?? [];
      list.push({ id: contact.id, name: contactTitle(contact) });
      byValue.set(value, list);
    }
  }

  return [...byValue.entries()].map(([value, contacts]) => ({ value, contacts }));
}
