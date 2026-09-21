import { describe, expect, it } from "vitest";
import {
  daysUntilDue,
  describeExclusions,
  describeReopen,
  reopenable,
} from "../sequence-reopen";
import { BLOCK_LABELS } from "../sequence-rules";

describe("un seul motif rouvre", () => {
  it("la séquence épuisée, oui", () => {
    expect(reopenable("done", BLOCK_LABELS.finished)).toBe(true);
  });

  it("tous les autres, non — et ce sont eux qui protègent la personne", () => {
    // Ces quatre motifs sont des décisions *sur la personne* : les traiter
    // comme une fin technique écrirait à quelqu'un qui a dit non.
    expect(reopenable("stopped", BLOCK_LABELS.replied)).toBe(false);
    expect(reopenable("stopped", BLOCK_LABELS.terminal)).toBe(false);
    expect(reopenable("stopped", BLOCK_LABELS.optout)).toBe(false);
    expect(reopenable("removed", "Retiré de la séquence à la main")).toBe(false);
  });

  it("le statut seul ne suffit pas", () => {
    // Redondance voulue : le jour où un autre chemin écrirait `done`, il ne
    // rouvrirait pas des relances par accident.
    expect(reopenable("done", "Autre chose")).toBe(false);
  });

  it("une inscription active n'est pas à rouvrir", () => {
    expect(reopenable("active", "")).toBe(false);
  });
});

describe("le délai court depuis le dernier message", () => {
  const now = new Date("2026-09-21T09:00:00Z");

  it("servi il y a dix jours, étape à J+4 : dû tout de suite", () => {
    expect(daysUntilDue(new Date("2026-09-11T09:00:00Z"), 4, now)).toBe(0);
  });

  it("servi hier, étape à J+4 : dans trois jours", () => {
    expect(daysUntilDue(new Date("2026-09-20T09:00:00Z"), 4, now)).toBe(3);
  });

  it("jamais servi : dû tout de suite", () => {
    expect(daysUntilDue(null, 7, now)).toBe(0);
  });

  it("pile à l'échéance : dû, pas « dans 0 jour »", () => {
    expect(daysUntilDue(new Date("2026-09-17T09:00:00Z"), 4, now)).toBe(0);
  });
});

describe("la phrase de confirmation", () => {
  const plan = (candidates: Array<{ inDays: number }>) => ({
    step: 2,
    candidates: candidates.map((entry, index) => ({
      enrollmentId: `e${index}`,
      name: `P${index}`,
      inDays: entry.inDays,
    })),
    excluded: [],
  });

  it("sépare ce qui part maintenant de ce qui part plus tard", () => {
    const phrase = describeReopen(
      plan([
        ...Array.from({ length: 49 }, () => ({ inDays: 0 })),
        ...Array.from({ length: 3 }, () => ({ inDays: 2 })),
      ]),
    );
    expect(phrase).toBe(
      "52 personnes ont terminé cette campagne. Elles recevront l'étape 2 : 49 immédiatement, 3 dans 2 jours.",
    );
  });

  it("groupe les retardataires par échéance", () => {
    expect(describeReopen(plan([{ inDays: 2 }, { inDays: 2 }, { inDays: 3 }]))).toContain(
      "2 dans 2 jours, 1 dans 3 jours",
    );
  });

  it("dit franchement quand il n'y a personne", () => {
    expect(describeReopen(plan([]))).toMatch(/aucune inscription/);
  });

  it("nomme les exclus, pour qu'on voie la garde fonctionner", () => {
    expect(
      describeExclusions([{ name: "Margaux Keller", reason: BLOCK_LABELS.replied }]),
    ).toBe("1 inscription reste arrêtée : Margaux Keller (le contact a répondu).");
  });

  it("ne déverse pas cinquante noms", () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      name: `P${index}`,
      reason: BLOCK_LABELS.terminal,
    }));
    expect(describeExclusions(many)).toContain("et 4 autre(s)");
  });

  it("se tait quand il n'y a rien à exclure", () => {
    expect(describeExclusions([])).toBe("");
  });
});
