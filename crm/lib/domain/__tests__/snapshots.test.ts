import { describe, expect, it } from "vitest";
import {
  dateFromKey,
  describeAge,
  formatBytes,
  isStale,
  KEEP_DAILY,
  KEEP_WEEKLY,
  planRetention,
  snapshotKey,
  STALE_AFTER_HOURS,
  type SnapshotMeta,
} from "../snapshots";

/**
 * La rétention est la règle qu'on découvre fausse au pire moment : un an plus
 * tard, quand il ne reste plus rien à restaurer. Elle se teste donc ici, sans
 * magasin ni base.
 */

/** Un instantané par jour, du plus ancien au plus récent. */
function daily(count: number, endingOn: Date): SnapshotMeta[] {
  return Array.from({ length: count }, (_, index) => {
    const takenAt = new Date(endingOn);
    takenAt.setDate(takenAt.getDate() - (count - 1 - index));
    return { key: snapshotKey(takenAt), takenAt, bytes: 1000 };
  });
}

describe("clé d'instantané", () => {
  it("porte la date, une par jour", () => {
    expect(snapshotKey(new Date(2026, 7, 9, 14, 30))).toBe("crm-2026-08-09.json");
    // Deux heures du même jour donnent la même clé : la sauvegarde du jour
    // s'écrase, elle ne s'empile pas.
    expect(snapshotKey(new Date(2026, 7, 9, 3))).toBe(snapshotKey(new Date(2026, 7, 9, 23)));
  });

  it("se relit sans perte", () => {
    const key = snapshotKey(new Date(2026, 0, 5));
    expect(dateFromKey(key)?.getFullYear()).toBe(2026);
    expect(dateFromKey(key)?.getMonth()).toBe(0);
    expect(dateFromKey(key)?.getDate()).toBe(5);
  });

  it("ignore ce qui n'est pas un instantané", () => {
    for (const name of ["README.md", "crm-2026-8-9.json", "crm.json", ""]) {
      expect(dateFromKey(name), name).toBeNull();
    }
  });
});

describe("rétention", () => {
  it("garde tout tant qu'on est sous le seuil quotidien", () => {
    const plan = planRetention(daily(10, new Date(2026, 7, 9)));
    expect(plan.keep).toHaveLength(10);
    expect(plan.drop).toHaveLength(0);
  });

  it("garde les 14 dernières quotidiennes", () => {
    const plan = planRetention(daily(30, new Date(2026, 7, 9)));
    const kept = plan.keep.map((s) => s.key);
    // Les 14 plus récentes y sont toutes.
    for (const snapshot of daily(30, new Date(2026, 7, 9)).slice(-KEEP_DAILY)) {
      expect(kept, snapshot.key).toContain(snapshot.key);
    }
  });

  it("garde en plus les 8 derniers lundis", () => {
    const plan = planRetention(daily(120, new Date(2026, 7, 9)));
    const mondays = plan.keep.filter((s) => s.takenAt.getDay() === 1);
    expect(mondays.length).toBeGreaterThanOrEqual(KEEP_WEEKLY);
    // Au-delà des 14 quotidiennes, ne survivent que des lundis.
    for (const snapshot of plan.keep.slice(KEEP_DAILY)) {
      expect(snapshot.takenAt.getDay(), snapshot.key).toBe(1);
    }
  });

  it("ne garde jamais plus que les deux fenêtres réunies", () => {
    const plan = planRetention(daily(365, new Date(2026, 7, 9)));
    expect(plan.keep.length).toBeLessThanOrEqual(KEEP_DAILY + KEEP_WEEKLY);
    expect(plan.keep.length + plan.drop.length).toBe(365);
  });

  /**
   * Le point délicat : **union**, pas intersection. Avec l'intersection, une
   * semaine sans sauvegarde quotidienne effacerait aussi l'hebdomadaire, et le
   * filet se refermerait exactement quand on en a besoin.
   */
  it("conserve un vieux lundi même s'il est hors de la fenêtre quotidienne", () => {
    const now = new Date(2026, 7, 9);
    const vieuxLundi = new Date(2026, 6, 6); // un lundi, plus de 14 jours avant
    expect(vieuxLundi.getDay()).toBe(1);

    const snapshots = [
      ...daily(14, now),
      { key: snapshotKey(vieuxLundi), takenAt: vieuxLundi, bytes: 900 },
    ];
    const plan = planRetention(snapshots);
    expect(plan.keep.map((s) => s.key)).toContain(snapshotKey(vieuxLundi));
    expect(plan.drop).toHaveLength(0);
  });

  it("ne compte pas deux fois une sauvegarde qui est à la fois du jour et un lundi", () => {
    const plan = planRetention(daily(20, new Date(2026, 7, 9)));
    expect(new Set(plan.keep.map((s) => s.key)).size).toBe(plan.keep.length);
  });

  it("ne supprime rien quand il n'y a rien", () => {
    expect(planRetention([]).drop).toHaveLength(0);
  });
});

describe("péremption", () => {
  const now = new Date(2026, 7, 9, 12);

  it("considère l'absence de sauvegarde comme périmée — le sens sûr du défaut", () => {
    expect(isStale(null, now)).toBe(true);
    expect(describeAge(null, now)).toContain("aucune sauvegarde");
  });

  it("tolère jusqu'à 48 h et alerte au-delà", () => {
    const recente = new Date(now.getTime() - 47 * 3_600_000);
    const vieille = new Date(now.getTime() - 49 * 3_600_000);
    expect(isStale(recente, now)).toBe(false);
    expect(isStale(vieille, now)).toBe(true);
    expect(STALE_AFTER_HOURS).toBe(48);
  });

  it("décrit l'ancienneté en français lisible", () => {
    expect(describeAge(new Date(now.getTime() - 30 * 60_000), now)).toContain("moins d'une heure");
    expect(describeAge(new Date(now.getTime() - 5 * 3_600_000), now)).toBe("il y a 5 h");
    expect(describeAge(new Date(now.getTime() - 72 * 3_600_000), now)).toBe("il y a 3 jours");
    expect(describeAge(new Date(now.getTime() - 25 * 3_600_000), now)).toBe("il y a 1 jour");
  });
});

describe("poids lisible", () => {
  it("choisit l'unité", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(2048)).toBe("2 Ko");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 Mo");
  });
});
