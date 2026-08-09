/**
 * Arithmétique de dates du CRM.
 *
 * Convention reprise du prototype : `daysBetween(from, to)` est positif quand
 * `to` est postérieur à `from`. Donc `daysSince(date, now) > 0` signifie « dans
 * le passé », ce qui est la définition d'une échéance dépassée.
 */

export const DAY_MS = 86_400_000;

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Nombre de jours écoulés depuis `date`. Négatif si `date` est dans le futur. */
export function daysSince(date: Date, now: Date): number {
  return daysBetween(date, now);
}

/** Clé de mois `AAAA-MM`, utilisée pour regrouper CA et prévisions. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Les `count` derniers mois, du plus ancien au plus récent, `now` inclus. */
export function lastMonthKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
