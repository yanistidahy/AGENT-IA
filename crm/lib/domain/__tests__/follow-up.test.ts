import { describe, expect, it } from "vitest";
import { addDays } from "../dates";
import {
  followUpRank,
  followUpStatus,
  idleDays,
  isFollowUpFilter,
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

describe("isFollowUpFilter", () => {
  it("n'accepte que les trois filtres proposés", () => {
    expect(isFollowUpFilter("due")).toBe(true);
    expect(isFollowUpFilter("silent")).toBe(true);
    expect(isFollowUpFilter("never")).toBe(true);
    expect(isFollowUpFilter("waiting")).toBe(false);
    expect(isFollowUpFilter("nimporte")).toBe(false);
  });
});
