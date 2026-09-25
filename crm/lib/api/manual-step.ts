import "server-only";
import { prisma } from "../db";
import { renderSubject, renderTemplate, type MergeValues } from "../domain/merge-tags";
import { resolveResearchTarget } from "../domain/research-target";
import { contactTitle, repairGreeting } from "../domain/contact-identity";
import { enforceSignature, sanitizeSubject } from "../domain/email-format";
import { signatureBlock } from "../agents/prompts/company";
import { forbiddenSigners } from "../agents/email-draft";
import { readMailConfig, signatureOf, signatureVideo } from "./mail";
import { listSignatories, pickSignatory } from "./signatories";

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
  email: true,
  instagram: true,
  website: true,
  owner: true,
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
export function mergeValuesOf(
  contact: NonNullable<MergeContact>,
  videoLabel = "",
): MergeValues {
  const target = resolveResearchTarget({
    website: contact.website,
    companyDomain: contact.company?.domain ?? "",
    emails: [contact.email],
  });
  return {
    prenom: contact.firstName,
    societe: contact.company?.name ?? "",
    site: target?.host ?? "",
    // **Le libellé, pas l'adresse** : `{video}` se substitue comme le lien de
    // démonstration depuis le jalon 34, et c'est la couche d'envoi qui en fait
    // une vignette cliquable côté HTML et « Libellé : https://… » côté texte.
    // Ce n'est pas une valeur du contact — la vidéo est la même pour tout le
    // monde — mais elle passe par ici parce que c'est la seule chose que le
    // gabarit sait substituer, et qu'une seconde voie ferait diverger l'aperçu
    // de l'envoi. Vide = aucune vidéo réglée, donc la phrase disparaît.
    video: videoLabel,
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
async function videoLabel(): Promise<string> {
  return (await signatureVideo())?.label ?? "";
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
  template: { readonly subject: string; readonly body: string },
  mailboxId: string | undefined,
): Promise<ManualDraft | null> {
  const contact = await readMergeContact(contactId);
  if (contact === null) return null;

  const values = mergeValuesOf(contact, await videoLabel());
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
}

/**
 * Jusqu'à trois contacts réels, pour l'aperçu en direct.
 *
 * **Pris parmi les inscrits de la campagne**, et non fabriqués : un aperçu sur
 * un contact inventé montrerait toujours le cas heureux, alors que ce qu'on
 * veut voir avant d'enregistrer est précisément ce que donnent les fiches
 * incomplètes. Les fiches **sans prénom** et **sans site** passent donc devant.
 */
export async function sampleContacts(sequenceId: string): Promise<SampleContact[]> {
  const label = await videoLabel();
  const rows = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId },
    select: { contact: { select: CONTACT_SELECT } },
    take: 40,
  });

  const samples = rows
    .map((row) => row.contact)
    .filter((contact): contact is NonNullable<typeof contact> => contact !== null)
    .map((contact) => ({
      id: contact.id,
      name: contactTitle(contact),
      values: mergeValuesOf(contact, label),
    }));

  // Le cas dégradé d'abord : c'est celui qu'on ne pense pas à vérifier.
  const rank = (entry: SampleContact) =>
    (entry.values.prenom.trim() === "" ? 0 : 1) + (entry.values.site.trim() === "" ? 0 : 1);
  return [...samples].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
}
