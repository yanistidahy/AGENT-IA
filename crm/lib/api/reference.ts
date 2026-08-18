import { prisma } from "../db";
import { DEFAULT_REMINDER_DELAYS, type ReminderDelays } from "../domain/automation";
import { DEFAULT_PILOTAGE, type PilotageSettings, type StageLike } from "../domain/types";
import { DEFAULT_MODELS, isKnownModel, type Purpose } from "../domain/model-pricing";

/** Données de référence : étapes, réglages, listes éditables. */

export async function listStages(): Promise<StageLike[]> {
  const rows = await prisma.stage.findMany({ orderBy: { position: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    prob: row.prob,
    position: row.position,
    exitCriterion: row.exitCriterion,
  }));
}

/** Étape enrichie de son action de suivi — pour l'éditeur de /reglages. */
export interface StageWithAction extends StageLike {
  readonly nextActionLabel: string;
  readonly nextActionDays: number;
}

export async function listStagesWithActions(): Promise<StageWithAction[]> {
  const rows = await prisma.stage.findMany({ orderBy: { position: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    prob: row.prob,
    position: row.position,
    nextActionLabel: row.nextActionLabel,
    nextActionDays: row.nextActionDays,
  }));
}

/**
 * Délais de relance proposés après une interaction.
 *
 * Séparés de `getPilotage()` à dessein : ce sont des propositions de
 * formulaire, pas des seuils de pilotage. Les mélanger obligerait chaque
 * appelant de `PilotageSettings` — trois tables, les alertes, les agents — à
 * transporter cinq champs qui ne les concernent pas.
 */
export async function getReminderDelays(): Promise<ReminderDelays> {
  const row = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (row === null) return DEFAULT_REMINDER_DELAYS;
  return {
    call: row.relanceApresAppel,
    email: row.relanceApresEmail,
    demo: row.relanceApresDemo,
    meeting: row.relanceApresReunion,
    note: row.relanceApresNote,
  };
}

/** Seuils de pilotage. Retombe sur les valeurs du prototype si la ligne manque. */
export async function getPilotage(): Promise<PilotageSettings> {
  const row = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (row === null) return DEFAULT_PILOTAGE;
  return {
    staleDays: row.staleDays,
    coldDays: row.coldDays,
    objectifMensuel: row.objectifMensuel,
  };
}

/**
 * Le modèle retenu pour chaque usage.
 *
 * Une valeur inconnue — modèle retiré, réglage écrit à la main — retombe sur le
 * défaut plutôt que de partir à l'API : un identifiant invalide se traduirait
 * par un 400 à chaque appel, c'est-à-dire une panne totale de la fonction pour
 * une faute de frappe dans un réglage.
 */
export async function modelFor(purpose: Purpose): Promise<string> {
  const row = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const stored =
    row === null
      ? null
      : {
          draft: row.modelDraft,
          revision: row.modelRevision,
          chat: row.modelChat,
          shift: row.modelShift,
        }[purpose];

  return stored !== null && stored !== undefined && isKnownModel(stored)
    ? stored
    : DEFAULT_MODELS[purpose];
}

async function listOf(kind: string): Promise<string[]> {
  const rows = await prisma.settingsList.findMany({
    where: { kind },
    orderBy: { position: "asc" },
  });
  return rows.map((row) => row.value);
}

export function listOwners(): Promise<string[]> {
  return listOf("owners");
}

export function listOffers(): Promise<string[]> {
  return listOf("offers");
}

export function listSources(): Promise<string[]> {
  return listOf("sources");
}
