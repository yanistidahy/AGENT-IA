import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTO_SEND,
  JITTER_RATIO,
  MIN_INTERVAL_SECONDS,
  describePlan,
  estimatedEnd,
  insideWindow,
  isParisWeekend,
  jitteredGap,
  lateBy,
  nextSlot,
  parisHour,
  pushIntoWindow,
  validateSettings,
  windowLabel,
  type AutoSendPlan,
  type AutoSendSettings,
} from "../auto-send";

/**
 * **La fenêtre, la gigue et le retard se testent sans base et sans attendre.**
 *
 * Les instants sont écrits en UTC et jugés à Paris : c'est exactement l'écart
 * qui rendait `getDay()` faux sur un serveur en UTC, et l'écrire en heure locale
 * masquerait le défaut que ce module existe pour éviter.
 */

const S: AutoSendSettings = { ...DEFAULT_AUTO_SEND, enabled: true };

/** Un mardi, 10 h 00 à Paris (été : UTC+2). */
const TUE = new Date("2026-09-29T08:00:00.000Z");
/** Un samedi, 10 h 00 à Paris. */
const SAT = new Date("2026-10-03T08:00:00.000Z");

describe("l'heure de Paris, pas celle du serveur", () => {
  it("reconnaît le week-end à Paris", () => {
    expect(isParisWeekend(SAT)).toBe(true);
    expect(isParisWeekend(TUE)).toBe(false);
  });

  it("un dimanche 23 h 30 UTC est déjà lundi à Paris", () => {
    // Le serveur tourne en UTC : `getDay()` y dirait dimanche, donc refuserait
    // d'envoyer un lundi matin de la vraie journée de l'utilisateur.
    expect(isParisWeekend(new Date("2026-10-04T23:30:00.000Z"))).toBe(false);
  });

  it("la fenêtre exige le jour ouvré et l'heure", () => {
    expect(insideWindow(TUE, S)).toBe(true);
    expect(insideWindow(SAT, S)).toBe(false);
    // 07 h 00 UTC un mardi de septembre = 09 h 00 à Paris : la borne basse est incluse.
    expect(insideWindow(new Date("2026-09-29T07:00:00.000Z"), S)).toBe(true);
    // 15 h 00 UTC = 17 h 00 à Paris : la borne haute est exclue.
    expect(insideWindow(new Date("2026-09-29T15:00:00.000Z"), S)).toBe(false);
  });
});

describe("la gigue", () => {
  it("reste dans les bornes annoncées", () => {
    for (const random of [0, 0.25, 0.5, 0.75, 1]) {
      const gap = jitteredGap(S, random);
      expect(gap).toBeGreaterThanOrEqual(S.intervalSeconds * (1 - JITTER_RATIO) - 1);
      expect(gap).toBeLessThanOrEqual(S.intervalSeconds * (1 + JITTER_RATIO) + 1);
    }
  });

  it("ne descend jamais sous la minute, même sur un intervalle au plancher", () => {
    const tight: AutoSendSettings = { ...S, intervalSeconds: MIN_INTERVAL_SECONDS };
    expect(jitteredGap(tight, 0)).toBe(MIN_INTERVAL_SECONDS);
  });

  it("coupée, l'écart est exactement l'intervalle", () => {
    expect(jitteredGap({ ...S, vary: false }, 0)).toBe(S.intervalSeconds);
  });
});

describe("le créneau avance, jamais ne recule", () => {
  it("un créneau tombé après la fermeture passe à la réouverture du jour ouvré suivant", () => {
    // Mercredi 18 h 10 à Paris : la fenêtre est fermée.
    const late = pushIntoWindow(new Date("2026-09-30T16:10:00.000Z"), S);
    expect(parisHour(late)).toBe("09 h 00");
    expect(late.getUTCDate()).toBe(1); // jeudi 1er octobre
    expect(late.getTime()).toBeGreaterThan(Date.parse("2026-09-30T16:10:00.000Z"));
  });

  it("un vendredi soir enjambe le week-end", () => {
    const monday = pushIntoWindow(new Date("2026-10-02T16:00:00.000Z"), S);
    expect(isParisWeekend(monday)).toBe(false);
    expect(monday.getUTCDate()).toBe(5);
  });

  it("un créneau avant l'ouverture attend l'ouverture du jour même", () => {
    const opened = pushIntoWindow(new Date("2026-09-29T05:00:00.000Z"), S);
    expect(parisHour(opened)).toBe("09 h 00");
    expect(opened.getUTCDate()).toBe(29);
  });

  it("dans la fenêtre, le créneau ne bouge pas", () => {
    expect(pushIntoWindow(TUE, S).getTime()).toBe(TUE.getTime());
  });

  it("le créneau suivant est postérieur et dans la fenêtre", () => {
    const slot = nextSlot(TUE, S, 0.5);
    expect(slot.getTime()).toBeGreaterThan(TUE.getTime());
    expect(insideWindow(slot, S)).toBe(true);
  });
});

describe("le retard", () => {
  it("n'est signalé qu'au-delà de deux fois l'intervalle", () => {
    const due = new Date(TUE.getTime() - S.intervalSeconds * 1000);
    expect(lateBy(TUE, due, S)).toBe(0);
    const old = new Date(TUE.getTime() - S.intervalSeconds * 2100);
    expect(lateBy(TUE, old, S)).toBeGreaterThan(0);
  });

  it("sans échéance, il n'y a pas de retard", () => {
    expect(lateBy(TUE, null, S)).toBe(0);
  });
});

describe("ce que le panneau dit", () => {
  const base: AutoSendPlan = {
    enabled: true,
    dueAt: new Date("2026-09-29T08:42:00.000Z"),
    remaining: 11,
    nextLabel: "Marie Dupont (Maison Lune)",
    lateSeconds: 0,
    stoppedReason: "",
  };

  it("actif : l'heure, le destinataire, le reste et la fin estimée", () => {
    const sentence = describePlan(base, S, TUE);
    expect(sentence).toContain("Envoi automatique actif");
    expect(sentence).toContain("10 h 42");
    expect(sentence).toContain("Marie Dupont (Maison Lune)");
    expect(sentence).toContain("11 restants");
    expect(sentence).toContain("fin estimée vers");
  });

  it("hors fenêtre : le jour et l'heure de reprise", () => {
    const sentence = describePlan({ ...base, dueAt: null }, S, SAT);
    expect(sentence).toContain("Reprendra lundi à 09 h 00");
  });

  it("en retard : il le dit platement plutôt que d'annoncer une heure dépassée", () => {
    const sentence = describePlan({ ...base, lateSeconds: 900 }, S, TUE);
    expect(sentence).toContain("en retard de 15 min");
  });

  it("arrêté : la cause passe devant tout le reste", () => {
    const sentence = describePlan(
      { ...base, stoppedReason: "mot de passe SMTP absent pour la boîte Yanis" },
      S,
      TUE,
    );
    expect(sentence).toBe(
      "Envoi automatique arrêté : mot de passe SMTP absent pour la boîte Yanis",
    );
  });

  it("éteint, et file vide, ont chacun leur phrase", () => {
    expect(describePlan({ ...base, enabled: false }, S, TUE)).toContain("éteint");
    expect(describePlan({ ...base, remaining: 0 }, S, TUE)).toContain("aucun départ en attente");
  });

  it("la fenêtre se lit", () => {
    expect(windowLabel(S)).toBe("9 h – 17 h");
  });
});

describe("la fin estimée", () => {
  it("compte l'intervalle nominal et enjambe les fermetures", () => {
    // 200 départs à 3 min 30 font plus de 11 heures : la fin tombe le lendemain.
    const end = estimatedEnd(TUE, 200, S);
    expect(end.getUTCDate()).toBeGreaterThan(29);
    expect(insideWindow(end, S)).toBe(true);
  });

  it("un seul départ finit à son propre créneau", () => {
    expect(estimatedEnd(TUE, 1, S).getTime()).toBe(TUE.getTime());
  });
});

describe("la validation refuse plutôt que de corriger en silence", () => {
  it("un intervalle sous la minute est refusé, pas relevé", () => {
    const verdict = validateSettings({ ...S, intervalSeconds: 10 });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.message).toContain("une minute");
  });

  it("une fenêtre inversée est refusée", () => {
    expect(validateSettings({ ...S, startMinute: 1020, endMinute: 540 }).ok).toBe(false);
  });

  it("des réglages valides passent tels quels", () => {
    const verdict = validateSettings(S);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.settings).toEqual(S);
  });
});
