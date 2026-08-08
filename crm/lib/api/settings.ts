import { z } from "zod";
import { prisma } from "../db";
import { SETTINGS_LIST_KINDS, type SettingsListKind } from "../domain/types";

/** Réglages : seuils de pilotage, listes éditables, étapes du pipeline. */

export const updateSettingsSchema = z
  .object({
    staleDays: z.number().int().min(1, "Au moins 1 jour").max(365).optional(),
    coldDays: z.number().int().min(1, "Au moins 1 jour").max(365).optional(),
    objectifMensuel: z.number().int().min(0, "L'objectif ne peut être négatif").optional(),
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
      if (stage.id !== undefined && kept.has(stage.id)) {
        await tx.stage.update({
          where: { id: stage.id },
          data: { name: stage.name, color: stage.color, prob: stage.prob, position },
        });
      } else {
        await tx.stage.create({
          data: { name: stage.name, color: stage.color, prob: stage.prob, position },
        });
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
