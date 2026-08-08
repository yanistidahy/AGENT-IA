import { describe, expect, it } from "vitest";
import { addDays } from "../dates";
import {
  followUpRank,
  followUpStatus,
  idleDays,
  isContactFilter,
  matchesContactFilter,
  describeReminder,
  type FollowUpLike,
} from "../follow-up";
import { DEFAULT_PILOTAGE } from "../types";

const now = new Date("2026-08-08T10:00:00Z");
const settings = DEFAULT_PILOTAGE; // staleDays 7, coldDays 14

function contact(overrides: Partial<FollowUpLike> = {}): FollowUpLike {
  return { lastContact: null, nextReminder: null, activityCount: 0, ...overrides };
}

describe("followUpStatus", () => {
  it("« jamais contacté » sans interaction ni dernière touche", () => {
    expect(followUpStatus(contact(), settings, now)).toBe("never");
  });

  it("n'est plus « jamais contacté » dès qu'une interaction est consignée", () => {
    expect(followUpStatus(contact({ activityCount: 1 }), settings, now)).toBe("waiting");
  });

  it("« à relancer » quand la relance est datée d'aujourd'hui", () => {
    const state = contact({ lastContact: addDays(now, -3), nextReminder: now });
    expect(followUpStatus(state, settings, now)).toBe("due");
  });

  it("« à relancer » quand la relance est passée", () => {
    const state = contact({ lastContact: addDays(now, -3), nextReminder: addDays(now, -5) });
    expect(followUpStatus(state, settings, now)).toBe("due");
  });

  it("est due dès le matin, pas seulement passé l'heure exacte", () => {
    const morning = new Date("2026-08-08T08:00:00Z");
    const reminderLaterToday = new Date("2026-08-08T18:00:00Z");
    const state = contact({ lastContact: addDays(now, -3), nextReminder: reminderLaterToday });
    expect(followUpStatus(state, settings, morning)).toBe("due");
  });

  it("« relance prévue » quand elle est à venir", () => {
    const state = contact({ lastContact: addDays(now, -3), nextReminder: addDays(now, 4) });
    expect(followUpStatus(state, settings, now)).toBe("planned");
  });

  it("« en attente » quand on a contacté récemment sans programmer de relance", () => {
    expect(followUpStatus(contact({ lastContact: addDays(now, -3) }), settings, now)).toBe(
      "waiting",
    );
  });

  it("« sans nouvelles » au-delà de coldDays sans relance programmée", () => {
    expect(followUpStatus(contact({ lastContact: addDays(now, -20) }), settings, now)).toBe(
      "silent",
    );
  });

  it("bascule exactement à coldDays, pas un jour plus tard", () => {
    const atThreshold = contact({ lastContact: addDays(now, -settings.coldDays) });
    const justBefore = contact({ lastContact: addDays(now, -(settings.coldDays - 1)) });
    expect(followUpStatus(atThreshold, settings, now)).toBe("silent");
    expect(followUpStatus(justBefore, settings, now)).toBe("waiting");
  });

  /** Le seuil vient des réglages : le changer déplace la frontière. */
  it("suit le seuil configuré plutôt qu'une constante", () => {
    const state = contact({ lastContact: addDays(now, -10) });
    expect(followUpStatus(state, { ...settings, coldDays: 14 }, now)).toBe("waiting");
    expect(followUpStatus(state, { ...settings, coldDays: 5 }, now)).toBe("silent");
  });

  it("une relance programmée prime sur l'ancienneté du dernier contact", () => {
    const state = contact({ lastContact: addDays(now, -60), nextReminder: addDays(now, 3) });
    expect(followUpStatus(state, settings, now)).toBe("planned");
  });

  it("un contact jamais touché reste « jamais contacté » même avec une relance due", () => {
    // Écriture littérale de la règle demandée — voir le commentaire de la fonction.
    expect(followUpStatus(contact({ nextReminder: now }), settings, now)).toBe("never");
  });
});

describe("idleDays", () => {
  it("compte les jours depuis la dernière touche", () => {
    expect(idleDays(contact({ lastContact: addDays(now, -9) }), now)).toBe(9);
  });

  it("renvoie null quand il n'y a jamais eu de contact", () => {
    expect(idleDays(contact(), now)).toBeNull();
  });
});

describe("followUpRank", () => {
  it("classe du plus urgent au moins urgent", () => {
    const ordered = ["due", "silent", "never", "waiting", "planned"] as const;
    const ranks = ordered.map(followUpRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe("isContactFilter", () => {
  it("n'accepte que les trois filtres proposés", () => {
    expect(isContactFilter("reminder")).toBe(true);
    expect(isContactFilter("silent")).toBe(true);
    expect(isContactFilter("never")).toBe(true);
    expect(isContactFilter("due")).toBe(false);
    expect(isContactFilter("planned")).toBe(false);
  });
});

/**
 * Le point de cette série : la puce « À relancer » n'est **pas** le statut
 * « à relancer ». Elle retient toute relance programmée, y compris à venir.
 */
describe("matchesContactFilter", () => {
  const overdue = contact({ lastContact: addDays(now, -3), nextReminder: addDays(now, -5) });
  const dueToday = contact({ lastContact: addDays(now, -3), nextReminder: now });
  const future = contact({ lastContact: addDays(now, -3), nextReminder: addDays(now, 21) });
  const noReminder = contact({ lastContact: addDays(now, -3) });

  it("retient les relances en retard, du jour, et à venir", () => {
    for (const [label, state] of [
      ["en retard", overdue],
      ["aujourd'hui", dueToday],
      ["dans trois semaines", future],
    ] as const) {
      expect(matchesContactFilter(state, "reminder", settings, now), label).toBe(true);
    }
  });

  it("écarte un contact sans relance programmée", () => {
    expect(matchesContactFilter(noReminder, "reminder", settings, now)).toBe(false);
  });

  it("retient une relance à venir alors que son statut est « relance prévue »", () => {
    expect(followUpStatus(future, settings, now)).toBe("planned");
    expect(matchesContactFilter(future, "reminder", settings, now)).toBe(true);
  });

  it("« sans nouvelles » et « jamais contacté » restent alignés sur le statut", () => {
    const silent = contact({ lastContact: addDays(now, -30) });
    expect(matchesContactFilter(silent, "silent", settings, now)).toBe(true);
    expect(matchesContactFilter(silent, "never", settings, now)).toBe(false);
    expect(matchesContactFilter(contact(), "never", settings, now)).toBe(true);
  });
});

describe("describeReminder", () => {
  it("qualifie un retard et le compte", () => {
    const view = describeReminder(addDays(now, -4), now);
    expect(view.urgency).toBe("late");
    expect(view.days).toBe(4);
    expect(view.label).toBe("4 j de retard");
  });

  it("qualifie le jour même", () => {
    const view = describeReminder(now, now);
    expect(view.urgency).toBe("today");
    expect(view.label).toBe("aujourd'hui");
  });

  it("qualifie une échéance à venir et annonce le délai", () => {
    const view = describeReminder(addDays(now, 21), now);
    expect(view.urgency).toBe("future");
    expect(view.label).toBe("dans 21 j");
  });

  it("compare au jour, pas à l'heure", () => {
    const morning = new Date("2026-08-08T07:00:00Z");
    const laterToday = new Date("2026-08-08T20:00:00Z");
    expect(describeReminder(laterToday, morning).urgency).toBe("today");
  });
});
