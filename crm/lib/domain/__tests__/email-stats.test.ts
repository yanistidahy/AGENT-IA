import { describe, expect, it } from "vitest";
import {
  byDay,
  bySignatory,
  byWeek,
  formatRate,
  OPEN_RATE_CAVEAT,
  OPEN_RATE_LABEL,
  rate,
  weekKey,
  weekStart,
} from "../email-stats";

/**
 * **Un fait et une estimation ne s'affichent pas pareil.**
 *
 * Les envois, les réponses et les rendez-vous sont des faits. Le taux
 * d'ouverture ne l'est pas : il est surestimé dans un sens connu, et le tester
 * revient surtout à tester qu'on ne peut pas l'afficher sans sa mise en garde.
 */

describe("les taux", () => {
  it("n'invente aucun taux sans dénominateur", () => {
    // Zéro pour cent affirme un échec d'ouverture ; sur zéro envoi suivi, il
    // n'y a rien à ouvrir. Même règle que l'entonnoir du jalon 20.
    expect(rate(0, 0).value).toBeNull();
    expect(formatRate(rate(0, 0))).toBe("—");
  });

  it("calcule et arrondit quand le dénominateur existe", () => {
    expect(rate(1, 4).value).toBe(0.25);
    expect(formatRate(rate(1, 4))).toBe("25 %");
    expect(formatRate(rate(0, 4))).toBe("0 %");
  });

  it("le libellé annonce l'estimation, et la mise en garde nomme les deux causes", () => {
    expect(OPEN_RATE_LABEL).toContain("estimation");
    expect(OPEN_RATE_CAVEAT).toContain("Apple Mail");
    expect(OPEN_RATE_CAVEAT).toContain("Gmail");
    expect(OPEN_RATE_CAVEAT).toContain("surestim");
  });
});

describe("les semaines", () => {
  it("commencent le lundi", () => {
    // Un mercredi, un dimanche et le lundi lui-même tombent dans la même semaine.
    const monday = new Date(2026, 7, 17);
    expect(weekStart(new Date(2026, 7, 19)).getTime()).toBe(monday.getTime());
    expect(weekStart(new Date(2026, 7, 23)).getTime()).toBe(monday.getTime());
    expect(weekStart(monday).getTime()).toBe(monday.getTime());
    expect(weekKey(new Date(2026, 7, 23))).toBe("2026-08-17");
  });

  it("un dimanche appartient à la semaine qui vient de finir, pas à la suivante", () => {
    expect(weekKey(new Date(2026, 7, 16))).toBe("2026-08-10");
  });
});

describe("le découpage", () => {
  const now = new Date(2026, 7, 18);

  it("garde les jours creux à zéro", () => {
    // Une courbe qui saute les jours sans envoi transforme une semaine sans
    // prospection en une ligne continue — un mensonge visuel.
    const buckets = byDay([new Date(2026, 7, 18), new Date(2026, 7, 18)], now, 5);
    expect(buckets).toHaveLength(5);
    expect(buckets.map((bucket) => bucket.count)).toEqual([0, 0, 0, 0, 2]);
    expect(buckets[4]?.label).toBe("18/08");
  });

  it("rend les semaines dans l'ordre chronologique, la courante en dernier", () => {
    const buckets = byWeek([new Date(2026, 7, 18), new Date(2026, 7, 11)], now, 3);
    expect(buckets.map((bucket) => bucket.count)).toEqual([0, 1, 1]);
  });

  it("ne perd aucun envoi quand le signataire manque", () => {
    // Le total des barres doit rester égal au total des envois : écarter les
    // envois antérieurs au sélecteur ferait un graphique qui ne s'additionne pas.
    const rows = [
      { signatoryName: "Yanis Tidahy" },
      { signatoryName: "" },
      { signatoryName: "Yanis Tidahy" },
      { signatoryName: "Mohamed Targani" },
    ];
    const buckets = bySignatory(rows);
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(rows.length);
    expect(buckets[0]).toMatchObject({ key: "Yanis Tidahy", count: 2 });
    expect(buckets.map((bucket) => bucket.key)).toContain("(non renseigné)");
  });
});
