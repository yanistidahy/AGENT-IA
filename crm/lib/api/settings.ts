import { z } from "zod";
import { prisma } from "../db";
import { DEFAULT_REMINDER_DELAYS } from "../domain/automation";
import { SETTINGS_LIST_KINDS, type SettingsListKind } from "../domain/types";
import { MIN_OUTPUT_TOKENS } from "../domain/model-budget";
import { DEFAULT_MODELS, isKnownModel } from "../domain/model-pricing";

/** Réglages : seuils de pilotage, listes éditables, étapes du pipeline. */

/**
 * Délai de relance proposé après une interaction.
 *
 * `0` est accepté : il vaut « propose aujourd'hui », pas « désactivé ». Le
 * plafond de 365 est le même que celui des seuils — au-delà, la proposition
 * n'est plus une relance.
 */
const delayField = z.number().int().min(0, "Un délai ne peut être négatif").max(365).optional();

const modelField = z
  .string()
  .refine(isKnownModel, { message: "Modèle inconnu" })
  .optional();

export const updateSettingsSchema = z
  .object({
    staleDays: z.number().int().min(1, "Au moins 1 jour").max(365).optional(),
    coldDays: z.number().int().min(1, "Au moins 1 jour").max(365).optional(),
    objectifMensuel: z.number().int().min(0, "L'objectif ne peut être négatif").optional(),
    relanceApresAppel: delayField,
    relanceApresEmail: delayField,
    relanceApresDemo: delayField,
    relanceApresReunion: delayField,
    relanceApresLinkedin: delayField,
    relanceApresNote: delayField,
    /** Objectifs hebdomadaires de « Ma performance ». `0` = pas d'objectif. */
    objectifAppelsSemaine: z.number().int().min(0).max(1000).optional(),
    objectifEmailsSemaine: z.number().int().min(0).max(1000).optional(),
    /**
     * Plafond de jetons de sortie par vacation.
     *
     * Le minimum est le plancher de `shiftRequest()` : en dessous, la réflexion
     * consomme tout le plafond et la réponse arrive tronquée. Proposer un
     * réglage que le runtime relèverait en silence serait mentir à l'écran.
     */
    shiftTokenBudget: z.number().int().min(MIN_OUTPUT_TOKENS).max(32000).optional(),
    /**
     * Un modèle par usage.
     *
     * Validés contre la liste connue plutôt que laissés libres : un
     * identifiant inconnu ne serait pas un réglage exotique mais un 400 à
     * chaque appel, c'est-à-dire une panne totale de la fonction — et elle ne
     * se verrait qu'au moment d'écrire un email.
     */
    modelDraft: modelField,
    modelRevision: modelField,
    modelChat: modelField,
    modelShift: modelField,
    /**
     * Plafond mensuel en cents. `0` vaut « pas de plafond », pas « zéro
     * dollar » : sans cette convention, on ne pourrait plus le désactiver.
     */
    monthlyBudgetCents: z
      .number()
      .int()
      .min(0, "Un plafond ne peut être négatif")
      .max(1_000_000)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Aucun champ à mettre à jour" })
  .refine(
    (value) =>
      value.staleDays === undefined ||
      value.coldDays === undefined ||
      value.staleDays < value.coldDays,
    {
      message: "Le seuil « tiède » doit être inférieur au seuil « froid »",
    },
  );

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/**
 * Les deux seuils sont liés : `staleDays` doit rester strictement inférieur à
 * `coldDays`, sinon la zone « tiède » disparaît et `dealHeat()` ne renvoie plus
 * jamais « warm ». La vérification porte donc sur la valeur finale, pas
 * seulement sur la charge utile — modifier un seul des deux champs doit rester
 * possible sans casser l'invariant.
 */
export async function updateSettings(
  input: UpdateSettingsInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const current = await prisma.settings.findUnique({ where: { id: "singleton" } });

  const staleDays = input.staleDays ?? current?.staleDays ?? 7;
  const coldDays = input.coldDays ?? current?.coldDays ?? 14;
  if (staleDays >= coldDays) {
    return {
      ok: false,
      message: "Le seuil « tiède » doit rester inférieur au seuil « froid ».",
    };
  }

  const data = {
    staleDays,
    coldDays,
    objectifMensuel: input.objectifMensuel ?? current?.objectifMensuel ?? 15000,
    relanceApresAppel:
      input.relanceApresAppel ?? current?.relanceApresAppel ?? DEFAULT_REMINDER_DELAYS.call,
    relanceApresEmail:
      input.relanceApresEmail ?? current?.relanceApresEmail ?? DEFAULT_REMINDER_DELAYS.email,
    relanceApresDemo:
      input.relanceApresDemo ?? current?.relanceApresDemo ?? DEFAULT_REMINDER_DELAYS.demo,
    relanceApresReunion:
      input.relanceApresReunion ?? current?.relanceApresReunion ?? DEFAULT_REMINDER_DELAYS.meeting,
    relanceApresLinkedin:
      input.relanceApresLinkedin ?? current?.relanceApresLinkedin ?? DEFAULT_REMINDER_DELAYS.linkedin,
    relanceApresNote:
      input.relanceApresNote ?? current?.relanceApresNote ?? DEFAULT_REMINDER_DELAYS.note,
    objectifAppelsSemaine: input.objectifAppelsSemaine ?? current?.objectifAppelsSemaine ?? 0,
    objectifEmailsSemaine: input.objectifEmailsSemaine ?? current?.objectifEmailsSemaine ?? 0,
    shiftTokenBudget: input.shiftTokenBudget ?? current?.shiftTokenBudget ?? 4000,
    modelDraft: input.modelDraft ?? current?.modelDraft ?? DEFAULT_MODELS.draft,
    modelRevision: input.modelRevision ?? current?.modelRevision ?? DEFAULT_MODELS.revision,
    modelChat: input.modelChat ?? current?.modelChat ?? DEFAULT_MODELS.chat,
    modelShift: input.modelShift ?? current?.modelShift ?? DEFAULT_MODELS.shift,
    monthlyBudgetCents: input.monthlyBudgetCents ?? current?.monthlyBudgetCents ?? 2000,
  };

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  return { ok: true };
}

export const updateListSchema = z.object({
  kind: z.enum(SETTINGS_LIST_KINDS, { error: "Liste inconnue" }),
  /**
   * Les lignes vides sont acceptées ici et écartées par `updateList`. L'éditeur
   * envoie le contenu d'une zone de texte découpé sur les retours à la ligne :
   * refuser au niveau du schéma ferait échouer l'enregistrement entier à cause
   * d'une ligne vide en fin de saisie, ce que personne ne comprendrait.
   */
  values: z.array(z.string()),
});

/**
 * Remplacement d'une liste éditable en bloc, dans une transaction.
 *
 * Les doublons sont écartés (la table porte une contrainte d'unicité) et l'ordre
 * de saisie devient l'ordre d'affichage.
 */
export async function updateList(kind: SettingsListKind, values: string[]): Promise<void> {
  const unique = [...new Set(values.map((value) => value.trim()).filter((v) => v !== ""))];

  await prisma.$transaction([
    prisma.settingsList.deleteMany({ where: { kind } }),
    prisma.settingsList.createMany({
      data: unique.map((value, position) => ({ kind, value, position })),
    }),
  ]);
}

export const stageSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "Nommez l'étape"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB"),
  prob: z.number().int().min(0).max(100),
  /**
   * Action de suivi proposée à l'entrée dans l'étape. Vide = aucune proposition,
   * ce qui est le comportement voulu pour les étapes terminales.
   */
  nextActionLabel: z.string().trim().max(120).optional(),
  nextActionDays: z.number().int().min(0).max(365).optional(),
});

export const updateStagesSchema = z.object({
  stages: z.array(stageSchema).min(1, "Le pipeline doit garder au moins une étape"),
});

export type UpdateStagesInput = z.infer<typeof updateStagesSchema>;

export type UpdateStagesResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * Réécriture des étapes du pipeline.
 *
 * Supprimer une étape qui porte encore des affaires est refusé, en nommant
 * combien : le schéma n'a pas de `onDelete` sur `Deal.stage`, la suppression
 * échouerait donc sur une contrainte de clé étrangère avec un message Prisma
 * illisible. Mieux vaut l'expliquer avant.
 *
 * L'ordre du tableau devient `position`, ce qui définit l'ordre des colonnes du
 * Kanban.
 */
export async function updateStages(input: UpdateStagesInput): Promise<UpdateStagesResult> {
  const existing = await prisma.stage.findMany({
    select: { id: true, _count: { select: { deals: true } } },
  });

  const kept = new Set(
    input.stages.map((stage) => stage.id).filter((id): id is string => id !== undefined),
  );

  const blocked = existing.filter(
    (stage) => !kept.has(stage.id) && stage._count.deals > 0,
  );
  if (blocked.length > 0) {
    const total = blocked.reduce((sum, stage) => sum + stage._count.deals, 0);
    return {
      ok: false,
      message: `Impossible : ${blocked.length} étape(s) supprimée(s) portent encore ${total} affaire(s). Déplacez-les d'abord.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    // Les positions sont uniques : on les décale hors de portée avant de les
    // réattribuer, sinon un simple échange de deux étapes viole la contrainte.
    for (const [index, stage] of existing.entries()) {
      await tx.stage.update({ where: { id: stage.id }, data: { position: -1 - index } });
    }

    await tx.stage.deleteMany({ where: { id: { notIn: [...kept] } } });

    for (const [position, stage] of input.stages.entries()) {
      const data = {
        name: stage.name,
        color: stage.color,
        prob: stage.prob,
        position,
        nextActionLabel: stage.nextActionLabel ?? "",
        nextActionDays: stage.nextActionDays ?? 3,
      };

      if (stage.id !== undefined && kept.has(stage.id)) {
        await tx.stage.update({ where: { id: stage.id }, data });
      } else {
        await tx.stage.create({ data });
      }
    }
  });

  return { ok: true };
}

/** Nombre d'affaires par étape, pour prévenir avant une suppression. */
export async function stageDealCounts(): Promise<Record<string, number>> {
  const rows = await prisma.stage.findMany({
    select: { id: true, _count: { select: { deals: true } } },
  });
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.id] = row._count.deals;
  return counts;
}
