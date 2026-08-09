import { describe, expect, it } from "vitest";
import { addDays } from "../dates";
import {
  emptyFilterMessage,
  followUpStatus,
  matchesContactFilter,
  needsAttention,
  type ContactFilter,
  type FollowUpLike,
} from "../follow-up";
import { DEFAULT_PILOTAGE, type PilotageSettings } from "../types";

/**
 * Cohérence entre surfaces.
 *
 * Six écrans parlent du même contact : la liste `/contacts` et ses puces,
 * `/api/contacts`, le tableau « dernière touche » de l'accueil, le bloc
 * « relances à venir », `/clients`, et les outils du conseil. Ils doivent tous
 * conclure la même chose.
 *
 * Le seul moyen durable d'y arriver n'est pas de tester chaque écran, c'est
 * qu'aucun d'eux ne recalcule la règle : tous appellent `followUpStatus()` et
 * `needsAttention()`. Ces tests fixent les propriétés dont dépend cette
 * mutualisation, et le cas précis qui divergeait avant qu'on l'unifie.
 */

const now = new Date("2026-08-08T10:00:00Z");
const settings = DEFAULT_PILOTAGE; // staleDays 7, coldDays 14

function contact(overrides: Partial<FollowUpLike> = {}): FollowUpLike {
  return { lastContact: null, nextReminder: null, activityCount: 0, ...overrides };
}

/**
 * Le cas qui divergeait réellement : silencieux depuis trente jours, mais avec
 * une relance déjà programmée. La colonne Statut le disait « Relance prévue »
 * pendant que la colonne « Dernière touche » le peignait en rouge, sur la même
 * ligne, parce que trois tableaux recalculaient `idle >= coldDays` de leur côté.
 */
describe("un contact silencieux mais dont la relance est programmée", () => {
  const planned = contact({
    lastContact: addDays(now, -30),
    nextReminder: addDays(now, 5),
    activityCount: 2,
  });

  it("a le statut « relance prévue »", () => {
    expect(followUpStatus(planned, settings, now)).toBe("planned");
  });

  it("ne réclame pas d'attention : aucune surface ne doit le peindre en rouge", () => {
    expect(needsAttention(followUpStatus(planned, settings, now))).toBe(false);
  });

  it("apparaît quand même dans la puce « à relancer », puisqu'une relance est prévue", () => {
    expect(matchesContactFilter(planned, "reminder", settings, now)).toBe(true);
  });

  it("n'est pas compté comme « sans nouvelles »", () => {
    expect(matchesContactFilter(planned, "silent", settings, now)).toBe(false);
  });
});

describe("needsAttention est la seule règle de couleur", () => {
  const cases: ReadonlyArray<[string, FollowUpLike, boolean]> = [
    ["relance dépassée", contact({ lastContact: addDays(now, -2), nextReminder: addDays(now, -1) }), true],
    ["relance du jour", contact({ lastContact: addDays(now, -2), nextReminder: now }), true],
    ["relance à venir", contact({ lastContact: addDays(now, -2), nextReminder: addDays(now, 3) }), false],
    ["silencieux sans relance", contact({ lastContact: addDays(now, -30) }), true],
    ["touché récemment", contact({ lastContact: addDays(now, -2) }), false],
    ["jamais contacté", contact(), false],
  ];

  for (const [label, state, expected] of cases) {
    it(`${label} → attention ${expected ? "oui" : "non"}`, () => {
      expect(needsAttention(followUpStatus(state, settings, now))).toBe(expected);
    });
  }
});

/**
 * Les seuils viennent des réglages, jamais d'une constante recopiée. Si une
 * surface figeait 14 jours, elle divergerait dès que l'utilisateur change la
 * valeur — c'est exactement le bug trouvé sur `/api/contacts` au jalon 6.
 */
describe("le seuil configuré gouverne toutes les surfaces", () => {
  const idle10 = contact({ lastContact: addDays(now, -10), activityCount: 1 });

  const withCold = (coldDays: number): PilotageSettings => ({ ...settings, coldDays });

  it("un même contact bascule avec le seuil, pas avec l'écran", () => {
    expect(followUpStatus(idle10, withCold(14), now)).toBe("waiting");
    expect(followUpStatus(idle10, withCold(7), now)).toBe("silent");
  });

  it("la couleur suit la même bascule", () => {
    expect(needsAttention(followUpStatus(idle10, withCold(14), now))).toBe(false);
    expect(needsAttention(followUpStatus(idle10, withCold(7), now))).toBe(true);
  });

  it("le filtre « sans nouvelles » suit aussi", () => {
    expect(matchesContactFilter(idle10, "silent", withCold(14), now)).toBe(false);
    expect(matchesContactFilter(idle10, "silent", withCold(7), now)).toBe(true);
  });
});

/** Les trois filtres partitionnent sans se chevaucher sur un même contact. */
describe("les puces ne se contredisent pas entre elles", () => {
  const population: readonly FollowUpLike[] = [
    contact(),
    contact({ lastContact: addDays(now, -1), activityCount: 1 }),
    contact({ lastContact: addDays(now, -30), activityCount: 1 }),
    contact({ lastContact: addDays(now, -3), nextReminder: addDays(now, -2) }),
    contact({ lastContact: addDays(now, -3), nextReminder: addDays(now, 21) }),
  ];

  it("« sans nouvelles » et « jamais contacté » s'excluent", () => {
    for (const state of population) {
      const silent = matchesContactFilter(state, "silent", settings, now);
      const never = matchesContactFilter(state, "never", settings, now);
      expect(silent && never).toBe(false);
    }
  });

  it("un contact retenu par « à relancer » porte toujours une date", () => {
    for (const state of population) {
      if (matchesContactFilter(state, "reminder", settings, now)) {
        expect(state.nextReminder).not.toBeNull();
      }
    }
  });

  it("un contact « sans nouvelles » n'a jamais de relance programmée", () => {
    for (const state of population) {
      if (matchesContactFilter(state, "silent", settings, now)) {
        expect(state.nextReminder).toBeNull();
      }
    }
  });
});

describe("les états vides nomment la règle qui les a produits", () => {
  const filters: readonly ContactFilter[] = ["reminder", "silent", "never"];

  it("chaque filtre a son explication", () => {
    for (const filter of filters) {
      const message = emptyFilterMessage(filter, settings);
      expect(message.length, filter).toBeGreaterThan(60);
    }
  });

  it("celle de « sans nouvelles » cite le seuil configuré, pas une valeur figée", () => {
    expect(emptyFilterMessage("silent", { ...settings, coldDays: 21 })).toContain("21 jours");
    expect(emptyFilterMessage("silent", { ...settings, coldDays: 9 })).toContain("9 jours");
  });
});
