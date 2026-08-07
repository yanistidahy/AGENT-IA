import { prisma } from "./db";
import { type Diagnosis, diagnose } from "./db-diagnosis";

/** Sonde de santé de la base, utilisée par la page d'accueil de la phase 1. */

export interface Counts {
  readonly étapes: number;
  readonly sociétés: number;
  readonly contacts: number;
  readonly affaires: number;
  readonly interactions: number;
  readonly tâches: number;
  readonly séquences: number;
}

export type DbStatus =
  | { readonly ok: true; readonly counts: Counts; readonly total: number }
  | { readonly ok: false; readonly diagnosis: Diagnosis };

export async function readDbStatus(): Promise<DbStatus> {
  try {
    const [étapes, sociétés, contacts, affaires, interactions, tâches, séquences] =
      await Promise.all([
        prisma.stage.count(),
        prisma.company.count(),
        prisma.contact.count(),
        prisma.deal.count(),
        prisma.activity.count(),
        prisma.task.count(),
        prisma.sequence.count(),
      ]);

    const counts: Counts = {
      étapes,
      sociétés,
      contacts,
      affaires,
      interactions,
      tâches,
      séquences,
    };

    return {
      ok: true,
      counts,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    };
  } catch (error) {
    // On ne renvoie jamais le message brut : il contient l'hôte de la base et,
    // selon les cas, un extrait du code source appelant.
    return { ok: false, diagnosis: diagnose(error) };
  }
}
