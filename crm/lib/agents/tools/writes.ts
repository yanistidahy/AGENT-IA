import { z } from "zod";
import { prisma } from "@/lib/db";
import { moveDealStage, updateDeal } from "@/lib/api/deals";
import { getSequence, runSequence } from "@/lib/api/sequences";
import { updateContact } from "@/lib/api/contacts";
import { ACTIVITY_TYPES, LIFECYCLES, TASK_PRIORITIES } from "@/lib/domain/types";
import { formatDate, money } from "@/lib/format";
import { defineTool } from "./types";

/**
 * Outils d'écriture.
 *
 * Aucun d'eux n'est appelé par la boucle de conversation : le runtime
 * interrompt le flux dès qu'un outil `mode: "write"` est demandé et attend la
 * confirmation de l'utilisateur. `run` n'est invoqué que depuis
 * `/api/actions/confirm`, après le clic. Chaque outil fournit un `summarize`
 * qui alimente la carte de confirmation — c'est ce que l'utilisateur lit avant
 * de décider, il doit donc être exact et lisible.
 */

const dateInput = z
  .string()
  .describe("Date au format AAAA-MM-JJ")
  .transform((value, ctx) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Date invalide" });
      return z.NEVER;
    }
    return parsed;
  });

export const createTask = defineTool({
  name: "create_task",
  description:
    "Crée une tâche de suivi. Rattachez-la à une affaire, un contact ou une société quand c'est pertinent — une tâche orpheline se perd.",
  mode: "write",
  schema: z.object({
    title: z.string().trim().min(1).describe("Intitulé, à l'impératif : « Relancer Sophie »"),
    due: dateInput,
    priority: z.enum(TASK_PRIORITIES).default("normale"),
    owner: z.string().trim().min(1).describe("Propriétaire de la tâche"),
    dealId: z.string().nullish(),
    contactId: z.string().nullish(),
    companyId: z.string().nullish(),
  }),
  summarize: (input) => ({
    headline: `Créer la tâche « ${input.title} »`,
    details: [
      `Échéance : ${formatDate(input.due)}`,
      `Priorité : ${input.priority}`,
      `Propriétaire : ${input.owner}`,
    ],
  }),
  run: async (input) => {
    const task = await prisma.task.create({
      data: {
        title: input.title,
        due: input.due,
        priority: input.priority,
        owner: input.owner,
        dealId: input.dealId ?? null,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
      },
    });
    return { créée: true, id: task.id, intitulé: task.title, échéance: task.due };
  },
});

export const logInteraction = defineTool({
  name: "log_interaction",
  description:
    "Consigne une interaction (appel, email, réunion, démo, note) dans l'historique. Met à jour la date de dernière activité de l'affaire et du contact.",
  mode: "write",
  schema: z.object({
    type: z.enum(ACTIVITY_TYPES),
    date: dateInput,
    notes: z.string().trim().min(1).describe("Ce qui a été dit, les objections, la prochaine étape"),
    owner: z.string().trim().min(1),
    duration: z.number().int().min(0).nullish().describe("Durée en minutes"),
    contactId: z.string().nullish(),
    dealId: z.string().nullish(),
  }),
  summarize: (input) => ({
    headline: `Consigner ${LABELS[input.type]} du ${formatDate(input.date)}`,
    details: [
      input.notes.length > 140 ? `${input.notes.slice(0, 140)}…` : input.notes,
      `Par : ${input.owner}`,
    ],
  }),
  run: async (input) => {
    const contact =
      input.contactId === null || input.contactId === undefined
        ? null
        : await prisma.contact.findUnique({ where: { id: input.contactId } });

    const activity = await prisma.activity.create({
      data: {
        type: input.type,
        date: input.date,
        notes: input.notes,
        owner: input.owner,
        duration: input.duration ?? null,
        contactId: input.contactId ?? null,
        dealId: input.dealId ?? null,
        companyId: contact?.companyId ?? null,
      },
    });

    if (input.contactId !== null && input.contactId !== undefined) {
      await prisma.contact.update({
        where: { id: input.contactId },
        data: { lastContact: input.date },
      });
    }
    if (input.dealId !== null && input.dealId !== undefined) {
      await prisma.deal.update({
        where: { id: input.dealId },
        data: { lastActivityAt: input.date },
      });
    }

    return { consignée: true, id: activity.id, type: activity.type };
  },
});

const LABELS: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  call: "un appel",
  email: "un email",
  meeting: "une réunion",
  demo: "une démo",
  note: "une note",
};

export const moveDealStageTool = defineTool({
  name: "move_deal_stage",
  description:
    "Déplace une affaire vers une autre étape du pipeline. Arriver sur l'étape terminale la marque gagnée et la date. Une note système est consignée automatiquement.",
  mode: "write",
  schema: z.object({
    dealId: z.string(),
    stageId: z.string().describe("Identifiant de l'étape cible"),
  }),
  summarize: async (input) => {
    const [deal, stage] = await Promise.all([
      prisma.deal.findUnique({
        where: { id: input.dealId },
        include: { stage: { select: { name: true } } },
      }),
      prisma.stage.findUnique({ where: { id: input.stageId } }),
    ]);

    return {
      headline: `Déplacer « ${deal?.name ?? input.dealId} » vers « ${stage?.name ?? input.stageId} »`,
      details: [
        `Étape actuelle : ${deal?.stage.name ?? "inconnue"}`,
        ...(stage !== null && stage.prob >= 100
          ? ["L'affaire sera marquée gagnée et la date de clôture posée."]
          : []),
      ],
    };
  },
  run: async (input) => {
    const result = await moveDealStage(input.dealId, input.stageId);
    if (result.ok === false) {
      return { déplacée: false, erreur: result.reason };
    }
    return {
      déplacée: true,
      id: result.deal.id,
      étape: result.deal.stage.name,
      statut: result.deal.status,
    };
  },
});

export const updateDealTool = defineTool({
  name: "update_deal",
  description:
    "Met à jour les champs d'une affaire : montant, date de clôture prévue, notes, propriétaire, probabilité. Seuls les champs fournis sont modifiés.",
  mode: "write",
  schema: z.object({
    dealId: z.string(),
    amount: z.number().int().min(0).optional(),
    expectedClose: dateInput.optional(),
    notes: z.string().optional(),
    owner: z.string().trim().min(1).optional(),
    prob: z.number().int().min(0).max(100).nullish(),
  }),
  summarize: async (input) => {
    const deal = await prisma.deal.findUnique({ where: { id: input.dealId } });
    const details: string[] = [];
    if (input.amount !== undefined) details.push(`Montant : ${money(deal?.amount ?? 0)} → ${money(input.amount)}`);
    if (input.expectedClose !== undefined) details.push(`Clôture prévue : ${formatDate(input.expectedClose)}`);
    if (input.owner !== undefined) details.push(`Propriétaire : ${input.owner}`);
    if (input.prob !== undefined) details.push(`Probabilité : ${input.prob ?? "celle de l'étape"} %`);
    if (input.notes !== undefined) details.push("Notes remplacées");

    return { headline: `Modifier « ${deal?.name ?? input.dealId} »`, details };
  },
  run: async (input) => {
    const deal = await updateDeal(input.dealId, {
      ...(input.amount === undefined ? {} : { amount: input.amount }),
      ...(input.expectedClose === undefined ? {} : { expectedClose: input.expectedClose }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      ...(input.owner === undefined ? {} : { owner: input.owner }),
      ...(input.prob === undefined ? {} : { prob: input.prob }),
    });
    if (deal === null) return { modifiée: false, erreur: "Affaire introuvable" };
    return { modifiée: true, id: deal.id, montant: deal.amount };
  },
});

export const createContact = defineTool({
  name: "create_contact",
  description:
    "Crée un contact. Rattachez-le à une société existante quand elle est connue plutôt que d'en créer une nouvelle.",
  mode: "write",
  schema: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    lifecycle: z.enum(LIFECYCLES).default("Lead"),
    owner: z.string().trim().min(1),
    source: z.string().trim().default(""),
    title: z.string().trim().default(""),
    email: z.string().trim().default(""),
    phone: z.string().trim().default(""),
    companyId: z.string().nullish(),
  }),
  summarize: (input) => ({
    headline: `Créer le contact ${input.firstName} ${input.lastName}`,
    details: [
      input.title === "" ? "Poste non renseigné" : `Poste : ${input.title}`,
      `Cycle de vie : ${input.lifecycle}`,
      `Propriétaire : ${input.owner}`,
    ],
  }),
  run: async (input) => {
    const contact = await prisma.contact.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        lifecycle: input.lifecycle,
        owner: input.owner,
        source: input.source,
        title: input.title,
        email: input.email,
        phone: input.phone,
        companyId: input.companyId ?? null,
      },
    });
    return { créé: true, id: contact.id, nom: `${contact.firstName} ${contact.lastName}` };
  },
});

/**
 * Programme la prochaine relance d'un contact.
 *
 * C'est l'écriture qui ferme la boucle du conseil : Sacha lit les contacts sans
 * nouvelles, en propose un, et pose la date. Le contact bascule aussitôt en
 * « Relance prévue » et remonte dans la puce « À relancer » — même donnée, même
 * calcul que l'écran.
 */
export const setReminder = defineTool({
  name: "set_reminder",
  description:
    "Programme la prochaine relance d'un contact (champ « Prochaine relance »). Le contact apparaîtra alors dans la liste à relancer, à la date fixée. Utiliser après avoir convenu d'une date avec l'utilisateur.",
  mode: "write",
  schema: z.object({
    contactId: z.string().trim().min(1),
    contactName: z.string().trim().min(1).describe("Nom du contact, pour la carte de confirmation"),
    date: dateInput,
  }),
  summarize: (input) => ({
    headline: `Programmer une relance pour ${input.contactName}`,
    details: [`Prochaine relance : ${formatDate(input.date)}`],
  }),
  run: async (input) => {
    const contact = await updateContact(input.contactId, { nextReminder: input.date });
    if (contact === null) return { programmée: false, erreur: "Contact introuvable" };
    return {
      programmée: true,
      id: contact.id,
      nom: `${contact.firstName} ${contact.lastName}`,
      prochaineRelance: contact.nextReminder,
    };
  },
});

/**
 * Lance une séquence sur une fiche : chaque étape devient une tâche datée.
 *
 * L'écriture la plus lourde du conseil — une séquence crée d'un coup trois à six
 * tâches. La carte de confirmation annonce donc le nombre exact d'étapes avant
 * le clic, pas après.
 */
export const runSequenceTool = defineTool({
  name: "run_sequence",
  description:
    "Lance une séquence de relance sur un contact, une société ou une affaire : chaque étape devient une tâche datée, préfixée du nom de la séquence. Lire d'abord list_sequences pour choisir la séquence et connaître ses étapes.",
  mode: "write",
  schema: z.object({
    sequenceId: z.string().trim().min(1),
    sequenceName: z.string().trim().min(1).describe("Nom de la séquence, pour la confirmation"),
    targetName: z.string().trim().min(1).describe("Nom de la fiche visée, pour la confirmation"),
    owner: z.string().trim().min(1),
    start: dateInput.describe("Date de départ ; les étapes sont datées à partir d'elle"),
    contactId: z.string().nullish(),
    companyId: z.string().nullish(),
    dealId: z.string().nullish(),
  }),
  summarize: (input) => ({
    headline: `Lancer « ${input.sequenceName} » sur ${input.targetName}`,
    details: [
      `Départ : ${formatDate(input.start)}`,
      `Propriétaire des tâches : ${input.owner}`,
      "Chaque étape de la séquence deviendra une tâche datée.",
    ],
  }),
  run: async (input) => {
    const sequence = await getSequence(input.sequenceId);
    if (sequence === null) return { lancée: false, erreur: "Séquence introuvable" };

    const result = await runSequence(input.sequenceId, {
      owner: input.owner,
      start: input.start,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      dealId: input.dealId ?? null,
    });

    if (!result.ok) {
      return {
        lancée: false,
        erreur:
          result.reason === "inactive"
            ? "Séquence en pause : la réactiver dans Réglages avant de la lancer"
            : "Séquence introuvable",
      };
    }

    return {
      lancée: true,
      tâchesCréées: result.tasks.length,
      échéances: result.tasks.map((task) => task.due),
    };
  },
});

export const WRITE_TOOLS = [
  createTask,
  logInteraction,
  moveDealStageTool,
  updateDealTool,
  createContact,
  setReminder,
  runSequenceTool,
] as const;
