import { z } from "zod";
import { prisma } from "@/lib/db";
import { listDeals } from "@/lib/api/deals";
import { getPilotage, listStages } from "@/lib/api/reference";
import { lastMonthKeys, daysSince } from "@/lib/domain/dates";
import {
  averageWonDeal,
  conversionRate,
  cycle,
  forecast,
  funnel,
  lostDeals,
  retention,
  revenue,
  revenueByMonth,
  winRate,
  wonDeals,
} from "@/lib/domain/kpis";
import { FOLLOW_UP_LABELS, followUpStatus } from "@/lib/domain/follow-up";
import { dealHeat, pipelineValue, stuckDeals, weighted } from "@/lib/domain/pipeline";
import { LIFECYCLES } from "@/lib/domain/types";
import { defineTool } from "./types";

/**
 * Outils de lecture. Exécutés directement dans la boucle, sans confirmation.
 *
 * Chaque outil renvoie explicitement un marqueur quand la base est vide, pour
 * que l'agent puisse le dire au lieu d'inventer. Les libellés de sortie sont en
 * français : c'est ce que le modèle relit et reformule.
 */

const EMPTY = { vide: true, message: "Aucun enregistrement en base pour cette requête." };

export const searchContacts = defineTool({
  name: "search_contacts",
  description:
    "Recherche des contacts par nom, email, poste ou société. Utilisez-le dès qu'une personne est nommée dans la conversation et que vous avez besoin de sa fiche.",
  mode: "read",
  schema: z.object({
    query: z.string().describe("Nom, prénom, email ou société à rechercher"),
    lifecycle: z.enum(LIFECYCLES).optional().describe("Filtrer sur le cycle de vie"),
    owner: z.string().optional().describe("Filtrer sur le propriétaire"),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  run: async (input) => {
    const rows = await prisma.contact.findMany({
      where: {
        AND: [
          input.lifecycle === undefined ? {} : { lifecycle: input.lifecycle },
          input.owner === undefined ? {} : { owner: input.owner },
          {
            OR: [
              { firstName: { contains: input.query, mode: "insensitive" } },
              { lastName: { contains: input.query, mode: "insensitive" } },
              { email: { contains: input.query, mode: "insensitive" } },
              { title: { contains: input.query, mode: "insensitive" } },
              { company: { name: { contains: input.query, mode: "insensitive" } } },
            ],
          },
        ],
      },
      include: {
        company: { select: { name: true } },
        _count: { select: { activities: true } },
      },
      take: input.limit,
      orderBy: { lastContact: "desc" },
    });

    if (rows.length === 0) return EMPTY;

    // Le statut de relance vient de la même fonction que les écrans, avec les
    // seuils enregistrés : un agent et /contacts ne peuvent pas diverger.
    const [settings, now] = [await getPilotage(), new Date()];

    return rows.map((c) => {
      const status = followUpStatus(
        {
          lastContact: c.lastContact,
          nextReminder: c.nextReminder,
          activityCount: c._count.activities,
        },
        settings,
        now,
      );

      return {
        id: c.id,
        nom: `${c.firstName} ${c.lastName}`,
        poste: c.title,
        société: c.company?.name ?? null,
        cycleDeVie: c.lifecycle,
        source: c.source,
        propriétaire: c.owner,
        email: c.email,
        téléphone: c.phone,
        dernierContact: c.lastContact,
        prochaineRelance: c.nextReminder,
        statutDeRelance: FOLLOW_UP_LABELS[status],
        notes: c.notes,
      };
    });
  },
});

export const getCompany = defineTool({
  name: "get_company",
  description:
    "Fiche complète d'une société : activité, contacts rattachés, affaires en cours et signées. Recherche par nom si l'identifiant est inconnu.",
  mode: "read",
  schema: z.object({
    companyId: z.string().optional().describe("Identifiant exact, si connu"),
    name: z.string().optional().describe("Nom de la société, recherche partielle"),
  }),
  run: async (input) => {
    const company = await prisma.company.findFirst({
      where:
        input.companyId !== undefined
          ? { id: input.companyId }
          : { name: { contains: input.name ?? "", mode: "insensitive" } },
      include: {
        contacts: { select: { id: true, firstName: true, lastName: true, title: true, lifecycle: true } },
        deals: { select: { id: true, name: true, amount: true, status: true, stage: { select: { name: true } } } },
      },
    });

    if (company === null) return { vide: true, message: "Aucune société ne correspond." };

    return {
      id: company.id,
      nom: company.name,
      secteur: company.industry,
      taille: company.size,
      localisation: company.loc,
      activité: company.desc,
      contacts: company.contacts.map((c) => ({
        id: c.id,
        nom: `${c.firstName} ${c.lastName}`,
        poste: c.title,
        cycleDeVie: c.lifecycle,
      })),
      affaires: company.deals.map((d) => ({
        id: d.id,
        nom: d.name,
        montant: d.amount,
        statut: d.status,
        étape: d.stage.name,
      })),
    };
  },
});

export const listDealsTool = defineTool({
  name: "list_deals",
  description:
    "Liste les affaires du pipeline, filtrables par étape, propriétaire, statut, montant minimum et ancienneté. C'est l'outil de base pour toute question sur le pipeline.",
  mode: "read",
  schema: z.object({
    stageId: z.string().optional(),
    owner: z.string().optional(),
    status: z.enum(["open", "won", "lost", "all"]).default("open"),
    minAmount: z.number().int().min(0).optional().describe("Montant minimum en euros"),
    staleDays: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Ne garder que les affaires sans activité depuis au moins N jours"),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  run: async (input) => {
    const [deals, settings] = await Promise.all([
      listDeals({
        status: input.status,
        ...(input.stageId === undefined ? {} : { stageId: input.stageId }),
        ...(input.owner === undefined ? {} : { owner: input.owner }),
      }),
      getPilotage(),
    ]);

    const now = new Date();
    const filtered = deals
      .filter((d) => input.minAmount === undefined || d.amount >= input.minAmount)
      .filter(
        (d) =>
          input.staleDays === undefined ||
          daysSince(d.lastActivityAt ?? d.createdAt, now) >= input.staleDays,
      )
      .slice(0, input.limit);

    if (filtered.length === 0) return EMPTY;

    return filtered.map((d) => ({
      id: d.id,
      nom: d.name,
      société: d.company?.name ?? null,
      contact: d.contact === null ? null : `${d.contact.firstName} ${d.contact.lastName}`,
      montant: d.amount,
      étape: d.stage.name,
      étapeId: d.stageId,
      statut: d.status,
      propriétaire: d.owner,
      clôturePrévue: d.expectedClose,
      joursSansActivité: daysSince(d.lastActivityAt ?? d.createdAt, now),
      chaleur: dealHeat(d, settings, now),
    }));
  },
});

export const getDealDetail = defineTool({
  name: "get_deal_detail",
  description:
    "Détail d'une affaire avec son historique complet d'interactions et ses tâches ouvertes. À utiliser avant de conseiller une action sur une affaire précise.",
  mode: "read",
  schema: z.object({ dealId: z.string() }),
  run: async (input) => {
    const deal = await prisma.deal.findUnique({
      where: { id: input.dealId },
      include: {
        stage: true,
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true, title: true, email: true } },
        activities: { orderBy: { date: "desc" }, take: 20 },
        tasks: { where: { done: false }, orderBy: { due: "asc" } },
      },
    });

    if (deal === null) return { vide: true, message: "Affaire introuvable." };

    return {
      id: deal.id,
      nom: deal.name,
      montant: deal.amount,
      étape: deal.stage.name,
      étapeId: deal.stageId,
      probabilité: deal.prob ?? deal.stage.prob,
      statut: deal.status,
      propriétaire: deal.owner,
      offre: deal.offer,
      société: deal.company?.name ?? null,
      contact:
        deal.contact === null
          ? null
          : `${deal.contact.firstName} ${deal.contact.lastName} — ${deal.contact.title}`,
      clôturePrévue: deal.expectedClose,
      notes: deal.notes,
      historique: deal.activities.map((a) => ({
        type: a.type,
        date: a.date,
        par: a.owner,
        durée: a.duration,
        notes: a.notes,
      })),
      tâchesOuvertes: deal.tasks.map((t) => ({
        id: t.id,
        intitulé: t.title,
        échéance: t.due,
        priorité: t.priority,
        propriétaire: t.owner,
      })),
    };
  },
});

export const listTasks = defineTool({
  name: "list_tasks",
  description:
    "Liste les tâches, filtrables par propriétaire et par urgence (en retard, aujourd'hui, cette semaine, toutes les ouvertes).",
  mode: "read",
  schema: z.object({
    owner: z.string().optional(),
    scope: z.enum(["late", "today", "week", "open", "all"]).default("open"),
    limit: z.number().int().min(1).max(100).default(30),
  }),
  run: async (input) => {
    const rows = await prisma.task.findMany({
      where: {
        ...(input.owner === undefined ? {} : { owner: input.owner }),
        ...(input.scope === "all" ? {} : { done: false }),
      },
      include: {
        deal: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        company: { select: { name: true } },
      },
      orderBy: { due: "asc" },
      take: input.limit,
    });

    const now = new Date();
    const filtered = rows.filter((t) => {
      const elapsed = daysSince(t.due, now);
      if (input.scope === "late") return elapsed > 0;
      if (input.scope === "today") return elapsed === 0;
      if (input.scope === "week") return elapsed >= -7;
      return true;
    });

    if (filtered.length === 0) return EMPTY;

    return filtered.map((t) => ({
      id: t.id,
      intitulé: t.title,
      échéance: t.due,
      joursDeRetard: Math.max(0, daysSince(t.due, now)),
      priorité: t.priority,
      propriétaire: t.owner,
      terminée: t.done,
      rattachéeÀ:
        t.deal?.name ??
        (t.contact === null ? null : `${t.contact.firstName} ${t.contact.lastName}`) ??
        t.company?.name ??
        null,
    }));
  },
});

export const getKpis = defineTool({
  name: "get_kpis",
  description:
    "Indicateurs commerciaux sur une période : CA signé, taux de closing, cycle de vente, panier moyen, pipeline pondéré, entonnoir, prévisions, taux de qualification, rétention.",
  mode: "read",
  schema: z.object({
    periodDays: z
      .number()
      .int()
      .min(1)
      .max(3650)
      .default(90)
      .describe("Fenêtre en jours pour les affaires clôturées"),
  }),
  run: async (input) => {
    const now = new Date();
    const [deals, stages, contacts, settings] = await Promise.all([
      listDeals({ status: "all" }),
      listStages(),
      prisma.contact.findMany({
        select: { id: true, firstName: true, lastName: true, lifecycle: true, source: true, owner: true, createdAt: true, nextReminder: true },
      }),
      getPilotage(),
    ]);

    if (deals.length === 0 && contacts.length === 0) return EMPTY;

    const contactsTyped = contacts.map((c) => ({
      ...c,
      lifecycle: c.lifecycle as (typeof LIFECYCLES)[number],
    }));

    const won = wonDeals(deals, input.periodDays, now);
    const lost = lostDeals(deals, input.periodDays, now);
    const months = lastMonthKeys(now, 6);

    return {
      période: `${input.periodDays} derniers jours`,
      chiffreDAffairesSigné: revenue(won),
      affairesGagnées: won.length,
      affairesPerdues: lost.length,
      tauxDeClosing: winRate(won, lost),
      cycleDeVenteJours: cycle(won),
      panierMoyen: Math.round(averageWonDeal(won)),
      pipelineOuvert: pipelineValue(deals),
      pipelinePondéré: Math.round(weighted(deals, stages)),
      objectifMensuel: settings.objectifMensuel,
      tauxDeQualification: conversionRate(contactsTyped, input.periodDays, now),
      rétention: retention(contactsTyped),
      caParMois: revenueByMonth(deals, months),
      prévisionsPondérées: forecast(deals, stages, months),
      entonnoir: funnel(deals, stages).map((r) => ({
        étape: r.label,
        affaires: r.count,
        montant: r.amount,
        tauxDePassage: r.rate,
      })),
    };
  },
});

export const getStuckDeals = defineTool({
  name: "get_stuck_deals",
  description:
    "Affaires en cours qui stagnent : sans contact depuis plus que le seuil tiède ou froid des réglages. Triées par montant décroissant — les plus grosses d'abord.",
  mode: "read",
  schema: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
  run: async (input) => {
    const [deals, settings] = await Promise.all([listDeals({ status: "open" }), getPilotage()]);
    const now = new Date();
    const stuck = stuckDeals(deals, settings, now).slice(0, input.limit);

    if (stuck.length === 0) {
      return {
        vide: true,
        message: "Aucune affaire ne stagne : toutes ont été touchées récemment.",
      };
    }

    return {
      seuils: { tiède: settings.staleDays, froide: settings.coldDays },
      affaires: stuck.map((d) => ({
        id: d.id,
        nom: d.name,
        société: d.company?.name ?? null,
        montant: d.amount,
        étape: d.stage.name,
        propriétaire: d.owner,
        joursSansActivité: daysSince(d.lastActivityAt ?? d.createdAt, now),
        chaleur: dealHeat(d, settings, now),
      })),
    };
  },
});

export const READ_TOOLS = [
  searchContacts,
  getCompany,
  listDealsTool,
  getDealDetail,
  listTasks,
  getKpis,
  getStuckDeals,
] as const;
