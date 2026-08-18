import "server-only";
import { prisma } from "../db";

/**
 * Le planificateur tourne-t-il encore ?
 *
 * **C'est l'absence de passage qu'il faut rendre visible.** Le journal ne peut
 * montrer que les passages qui ont eu lieu : un cron qui cesse de se déclencher
 * ne laisse aucune trace, et l'écran reste exactement le même que la veille. Or
 * avec des séquences en cours, c'est le pire des états — on croit ses relances
 * parties alors que rien ne bouge.
 *
 * Le seuil est à 36 heures, pas 24 : le passage a lieu une fois par jour, et un
 * décalage d'une heure ou une exécution un peu tardive ne doivent pas allumer un
 * bandeau qu'on apprendrait à ignorer. Au-delà de 36 heures, en revanche, un
 * passage a bel et bien été manqué.
 */
export const STALE_HOURS = 36;

export interface SchedulerHealth {
  readonly lastRunAt: Date | null;
  readonly stale: boolean;
  /** Heures écoulées, `null` si aucun passage n'a jamais été enregistré. */
  readonly hours: number | null;
}

export function schedulerVerdict(lastRunAt: Date | null, now: Date): SchedulerHealth {
  if (lastRunAt === null) {
    // **Jamais exécuté est un état à signaler, pas un état neutre.** C'est
    // exactement la situation d'un déploiement où les secrets du workflow n'ont
    // pas été posés : tout a l'air normal et rien ne tourne.
    return { lastRunAt: null, stale: true, hours: null };
  }
  const hours = (now.getTime() - lastRunAt.getTime()) / 3_600_000;
  return { lastRunAt, stale: hours > STALE_HOURS, hours: Math.floor(hours) };
}

export async function schedulerHealth(now = new Date()): Promise<SchedulerHealth> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { lastCronAt: true },
  });
  return schedulerVerdict(row?.lastCronAt ?? null, now);
}
