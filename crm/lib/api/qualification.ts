import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { searchText } from "../domain/text";
import { ownerOrDefault } from "./automation";
import {
  AMOUNT_REQUIRED,
  alreadyQualified,
  draftFromContact,
  QUALIFIED,
  validAmount,
} from "../domain/qualification";
import type { UndoStep } from "./queue";
import { contactTitle } from "../domain/contact-identity";

/**
 * Qualifier un contact, c'est ouvrir une affaire.
 *
 * Le geste est **un seul** : le cycle de vie passe à `Qualifié`, l'affaire naît
 * pré-remplie depuis la fiche, et les deux partent dans la même transaction.
 * Les séparer laisserait un contact qualifié sans rien à suivre — l'état
 * intermédiaire exact que ce jalon supprime.
 *
 * Deux garanties tiennent le reste :
 *
 * - **rien n'est irréversible** : l'inverse est calculé avant d'écrire et
 *   renvoyé au client, comme pour la file d'accueil. Annuler supprime l'affaire
 *   **et** rend son cycle de vie d'origine ;
 * - **rejouer ne crée rien** : un contact portant déjà une affaire ouverte est
 *   qualifié sans seconde affaire, et l'écran dit laquelle existe.
 */
export const qualifySchema = z.object({
  contactId: z.string().trim().min(1),
  amount: z.number({ error: AMOUNT_REQUIRED }).finite().positive(AMOUNT_REQUIRED),
  offer: z.string().trim().min(1, "Choisissez une offre"),
  /** Étape d'entrée. Absente = la première du pipeline. */
  stageId: z.string().trim().min(1).optional(),
});

export type QualifyInput = z.infer<typeof qualifySchema>;

export type QualifyResult =
  | {
      readonly ok: true;
      readonly created: true;
      readonly dealId: string;
      readonly dealName: string;
      readonly message: string;
      readonly undo: readonly UndoStep[];
    }
  | {
      readonly ok: true;
      readonly created: false;
      readonly dealId: string;
      readonly dealName: string;
      readonly message: string;
      readonly undo: readonly UndoStep[];
    }
  | { readonly ok: false; readonly message: string };

/**
 * La dernière offre vendue, proposée par défaut.
 *
 * « Vendue » et non « saisie » : une offre gagnée est une offre qui a convaincu
 * quelqu'un, alors qu'une offre saisie sur une affaire perdue est justement
 * celle qu'il faudrait éviter de reproposer par défaut.
 */
export async function lastSoldOffer(): Promise<string | null> {
  const won = await prisma.deal.findFirst({
    where: { status: "won", NOT: { offer: "" } },
    orderBy: { closedAt: "desc" },
    select: { offer: true },
  });
  if (won !== null) return won.offer;

  const any = await prisma.deal.findFirst({
    where: { NOT: { offer: "" } },
    orderBy: { createdAt: "desc" },
    select: { offer: true },
  });
  return any?.offer ?? null;
}

export async function qualifyContact(
  input: QualifyInput,
  now: Date = new Date(),
): Promise<QualifyResult> {
  if (!validAmount(input.amount)) return { ok: false, message: AMOUNT_REQUIRED };

  const contact = await prisma.contact.findUnique({
    where: { id: input.contactId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      lifecycle: true,
      owner: true,
      companyId: true,
      company: { select: { name: true } },
      deals: {
        where: { status: "open" },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (contact === null) return { ok: false, message: "Contact introuvable." };

  const previousLifecycle = contact.lifecycle;
  const undo: UndoStep[] = [];

  // Le cycle de vie bouge dans les deux cas : ce que l'on vient d'apprendre du
  // prospect est vrai, qu'une affaire existe déjà ou non.
  if (previousLifecycle !== QUALIFIED) {
    undo.push({ kind: "contact", id: contact.id, lifecycle: previousLifecycle });
  }

  const existing = contact.deals[0];
  if (existing !== undefined) {
    if (previousLifecycle !== QUALIFIED) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lifecycle: QUALIFIED },
      });
    }
    return {
      ok: true,
      created: false,
      dealId: existing.id,
      dealName: existing.name,
      message: alreadyQualified(existing.name),
      undo,
    };
  }

  const stage = await resolveEntryStage(input.stageId);
  if (stage === null) {
    return {
      ok: false,
      message:
        "Aucune étape de pipeline n'est configurée : impossible de créer l'affaire. Voir Réglages → Étapes.",
    };
  }

  const draft = draftFromContact(
    {
      contactId: contact.id,
      contactName: contactTitle(contact),
      companyId: contact.companyId,
      companyName: contact.company?.name ?? null,
      owner: await ownerOrDefault(prisma, contact.owner),
      amount: input.amount,
      offer: input.offer,
    },
    now,
  );

  const deal = await prisma.$transaction(async (tx) => {
    const created = await tx.deal.create({
      data: {
        name: draft.name,
        searchText: searchText([draft.name, draft.offer]),
        amount: draft.amount,
        offer: draft.offer,
        owner: draft.owner,
        companyId: draft.companyId,
        contactId: draft.contactId,
        expectedClose: draft.expectedClose,
        stageId: stage.id,
        status: "open",
        lastActivityAt: now,
        stageSince: now,
        notes: "Créée à la qualification du contact.",
      },
      select: { id: true, name: true },
    });

    await tx.dealStageVisit.create({
      data: { dealId: created.id, stageId: stage.id, enteredAt: now },
    });

    await tx.contact.update({
      where: { id: contact.id },
      data: { lifecycle: QUALIFIED },
    });

    await tx.activity.create({
      data: {
        type: "note",
        date: now,
        owner: draft.owner,
        notes: `Qualifié : ${draft.offer}, ${draft.amount} €. Affaire « ${created.name} » ouverte.`,
        contactId: contact.id,
        dealId: created.id,
      },
    });

    return created;
  });

  undo.push({ kind: "deal-delete", id: deal.id });

  return {
    ok: true,
    created: true,
    dealId: deal.id,
    dealName: deal.name,
    message: `Affaire « ${deal.name} » créée.`,
    undo,
  };
}

/** L'étape demandée, sinon la première du pipeline. */
async function resolveEntryStage(
  stageId: string | undefined,
): Promise<{ id: string } | null> {
  if (stageId !== undefined) {
    const chosen = await prisma.stage.findUnique({ where: { id: stageId }, select: { id: true } });
    if (chosen !== null) return chosen;
  }
  return prisma.stage.findFirst({ orderBy: { position: "asc" }, select: { id: true } });
}
