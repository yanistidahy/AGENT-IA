import "server-only";
import { z } from "zod";

import { prisma } from "../db";
import { parseContactsQuery } from "./contact-schemas";
import { CONTACT_FILTER_COLUMNS } from "./contact-columns";
import { parseFilters } from "../domain/column-filters";
import { listContacts } from "./contacts";
import { getPilotage } from "./reference";
import { enroll } from "./email-sequences";
import { readReplyFacts } from "./email-replies";

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
  /** Personnes écrites — pas messages : relancer trois fois n'écrit qu'une personne. */
  readonly contacted: number;
  readonly sent: number;
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
  readonly funnel: CampaignFunnel;
}

/**
 * L'entonnoir d'une campagne — les mêmes définitions que `/emails`, bornées.
 *
 * « Répondu » et « rendez-vous » viennent de `readReplyFacts`, la **seule**
 * définition de « a répondu » du produit (jalon 39) : une campagne qui
 * compterait à sa façon finirait par contredire l'écran d'à côté sur les mêmes
 * personnes. « Ouvert » garde son statut d'estimation (jalon 37) — l'écran le
 * dit.
 */
export async function readCampaignFunnel(sequenceId: string): Promise<CampaignFunnel> {
  const [enrolled, running, sends] = await Promise.all([
    prisma.sequenceEnrollment.count({ where: { sequenceId } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId, status: "active" } }),
    prisma.emailSend.findMany({
      where: { sequenceId },
      select: { contactId: true, sentAt: true, openCount: true },
      orderBy: { sentAt: "asc" },
    }),
  ]);

  const firstSend = new Map<string, Date>();
  const openedBy = new Set<string>();
  for (const send of sends) {
    if (send.contactId === null) continue;
    if (!firstSend.has(send.contactId)) firstSend.set(send.contactId, send.sentAt);
    if (send.openCount > 0) openedBy.add(send.contactId);
  }

  const facts = await readReplyFacts(firstSend);
  let replied = 0;
  let meetings = 0;
  for (const fact of facts.values()) {
    if (fact.repliedAt !== null) replied += 1;
    if (fact.metAt !== null) meetings += 1;
  }

  return {
    enrolled,
    running,
    contacted: firstSend.size,
    sent: sends.length,
    opened: openedBy.size,
    replied,
    meetings,
  };
}

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
    views.push({
      id: row.id,
      name: row.name,
      mailboxId: row.mailboxId,
      mailboxLabel: row.mailbox.label,
      signName: row.mailbox.signName,
      selection: row.selection,
      sequenceId: row.sequence?.id ?? "",
      funnel:
        row.sequence === null
          ? { enrolled: 0, running: 0, contacted: 0, sent: 0, opened: 0, replied: 0, meetings: 0 }
          : await readCampaignFunnel(row.sequence.id),
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
        active: false,
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
): Promise<{ ok: true; outcome: EnrollSelectionOutcome } | { ok: false; message: string }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { sequence: { select: { id: true } } },
  });
  if (campaign === null) return { ok: false, message: "Campagne introuvable." };
  if (campaign.sequence === null) {
    return { ok: false, message: "Cette campagne n'a pas de séquence." };
  }

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

  // La sélection est mémorisée sur la campagne : c'est elle que « Réinscrire »
  // ré-évaluera, et elle que l'écran affiche comme définition du public.
  await prisma.campaign.update({ where: { id: campaignId }, data: { selection } });

  let enrolled = 0;
  let already = 0;
  const refusedReasons: string[] = [];

  // Par lots de 200 — la borne du schéma d'inscription du jalon 38, conservée :
  // elle borne chaque transaction, pas la campagne.
  const ids = contacts.map((contact) => contact.id);
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
