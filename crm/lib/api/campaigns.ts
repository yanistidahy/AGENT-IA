import "server-only";
import { z } from "zod";

import { prisma } from "../db";
import { parseContactsQuery } from "./contact-schemas";
import { CONTACT_FILTER_COLUMNS } from "./contact-columns";
import { parseFilters } from "../domain/column-filters";
import { listContacts } from "./contacts";
import { getPilotage } from "./reference";
import { enroll } from "./email-sequences";
import { readFunnelFacts } from "./email-stats";
import { readReplyFacts } from "./email-replies";
import { contactTitle } from "../domain/contact-identity";
import { buildFunnel, type FunnelStep } from "../domain/email-funnel";
import { memberState, type CampaignMember } from "../domain/campaign-members";

/**
 * **Une campagne : une boîte, une sélection, une séquence.**
 *
 * La campagne ne réinvente rien : la séquence est celle du jalon 38 — mêmes
 * étapes, mêmes inscriptions, même file de départs du matin, mêmes règles
 * vérifiées **à l'envoi** (`sequence-rules.ts` : fiche close, opposition,
 * réponse, week-end). Elle ajoute ce qui manquait pour lancer : d'où partent
 * les messages (la boîte, donc la signature), à qui l'on écrit (la sélection,
 * dans le vocabulaire de /contacts), et ce que ça produit (l'entonnoir, borné
 * à cette campagne).
 *
 * La sélection est stockée comme **query string de /contacts** : on choisit ses
 * contacts avec les outils qu'on utilise déjà — puces, filtres de colonne,
 * recherche — et l'inscription fige les personnes que le filtre désigne à cet
 * instant. Le filtre décrit une intention ; l'inscription, un fait.
 */

export interface CampaignFunnel {
  readonly enrolled: number;
  readonly running: number;
  /**
   * L'entonnoir **tel que /emails le construit**, borné à cette campagne.
   *
   * Écrit → ouvert (estimation) → répondu → rendez-vous, avec ses taux et ses
   * chutes. C'est `buildFunnel` sur les faits de `readFunnelFacts`, la même
   * série que la page des emails — pas une addition parallèle.
   */
  readonly steps: readonly FunnelStep[];
  /** Messages partis, tous destinataires confondus. Repère, pas étape. */
  readonly messages: number;
  /** Personnes écrites — le sommet, repris ici pour la lecture en un coup d'œil. */
  readonly contacted: number;
  readonly opened: number;
  readonly replied: number;
  readonly meetings: number;
}

export interface CampaignView {
  readonly id: string;
  readonly name: string;
  readonly mailboxId: string;
  readonly mailboxLabel: string;
  readonly signName: string;
  readonly selection: string;
  readonly sequenceId: string;
  readonly archivedAt: Date | null;
  /**
   * Peut-elle être supprimée ? **Dérivé de l'entonnoir déjà calculé**, jamais
   * d'une requête de plus : `messages === 0` est exactement la condition, et
   * la lire ailleurs ouvrirait la porte à un écran qui propose « Supprimer »
   * sur une campagne que le serveur refusera. Le verdict fait toujours foi au
   * moment d'écrire — voir `deleteVerdict`.
   */
  readonly deletable: boolean;
  readonly funnel: CampaignFunnel;
}

/**
 * L'entonnoir d'une campagne — **le calcul de /emails, borné**.
 *
 * Au jalon 54, cette fonction additionnait elle-même ses envois : deux
 * calculs pour un même entonnoir, donc deux séries qui finiraient par se
 * contredire sur les mêmes personnes. Elle appelle désormais
 * `readFunnelFacts({ sequenceId })` — la fonction qui sert /emails — et
 * `buildFunnel` par-dessus. **Les deux écrans ne peuvent plus diverger : il
 * n'y a qu'une addition.**
 *
 * Ce qu'elle ajoute, et que /emails n'a pas à connaître : le nombre d'inscrits
 * et d'inscriptions actives, qui appartiennent à la campagne et non aux envois
 * — quelqu'un peut être inscrit sans avoir encore rien reçu, et c'est
 * précisément ce qu'on veut voir.
 */
export async function readCampaignFunnel(sequenceId: string): Promise<CampaignFunnel> {
  const [enrolled, running, facts] = await Promise.all([
    prisma.sequenceEnrollment.count({ where: { sequenceId } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId, status: "active" } }),
    readFunnelFacts({ sequenceId }),
  ]);

  return {
    enrolled,
    running,
    steps: buildFunnel(facts.input),
    messages: facts.input.messages,
    contacted: facts.input.written,
    opened: facts.input.opened,
    replied: facts.input.replied,
    meetings: facts.input.meetings,
  };
}

const EMPTY_FUNNEL: CampaignFunnel = {
  enrolled: 0,
  running: 0,
  steps: buildFunnel({ written: 0, messages: 0, opened: 0, tracked: 0, replied: 0, meetings: 0 }),
  messages: 0,
  contacted: 0,
  opened: 0,
  replied: 0,
  meetings: 0,
};

export async function listCampaigns(): Promise<CampaignView[]> {
  const rows = await prisma.campaign.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      mailbox: { select: { label: true, signName: true } },
      sequence: { select: { id: true } },
    },
  });

  const views: CampaignView[] = [];
  for (const row of rows) {
    const funnel = row.sequence === null ? EMPTY_FUNNEL : await readCampaignFunnel(row.sequence.id);
    views.push({
      id: row.id,
      name: row.name,
      mailboxId: row.mailboxId,
      mailboxLabel: row.mailbox.label,
      signName: row.mailbox.signName,
      selection: row.selection,
      sequenceId: row.sequence?.id ?? "",
      archivedAt: row.archivedAt,
      deletable: funnel.messages === 0,
      funnel,
    });
  }
  return views;
}

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Le nom ne peut pas être vide").max(80),
  mailboxId: z.string().min(1, "Choisissez la boîte d'envoi"),
});

/**
 * Crée la campagne **et sa séquence**, dans la même transaction.
 *
 * Une campagne sans séquence ne saurait pas envoyer, une séquence sans
 * campagne n'a plus d'écran depuis ce jalon : les deux naissent ensemble ou
 * pas du tout. La séquence part inactive avec une seule étape vide — rien ne
 * peut se composer tant qu'on ne l'a pas relue et activée.
 */
export async function createCampaign(
  input: z.infer<typeof createCampaignSchema>,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: input.mailboxId },
    select: { id: true },
  });
  if (mailbox === null) return { ok: false, message: "Cette boîte d'envoi n'existe pas." };

  const id = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: { name: input.name, mailboxId: input.mailboxId },
      select: { id: true },
    });
    await tx.emailSequence.create({
      data: {
        name: input.name,
        // **Active dès la création, et ce n'est pas un relâchement.**
        //
        // Pour une campagne, `active` n'a jamais été le garde-fou qui protège de
        // l'envoi : ce qui protège, c'est qu'un départ ne part **que sur un
        // clic** dans la file (jalon 38), et que le mode automatique — le seul
        // chemin sans clic — garde son double verrou et ne couvre jamais la
        // première étape. Une campagne créée inactive ne protégeait donc de
        // rien ; elle empêchait seulement la composition, y compris celle qu'on
        // vient de demander, et sans le dire.
        //
        // Rien ne se compose pour autant tant qu'aucune étape ne porte de
        // consigne : c'est cette condition-là qui empêche d'écrire n'importe
        // quoi, et elle est vérifiée à chaque composition.
        active: true,
        campaignId: campaign.id,
        steps: { create: [{ position: 1, delayDays: 0, brief: "" }] },
      },
    });
    return campaign.id;
  });

  return { ok: true, id };
}

export const updateCampaignSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  mailboxId: z.string().min(1).optional(),
});

/**
 * Renomme ou change la boîte d'une campagne.
 *
 * Changer la boîte ne réécrit pas le passé : les envois déjà partis gardent la
 * boîte qui les a réellement expédiés (`EmailSend.mailboxId`). Seuls les
 * départs **à venir** partent de la nouvelle.
 */
export async function updateCampaign(
  input: z.infer<typeof updateCampaignSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.mailboxId !== undefined) {
    const mailbox = await prisma.mailbox.findUnique({
      where: { id: input.mailboxId },
      select: { id: true },
    });
    if (mailbox === null) return { ok: false, message: "Cette boîte d'envoi n'existe pas." };
  }

  await prisma.campaign.update({
    where: { id: input.id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.mailboxId === undefined ? {} : { mailboxId: input.mailboxId }),
    },
  });
  // Le nom de la séquence suit celui de la campagne : c'est lui que portent les
  // lignes d'envoi (`sequenceName`) et l'interaction consignée.
  if (input.name !== undefined) {
    await prisma.emailSequence.updateMany({
      where: { campaignId: input.id },
      data: { name: input.name },
    });
  }
  return { ok: true };
}

/**
 * La campagne d'où part une séquence — **déduite, jamais reçue**.
 *
 * `EmailSequence.campaignId` est unique : une séquence appartient à une
 * campagne et à une seule. La ligne d'envoi la nomme donc à partir de la base,
 * pas d'un champ transmis par l'écran — sinon deux campagnes pourraient
 * revendiquer le même message et l'entonnoir de /emails ne saurait plus lequel
 * croire.
 */
export async function campaignOfSequence(
  sequenceId: string,
): Promise<{ readonly id: string; readonly name: string } | null> {
  if (sequenceId === "") return null;
  const sequence = await prisma.emailSequence.findUnique({
    where: { id: sequenceId },
    select: { campaign: { select: { id: true, name: true } } },
  });
  return sequence?.campaign ?? null;
}

export interface EnrollSelectionOutcome {
  readonly matched: number;
  readonly enrolled: number;
  readonly already: number;
  readonly refused: number;
  readonly refusedReasons: readonly string[];
}

/**
 * Inscrit à la campagne les contacts que sa sélection désigne **maintenant**.
 *
 * Le filtre est ré-évalué côté serveur avec les mêmes fonctions que /contacts
 * (`parseContactsQuery` + `parseFilters` + `listContacts`) — pas une copie de
 * la logique, la logique. Ce que l'écran montrait est ce qui s'inscrit.
 *
 * L'inscription passe par `enroll()` du jalon 38, qui n'écarte que ce qui n'a
 * aucun sens à inscrire (fiche close, opposition, adresse absente) : le reste
 * des garde-fous se vérifie **à l'envoi**, comme toujours. Idempotente par la
 * contrainte d'unicité — relancer l'inscription n'inscrit personne deux fois.
 */
export async function enrollSelection(
  campaignId: string,
  selection: string,
  /**
   * Les fiches **cochées**, quand l'écran en a coché.
   *
   * Elles l'emportent alors sur le filtre, et c'est la seule lecture juste :
   * cocher huit fiches sur un filtre Instagram puis cinq sur un filtre de rôle
   * produit treize personnes qu'**aucune requête unique ne décrit**. Le filtre
   * reste mémorisé comme trace de la façon dont on les a trouvées ; la liste,
   * elle, dit qui.
   *
   * Vide ou absent : on retombe sur la ré-évaluation du filtre, qui sert la
   * réinscription et les appels programmatiques.
   */
  contactIds?: readonly string[],
): Promise<{ ok: true; outcome: EnrollSelectionOutcome } | { ok: false; message: string }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { sequence: { select: { id: true } } },
  });
  if (campaign === null) return { ok: false, message: "Campagne introuvable." };
  if (campaign.sequence === null) {
    return { ok: false, message: "Cette campagne n'a pas de séquence." };
  }

  let ids: string[];

  if (contactIds !== undefined && contactIds.length > 0) {
    ids = [...new Set(contactIds)];
  } else {
    const params = new URLSearchParams(selection);
    const query = parseContactsQuery(params);
    if (!query.success) {
      return { ok: false, message: "La sélection enregistrée n'est plus un filtre valide." };
    }

    const record: Record<string, string | string[] | undefined> = {};
    for (const key of new Set(params.keys())) {
      const all = params.getAll(key);
      record[key] = all.length > 1 ? all : all[0];
    }
    const filters = parseFilters(record, CONTACT_FILTER_COLUMNS);

    const contacts = await listContacts(query.data, await getPilotage(), new Date(), filters);
    ids = contacts.map((contact) => contact.id);
  }

  // La sélection est mémorisée sur la campagne : c'est elle que « Réinscrire »
  // ré-évaluera, et elle que l'écran affiche comme définition du public.
  await prisma.campaign.update({ where: { id: campaignId }, data: { selection } });

  let enrolled = 0;
  let already = 0;
  const refusedReasons: string[] = [];

  // Par lots de 200 — la borne du schéma d'inscription du jalon 38, conservée :
  // elle borne chaque transaction, pas la campagne.
  for (let at = 0; at < ids.length; at += 200) {
    const outcome = await enroll({
      sequenceId: campaign.sequence.id,
      contactIds: ids.slice(at, at + 200),
    });
    enrolled += outcome.enrolled;
    already += outcome.already;
    for (const refusal of outcome.refused) refusedReasons.push(refusal.reason);
  }

  return {
    ok: true,
    outcome: {
      matched: ids.length,
      enrolled,
      already,
      refused: refusedReasons.length,
      refusedReasons: [...new Set(refusedReasons)],
    },
  };
}

/* ------------------------------------------------ archiver, supprimer */

/**
 * Archive une campagne — **la fin normale d'une campagne**.
 *
 * Elle sort de la liste active, cesse de composer (sa séquence est désactivée)
 * et ses inscriptions actives s'arrêtent en disant pourquoi. Ce qu'elle garde :
 * tout. Les envois, les ouvertures, les réponses et les rendez-vous sont des
 * faits, et /emails continue de les compter.
 *
 * **Les contacts ne sont pas touchés** : ils restent dans le CRM avec leur
 * historique — seule l'inscription se termine. C'est la règle du jalon 3 sur la
 * suppression d'un contact, prise par l'autre bout : effacer un conteneur ne
 * doit jamais effacer ce qu'il contenait.
 */
export async function archiveCampaign(
  id: string,
  archived: boolean,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { sequence: { select: { id: true } } },
  });
  if (campaign === null) return { ok: false, message: "Campagne introuvable." };

  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id },
      data: { archivedAt: archived ? now : null },
    });

    if (campaign.sequence === null) return;

    // Désactiver la séquence : `composeDepartures` ne retient que les séquences
    // actives, donc plus rien ne se compose. Le désarchivage ne la réactive
    // **pas** — relancer une campagne est une décision, pas un effet de bord.
    await tx.emailSequence.update({
      where: { id: campaign.sequence.id },
      data: { active: archived ? false : undefined },
    });

    if (!archived) return;

    await tx.sequenceEnrollment.updateMany({
      where: { sequenceId: campaign.sequence.id, status: "active" },
      data: { status: "stopped", stopReason: "Campagne archivée" },
    });
    // Les départs composés mais non partis n'ont plus lieu d'être : les laisser
    // en attente les ferait apparaître demain dans la file du matin, sous le nom
    // d'une campagne qu'on vient de clore.
    await tx.sequenceDeparture.updateMany({
      where: {
        status: "pending",
        enrollment: { sequenceId: campaign.sequence.id },
      },
      data: { status: "skipped", decidedAt: now, detail: "Campagne archivée" },
    });
  });

  return { ok: true };
}

export interface DeleteVerdict {
  readonly deletable: boolean;
  /** Ce qui retient la suppression, nommé et chiffré. */
  readonly reason: string;
  /** Ce qui partirait avec elle, pour que la confirmation ne cache rien. */
  readonly enrolled: number;
  readonly sends: number;
}

/**
 * Peut-on supprimer cette campagne ?
 *
 * **Un envoi interdit la suppression.** Un message parti, une ouverture, une
 * réponse sont des faits mesurés ; effacer la campagne qui les a produits ferait
 * mentir les chiffres de /emails — la ligne d'envoi survivrait avec un
 * `sequenceId` qui ne désigne plus rien. C'est la règle du jalon 47 sur les
 * affaires, mot pour mot : ce qui porte une histoire s'archive, ça ne s'efface
 * pas.
 *
 * Une campagne **vide** — créée par erreur, rien d'inscrit, rien d'envoyé — se
 * supprime derrière une confirmation qui la nomme. Des inscriptions sans aucun
 * envoi ne bloquent pas : personne n'a rien reçu, il n'y a aucun fait à
 * préserver, et les fiches, elles, ne bougent pas.
 */
export async function deleteVerdict(id: string): Promise<DeleteVerdict> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { sequence: { select: { id: true } } },
  });
  if (campaign === null) {
    return { deletable: false, reason: "Campagne introuvable.", enrolled: 0, sends: 0 };
  }

  const sequenceId = campaign.sequence?.id;
  const [enrolled, sends] = await Promise.all([
    sequenceId === undefined
      ? 0
      : prisma.sequenceEnrollment.count({ where: { sequenceId } }),
    sequenceId === undefined ? 0 : prisma.emailSend.count({ where: { sequenceId } }),
  ]);

  if (sends > 0) {
    return {
      deletable: false,
      reason:
        `Cette campagne a envoyé ${sends} message${sends > 1 ? "s" : ""}. ` +
        "Les envois, les ouvertures et les réponses sont des faits que /emails compte : " +
        "la supprimer ferait mentir ces chiffres. Archivez-la — elle sort de la liste " +
        "active et garde son histoire.",
      enrolled,
      sends,
    };
  }

  return { deletable: true, reason: "", enrolled, sends };
}

/**
 * Supprime une campagne qui n'a rien envoyé.
 *
 * Le verdict est **relu au moment d'écrire**, jamais repris de l'affichage : la
 * confirmation peut rester ouverte pendant qu'un départ part, et c'est
 * exactement l'instant où la campagne cesse d'être supprimable (leçon du
 * jalon 47).
 *
 * La cascade emporte la séquence, ses étapes, ses inscriptions et ses départs —
 * **et rien d'autre**. Les contacts restent en base avec leur historique : les
 * interactions consignées et les lignes d'envoi ne sont pas des enfants de la
 * campagne.
 */
export async function deleteCampaign(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const verdict = await deleteVerdict(id);
  if (!verdict.deletable) return { ok: false, message: verdict.reason };

  await prisma.$transaction(async (tx) => {
    // La séquence d'abord : sa clé étrangère vers la campagne est `SetNull`,
    // donc la laisser en ferait une séquence orpheline, sans écran pour la
    // montrer ni campagne pour la lancer.
    await tx.emailSequence.deleteMany({ where: { campaignId: id } });
    await tx.campaign.delete({ where: { id } });
  });

  return { ok: true };
}

/* ------------------------------------------------ qui est dans la campagne */

export {
  MEMBER_STATES,
  memberState,
  type CampaignMember,
  type MemberState,
} from "../domain/campaign-members";

/**
 * Les inscrits d'une campagne, avec ce qu'il faut pour décider.
 *
 * Les réponses viennent de `readReplyFacts` — la seule définition de « a
 * répondu » du produit (jalon 39), la même que /emails et que l'entonnoir de
 * cette campagne. Trois écrans qui compteraient chacun leurs réponses
 * finiraient par en afficher trois nombres.
 */
export async function listCampaignMembers(sequenceId: string): Promise<CampaignMember[]> {
  const [enrollments, sends, steps] = await Promise.all([
    prisma.sequenceEnrollment.findMany({
      where: { sequenceId },
      select: {
        id: true,
        status: true,
        stopReason: true,
        lastStep: true,
        lastSentAt: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            company: { select: { name: true } },
          },
        },
      },
      orderBy: { enrolledAt: "asc" },
    }),
    prisma.emailSend.findMany({
      where: { sequenceId },
      select: { contactId: true, sentAt: true, firstOpenAt: true },
      orderBy: { sentAt: "asc" },
    }),
    prisma.emailSequenceStep.count({ where: { sequenceId } }),
  ]);

  const firstSend = new Map<string, Date>();
  const opened = new Set<string>();
  for (const send of sends) {
    if (send.contactId === null) continue;
    if (!firstSend.has(send.contactId)) firstSend.set(send.contactId, send.sentAt);
    if (send.firstOpenAt !== null) opened.add(send.contactId);
  }
  const facts = await readReplyFacts(firstSend);

  return enrollments.map((enrollment) => {
    const contact = enrollment.contact;
    const repliedAt = facts.get(contact.id)?.repliedAt ?? null;
    return {
      enrollmentId: enrollment.id,
      contactId: contact.id,
      name: contactTitle({ ...contact, company: null }),
      company: contact.company?.name ?? "",
      role: contact.title,
      step: enrollment.lastStep,
      steps,
      lastSentAt: enrollment.lastSentAt,
      opened: opened.has(contact.id),
      repliedAt,
      state: memberState({
        status: enrollment.status,
        lastSentAt: enrollment.lastSentAt,
        repliedAt,
      }),
      stopReason: enrollment.stopReason,
    };
  });
}

/**
 * Retire un contact de la campagne — **sans toucher à sa fiche**.
 *
 * L'inscription passe à « arrêtée » avec sa raison, et les départs composés mais
 * non partis sont écartés. La fiche, ses interactions, ses envois passés et son
 * historique ne bougent pas : ce qui a été écrit a été écrit, et /emails
 * continue de le compter.
 *
 * L'inscription est **arrêtée, pas supprimée** : la supprimer sortirait la
 * personne du dénominateur de l'entonnoir, et le taux de réponse de la campagne
 * s'améliorerait à chaque retrait. Un chiffre qui se bonifie quand on retire les
 * gens ne mesure plus rien.
 */
export async function removeMember(
  enrollmentId: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true },
  });
  if (enrollment === null) return { ok: false, message: "Inscription introuvable." };

  await prisma.$transaction([
    prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "stopped", stopReason: "Retiré de la campagne à la main" },
    }),
    prisma.sequenceDeparture.updateMany({
      where: { enrollmentId, status: "pending" },
      data: { status: "skipped", decidedAt: now, detail: "Retiré de la campagne" },
    }),
  ]);

  return { ok: true };
}

/** Les contacts déjà inscrits — pour que /contacts les marque et les exclue. */
export async function enrolledContactIds(sequenceId: string): Promise<Set<string>> {
  const rows = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId },
    select: { contactId: true },
  });
  return new Set(rows.map((row) => row.contactId));
}
