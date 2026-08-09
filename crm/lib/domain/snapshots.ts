import { startOfDay } from "./dates";

/**
 * Politique de sauvegarde — la part pure.
 *
 * Nommage, rétention et péremption se décident ici, sans stockage ni base :
 * la règle « garder 14 quotidiennes et 8 hebdomadaires » est exactement le
 * genre de calcul qu'on ne veut pas découvrir faux en production, un an après,
 * quand il ne reste plus rien à restaurer.
 */

/** Instantanés quotidiens conservés. Deux semaines pour revenir sur une erreur. */
export const KEEP_DAILY = 14;
/** Instantanés hebdomadaires conservés, au-delà des quotidiens. Deux mois. */
export const KEEP_WEEKLY = 8;

/**
 * Jour de la semaine promu « hebdomadaire ». 1 = lundi.
 *
 * Un jour fixe plutôt qu'« un tous les sept » : la promotion doit être
 * déterministe, sinon la même sauvegarde change de catégorie selon l'ordre
 * dans lequel on lit la liste.
 */
export const WEEKLY_DAY = 1;

/** Au-delà de ce délai sans sauvegarde réussie, on alerte. */
export const STALE_AFTER_HOURS = 48;

export interface SnapshotMeta {
  /** Clé de stockage, unique. Contient la date. */
  readonly key: string;
  readonly takenAt: Date;
  readonly bytes: number;
}

/** `crm-2026-08-09.json` — une par jour, l'écrasement d'un même jour est voulu. */
export function snapshotKey(now: Date): string {
  const day = startOfDay(now);
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  const dd = String(day.getDate()).padStart(2, "0");
  return `crm-${yyyy}-${mm}-${dd}.json`;
}

/** Date portée par la clé, ou `null` si elle n'en porte pas. */
export function dateFromKey(key: string): Date | null {
  const match = /^crm-(\d{4})-(\d{2})-(\d{2})\.json$/.exec(key);
  if (match === null) return null;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface RetentionPlan {
  readonly keep: readonly SnapshotMeta[];
  readonly drop: readonly SnapshotMeta[];
}

/**
 * Ce qu'on garde, ce qu'on supprime.
 *
 * Deux fenêtres qui se cumulent, et **l'union** est conservée : les 14 plus
 * récentes quelles qu'elles soient, plus les 8 dernières tombant un lundi. Une
 * sauvegarde qui appartient aux deux n'est comptée qu'une fois.
 *
 * Prendre l'union et non l'intersection est le point délicat : avec
 * l'intersection, une semaine sans sauvegarde quotidienne effacerait aussi
 * l'hebdomadaire, et le filet se refermerait au pire moment.
 */
export function planRetention(snapshots: readonly SnapshotMeta[]): RetentionPlan {
  const sorted = [...snapshots].sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());

  const keep = new Set<string>();
  for (const snapshot of sorted.slice(0, KEEP_DAILY)) keep.add(snapshot.key);

  let weekly = 0;
  for (const snapshot of sorted) {
    if (weekly >= KEEP_WEEKLY) break;
    if (snapshot.takenAt.getDay() === WEEKLY_DAY) {
      keep.add(snapshot.key);
      weekly += 1;
    }
  }

  return {
    keep: sorted.filter((snapshot) => keep.has(snapshot.key)),
    drop: sorted.filter((snapshot) => !keep.has(snapshot.key)),
  };
}

/**
 * La dernière sauvegarde réussie est-elle trop ancienne ?
 *
 * `null` — aucune sauvegarde connue — compte comme périmé : « jamais
 * sauvegardé » est l'état le plus alarmant, pas le plus neutre.
 */
export function isStale(lastSuccessAt: Date | null, now: Date): boolean {
  if (lastSuccessAt === null) return true;
  const hours = (now.getTime() - lastSuccessAt.getTime()) / 3_600_000;
  return hours > STALE_AFTER_HOURS;
}

/** « il y a 3 jours », pour le bandeau. */
export function describeAge(lastSuccessAt: Date | null, now: Date): string {
  if (lastSuccessAt === null) return "aucune sauvegarde enregistrée";
  const hours = Math.floor((now.getTime() - lastSuccessAt.getTime()) / 3_600_000);
  if (hours < 1) return "il y a moins d'une heure";
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} jour${days > 1 ? "s" : ""}`;
}

/** Poids lisible. Les instantanés se comptent en centaines de kilo-octets. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
