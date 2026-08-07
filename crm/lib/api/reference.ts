import { prisma } from "../db";
import { DEFAULT_PILOTAGE, type PilotageSettings, type StageLike } from "../domain/types";

/** Données de référence : étapes, réglages, listes éditables. */

export async function listStages(): Promise<StageLike[]> {
  const rows = await prisma.stage.findMany({ orderBy: { position: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    prob: row.prob,
    position: row.position,
  }));
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
