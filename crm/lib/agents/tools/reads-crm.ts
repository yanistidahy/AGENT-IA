import { z } from "zod";
import { listActivities, listCompanyTimeline } from "@/lib/api/activities";
import { readAlerts } from "@/lib/api/alerts";
import { readClients } from "@/lib/api/clients";
import { listContacts } from "@/lib/api/contacts";
import { getPilotage } from "@/lib/api/reference";
import { listSequences } from "@/lib/api/sequences";
import { FOLLOW_UP_LABELS } from "@/lib/domain/follow-up";
import { defineTool } from "./types";

/**
 * Outils de lecture ouverts au conseil après les jalons 3 à 6.
 *
 * Les outils du jalon 2 (`reads.ts`) ne connaissaient que les affaires, les
 * sociétés et les tâches : le CRM s'est enrichi de quatre jalons sans que les
 * agents en voient rien. Sacha ne pouvait pas répondre à « qu'est-ce que je fais
 * aujourd'hui ? » alors que l'application sait exactement le dire.
 *
 * **Ces outils appellent les mêmes couches de service que les écrans** —
 * `listContacts`, `readAlerts`, `readClients`, `listActivities`, `listSequences`.
 * Aucune règle n'est réécrite ici : un agent et un écran qui regardent le même
 * contact disent forcément la même chose, puisqu'ils lisent le même code.
 */

function frenchDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

/**
 * « Qui dois-je relancer ? » — la question centrale de Sacha.
 *
 * Renvoie exactement ce que la puce « À relancer » de /contacts affiche : tout
 * contact portant une relance programmée, en retard, du jour ou à venir, trié
 * par échéance croissante.
 */
export const listReminders = defineTool({
  name: "list_reminders",
  description:
    "Contacts à relancer : tous ceux qui portent une relance programmée, en retard, aujourd'hui ou à venir, triés par échéance croissante. C'est la liste d'appels de la journée. Utiliser pour « qui dois-je relancer », « qu'est-ce que je fais aujourd'hui ».",
  mode: "read",
  schema: z.object({
    limit: z.number().int().min(1).max(100).default(25),
    seulementEnRetard: z
      .boolean()
      .default(false)
      .describe("Ne garder que les échéances dépassées ou du jour"),
  }),
  run: async (input) => {
    const now = new Date();
    const settings = await getPilotage();
    const contacts = await listContacts({ followUp: "reminder" }, settings, now);

    const rows = contacts.filter(
      (contact) => !input.seulementEnRetard || contact.followUp === "due",
    );

    if (rows.length === 0) {
      return {
        vide: true,
        message: input.seulementEnRetard
          ? "Aucune relance en retard ni due aujourd'hui."
          : "Aucun contact ne porte de relance programmée. Renseigner « Prochaine relance » sur une fiche, ou consigner une interaction avec une prochaine action.",
      };
    }

    return {
      total: rows.length,
      enRetardOuAujourdhui: rows.filter((contact) => contact.followUp === "due").length,
      contacts: rows.slice(0, input.limit).map((contact) => ({
        id: contact.id,
        nom: `${contact.firstName} ${contact.lastName}`,
        société: contact.company?.name ?? null,
        cycleDeVie: contact.lifecycle,
        statut: FOLLOW_UP_LABELS[contact.followUp],
        prochaineRelance: frenchDate(contact.nextReminder),
        dernierContact: frenchDate(contact.lastContact),
        joursDepuisDernierContact: contact.idleDays,
        propriétaire: contact.owner,
      })),
    };
  },
});

/** Contacts sans nouvelles, ou jamais contactés — « qui ai-je oublié ? ». */
export const listNeglectedContacts = defineTool({
  name: "list_neglected_contacts",
  description:
    "Contacts oubliés : « sans nouvelles » (dernier contact au-delà du seuil froid des réglages, sans relance programmée) ou « jamais contacté » (aucune interaction). Utiliser pour « qui ai-je oublié », « qui n'ai-je pas relancé ».",
  mode: "read",
  schema: z.object({
    // Clé en ASCII : l'API contraint les clés de `properties` au motif
    // `^[a-zA-Z0-9_.-]{1,64}$`. Le sens français vit dans `describe()`, qui
    // n'a pas cette contrainte — c'est le texte que le modèle lit de toute
    // façon, l'identifiant ne lui apprend rien.
    category: z
      .enum(["silent", "never"])
      .describe(
        "Catégorie de contacts oubliés : silent = sans nouvelles, never = jamais contacté.",
      ),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  run: async (input) => {
    const now = new Date();
    const settings = await getPilotage();
    const contacts = await listContacts({ followUp: input.category }, settings, now);

    if (contacts.length === 0) {
      return {
        vide: true,
        message:
          input.category === "silent"
            ? `Aucun contact sans nouvelles : tous ont été touchés il y a moins de ${settings.coldDays} jours, ou portent une relance programmée.`
            : "Aucun contact « jamais contacté » : tous ont au moins une interaction ou une date de dernier contact.",
      };
    }

    return {
      total: contacts.length,
      seuilFroidJours: settings.coldDays,
      contacts: contacts.slice(0, input.limit).map((contact) => ({
        id: contact.id,
        nom: `${contact.firstName} ${contact.lastName}`,
        société: contact.company?.name ?? null,
        cycleDeVie: contact.lifecycle,
        statut: FOLLOW_UP_LABELS[contact.followUp],
        dernierContact: frenchDate(contact.lastContact),
        joursDepuisDernierContact: contact.idleDays,
        propriétaire: contact.owner,
      })),
    };
  },
});

/** Le moteur d'alertes, tel que l'accueil l'affiche. */
export const listAlerts = defineTool({
  name: "list_alerts",
  description:
    "Alertes du CRM, triées par urgence : tâches en retard, affaires froides ou silencieuses, dates de clôture dépassées, rappels de contact dus, check-in post-vente. Exactement la liste « À traiter maintenant » de l'accueil.",
  mode: "read",
  schema: z.object({ limit: z.number().int().min(1).max(50).default(15) }),
  run: async (input) => {
    const alerts = await readAlerts(new Date());

    if (alerts.length === 0) {
      return {
        vide: true,
        message:
          "Rien à traiter : aucune tâche en retard, aucune affaire silencieuse, aucun rappel dû.",
      };
    }

    return {
      total: alerts.length,
      alertes: alerts.slice(0, input.limit).map((alert) => ({
        urgence: alert.level === "hi" ? "haute" : alert.level === "md" ? "moyenne" : "basse",
        titre: alert.title,
        détail: alert.detail,
        type: alert.targetType,
        cibleId: alert.targetId,
      })),
    };
  },
});

/** Chronologie des interactions d'une fiche. */
export const getTimeline = defineTool({
  name: "get_timeline",
  description:
    "Historique des interactions (appels, emails, réunions, démos, notes) d'un contact, d'une société ou d'une affaire, du plus récent au plus ancien. Utiliser avant de préparer un appel, pour savoir ce qui s'est déjà dit.",
  mode: "read",
  schema: z
    .object({
      contactId: z.string().optional(),
      companyId: z.string().optional(),
      dealId: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(15),
    })
    .refine(
      (value) =>
        [value.contactId, value.companyId, value.dealId].filter(
          (id) => typeof id === "string" && id !== "",
        ).length === 1,
      { message: "Fournir exactement un identifiant : contactId, companyId ou dealId" },
    ),
  run: async (input) => {
    // Une société agrège ses affaires et ses contacts, comme dans son tiroir.
    const activities =
      input.companyId !== undefined
        ? await listCompanyTimeline(input.companyId)
        : await listActivities({
            ...(input.contactId === undefined ? {} : { contactId: input.contactId }),
            ...(input.dealId === undefined ? {} : { dealId: input.dealId }),
            limit: input.limit,
          });

    if (activities.length === 0) {
      return { vide: true, message: "Aucune interaction consignée sur cette fiche." };
    }

    return {
      total: activities.length,
      interactions: activities.slice(0, input.limit).map((activity) => ({
        date: frenchDate(activity.date),
        type: activity.type,
        durééMinutes: activity.duration,
        propriétaire: activity.owner,
        notes: activity.notes,
        surAffaire: activity.deal?.name ?? null,
        surContact:
          activity.contact === null
            ? null
            : `${activity.contact.firstName} ${activity.contact.lastName}`,
      })),
    };
  },
});

/** Séquences disponibles, pour pouvoir en proposer une. */
export const listSequencesTool = defineTool({
  name: "list_sequences",
  description:
    "Séquences de relance configurées, avec leurs étapes (jour, canal, intitulé) et leur déclencheur. À lire avant de proposer d'en lancer une sur un contact ou une affaire.",
  mode: "read",
  schema: z.object({}),
  run: async () => {
    const sequences = await listSequences();

    if (sequences.length === 0) {
      return {
        vide: true,
        message: "Aucune séquence configurée. Elles se créent dans Réglages.",
      };
    }

    return {
      séquences: sequences.map((sequence) => ({
        id: sequence.id,
        nom: sequence.name,
        déclencheur: sequence.trigger,
        active: sequence.active,
        étapes: sequence.steps.map((step) => ({
          jour: step.day,
          canal: step.channel,
          intitulé: step.label,
        })),
      })),
    };
  },
});

/** Portefeuille clients : qui paie, combien, à quand remonte la dernière conversation. */
export const listClients = defineTool({
  name: "list_clients",
  description:
    "Portefeuille clients : contacts au cycle de vie « Client », avec chiffre d'affaires signé, pipeline ouvert, date de signature, ancienneté de la dernière interaction et statut de relance. Trié par CA décroissant.",
  mode: "read",
  schema: z.object({ limit: z.number().int().min(1).max(100).default(20) }),
  run: async (input) => {
    const now = new Date();
    const settings = await getPilotage();
    const portfolio = await readClients("revenue", settings, now);

    if (portfolio.clients.length === 0) {
      return {
        vide: true,
        message:
          "Aucun client : aucun contact n'a le cycle de vie « Client ». Une affaire gagnée propose de promouvoir son contact.",
      };
    }

    return {
      nombreDeClients: portfolio.clients.length,
      chiffreDAffairesCumulé: portfolio.totalRevenue,
      caMoyenParClient: portfolio.averageRevenue,
      clients: portfolio.clients.slice(0, input.limit).map((client) => ({
        id: client.id,
        nom: `${client.firstName} ${client.lastName}`,
        société: client.companyName,
        caSigné: client.wonValue,
        affairesGagnées: client.wonCount,
        pipelineOuvert: client.openValue,
        signéLe: frenchDate(client.signedAt),
        dernierContact: frenchDate(client.lastContact),
        joursDepuisDernierContact: client.idleDays,
        statut: FOLLOW_UP_LABELS[client.followUp],
      })),
    };
  },
});
