import "server-only";
import { prisma } from "../db";
import { backupSchema, exportBackup, restoreBackup, type RestoreResult } from "./backup";
import { resolveStore, type SnapshotStore } from "./snapshot-store";
import {
  isStale,
  planRetention,
  snapshotKey,
  type SnapshotMeta,
} from "../domain/snapshots";

/**
 * Sauvegardes automatiques.
 *
 * Le format est **exactement** celui de l'export manuel : `exportBackup()`
 * produit, `backupSchema` valide, `restoreBackup()` remet en place. Un second
 * format aurait fini par diverger, et on ne s'en apercevrait qu'en essayant de
 * restaurer — c'est-à-dire le jour où l'on ne peut plus se le permettre.
 */

export interface SnapshotRunRecord {
  readonly id: string;
  readonly startedAt: Date;
  readonly outcome: string;
  readonly key: string;
  readonly bytes: number;
  readonly pruned: number;
  readonly detail: string;
  readonly durationMs: number | null;
  readonly manual: boolean;
}

export type TakeResult =
  | { readonly ok: true; readonly key: string; readonly bytes: number; readonly pruned: number }
  | { readonly ok: false; readonly message: string };

/**
 * Prend un instantané et applique la rétention.
 *
 * L'ordre compte : on **écrit d'abord**, on élague ensuite. L'inverse
 * laisserait une fenêtre où l'on a supprimé les anciennes sans avoir encore
 * réussi à écrire la nouvelle.
 *
 * Un échec d'élagage n'annule pas la sauvegarde : trop d'instantanés est un
 * désagrément, pas un incident, et perdre celui du jour pour cette raison
 * serait absurde.
 */
export async function takeSnapshot(
  options: { readonly manual?: boolean; readonly now?: Date } = {},
): Promise<TakeResult> {
  const now = options.now ?? new Date();
  const started = Date.now();

  const resolution = resolveStore();
  if (!resolution.ok) {
    await logRun({ outcome: "error", detail: resolution.message, manual: options.manual === true, durationMs: 0 });
    return { ok: false, message: resolution.message };
  }

  const store = resolution.store;
  const key = snapshotKey(now);

  try {
    const payload = await exportBackup();
    const contents = JSON.stringify(payload);
    await store.put(key, contents);

    let pruned = 0;
    try {
      pruned = await prune(store);
    } catch (error) {
      console.error("[sauvegarde] élagage", error);
    }

    const bytes = Buffer.byteLength(contents, "utf8");
    await logRun({
      outcome: "ok",
      key,
      bytes,
      pruned,
      manual: options.manual === true,
      durationMs: Date.now() - started,
    });
    return { ok: true, key, bytes, pruned };
  } catch (error) {
    const message =
      error instanceof Error
        ? `Sauvegarde impossible vers ${store.where} : ${error.message}`
        : "Sauvegarde impossible, cause inconnue.";
    console.error("[sauvegarde]", error);
    await logRun({
      outcome: "error",
      detail: message.slice(0, 300),
      manual: options.manual === true,
      durationMs: Date.now() - started,
    });
    return { ok: false, message };
  }
}

/** Applique la politique de rétention. Renvoie le nombre supprimé. */
async function prune(store: SnapshotStore): Promise<number> {
  const plan = planRetention(await store.list());
  for (const snapshot of plan.drop) await store.remove(snapshot.key);
  return plan.drop.length;
}

export interface SnapshotListing {
  readonly configured: boolean;
  readonly where: string;
  readonly durable: boolean;
  readonly snapshots: readonly SnapshotMeta[];
  /** Erreur de lecture du magasin, s'il y en a une. */
  readonly problem: string | null;
}

/** Les instantanés réellement présents, du plus récent au plus ancien. */
export async function listSnapshots(): Promise<SnapshotListing> {
  const resolution = resolveStore();
  if (!resolution.ok) {
    return { configured: false, where: "—", durable: false, snapshots: [], problem: resolution.message };
  }

  const store = resolution.store;
  try {
    const snapshots = [...(await store.list())].sort(
      (a, b) => b.takenAt.getTime() - a.takenAt.getTime(),
    );
    return { configured: true, where: store.where, durable: store.durable, snapshots, problem: null };
  } catch (error) {
    return {
      configured: true,
      where: store.where,
      durable: store.durable,
      snapshots: [],
      problem:
        error instanceof Error
          ? `Magasin injoignable : ${error.message}`
          : "Magasin injoignable.",
    };
  }
}

/**
 * Restaure un instantané.
 *
 * Passe par `backupSchema` puis `restoreBackup()` — le chemin transactionnel de
 * la restauration manuelle, refus sur fichier corrompu compris. Rien n'est
 * dupliqué ici, donc rien ne peut diverger.
 */
export async function restoreSnapshot(key: string): Promise<RestoreResult> {
  const resolution = resolveStore();
  if (!resolution.ok) return { ok: false, message: resolution.message };

  let raw: string | null;
  try {
    raw = await resolution.store.get(key);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `Lecture impossible : ${error.message}` : "Lecture impossible.",
    };
  }
  if (raw === null) return { ok: false, message: "Cet instantané n'existe plus dans le magasin." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Instantané illisible : ce n'est pas du JSON valide." };
  }

  const validated = backupSchema.safeParse(parsed);
  if (!validated.success) {
    return { ok: false, message: "Instantané non conforme au format de sauvegarde." };
  }

  return restoreBackup(validated.data);
}

async function logRun(input: {
  outcome: string;
  key?: string;
  bytes?: number;
  pruned?: number;
  detail?: string;
  manual: boolean;
  durationMs: number;
}): Promise<void> {
  try {
    await prisma.snapshotRun.create({
      data: {
        outcome: input.outcome,
        key: input.key ?? "",
        bytes: input.bytes ?? 0,
        pruned: input.pruned ?? 0,
        detail: input.detail ?? "",
        manual: input.manual,
        durationMs: input.durationMs,
      },
    });
  } catch (error) {
    // Le journal ne doit jamais faire échouer la sauvegarde elle-même.
    console.error("[sauvegarde] journal", error);
  }
}

/** Journal des sauvegardes, le plus récent d'abord. */
export async function listSnapshotRuns(limit = 20): Promise<SnapshotRunRecord[]> {
  return prisma.snapshotRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}

export interface SnapshotHealth {
  readonly lastSuccessAt: Date | null;
  readonly stale: boolean;
}

/**
 * État de santé, pour le bandeau d'accueil.
 *
 * Lit le journal local et non le magasin : la page d'accueil se rend à chaque
 * visite, et un aller-retour réseau y serait payé pour une information qui
 * change une fois par jour. Une base injoignable rend « périmé », ce qui est le
 * sens sûr du défaut.
 */
export async function snapshotHealth(now: Date = new Date()): Promise<SnapshotHealth> {
  try {
    const last = await prisma.snapshotRun.findFirst({
      where: { outcome: "ok" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });
    const lastSuccessAt = last?.startedAt ?? null;
    return { lastSuccessAt, stale: isStale(lastSuccessAt, now) };
  } catch {
    return { lastSuccessAt: null, stale: true };
  }
}
