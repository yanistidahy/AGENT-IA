import { describe, expect, it } from "vitest";
import {
  compareRecommendations,
  dedupeKey,
  effectiveStatus,
  isPublishable,
  isMuted,
  muteUntil,
  type Evidence,
  type RecommendationDraft,
} from "../recommendations";

const NOW = new Date("2026-08-08T09:00:00.000Z");

function draft(overrides: Partial<RecommendationDraft> = {}): RecommendationDraft {
  const evidence: Evidence[] = [{ type: "contact", id: "c1", label: "Nadia Berger" }];
  return {
    agentId: "sacha",
    severity: "attention",
    title: "Trois relances dépassées",
    rationale: "",
    evidence,
    actions: [],
    dedupeKey: "sacha:overdue:c1",
    ...overrides,
  };
}

describe("isPublishable", () => {
  it("refuse une recommandation sans preuve", () => {
    expect(isPublishable(draft({ evidence: [] }))).toBe(false);
  });

  it("refuse un titre vide ou une clé vide", () => {
    expect(isPublishable(draft({ title: "   " }))).toBe(false);
    expect(isPublishable(draft({ dedupeKey: "" }))).toBe(false);
  });

  it("accepte un constat prouvé, même sans action proposée", () => {
    expect(isPublishable(draft())).toBe(true);
  });
});

describe("dedupeKey", () => {
  it("ne dépend pas de l'ordre des identifiants cités", () => {
    expect(dedupeKey("sacha", "overdue", ["b", "a", "c"])).toBe(
      dedupeKey("sacha", "overdue", ["c", "a", "b"]),
    );
  });

  it("sépare deux agents et deux types de constat", () => {
    expect(dedupeKey("sacha", "overdue", ["a"])).not.toBe(dedupeKey("alfred", "overdue", ["a"]));
    expect(dedupeKey("sacha", "overdue", ["a"])).not.toBe(dedupeKey("sacha", "cold", ["a"]));
  });
});

describe("isMuted", () => {
  const base = { dedupeKey: "k", mutedUntil: null, snoozedUntil: null } as const;

  it("tait définitivement un constat accepté", () => {
    expect(isMuted({ ...base, status: "accepted" }, NOW)).toBe(true);
  });

  it("ne republie pas un constat déjà à l'écran", () => {
    expect(isMuted({ ...base, status: "new" }, NOW)).toBe(true);
  });

  it("respecte la fenêtre de rejet puis laisse revenir", () => {
    const until = muteUntil("Pas pertinent", NOW);
    expect(isMuted({ ...base, status: "dismissed", mutedUntil: until }, NOW)).toBe(true);
    const later = new Date(until.getTime() + 1000);
    expect(isMuted({ ...base, status: "dismissed", mutedUntil: until }, later)).toBe(false);
  });

  it("respecte la date de sommeil", () => {
    const until = new Date("2026-08-15T00:00:00.000Z");
    expect(isMuted({ ...base, status: "snoozed", snoozedUntil: until }, NOW)).toBe(true);
    expect(
      isMuted({ ...base, status: "snoozed", snoozedUntil: until }, new Date("2026-08-16T00:00:00.000Z")),
    ).toBe(false);
  });
});

describe("muteUntil", () => {
  it("donne une fenêtre plus courte à « Plus tard » qu'à « Pas pertinent »", () => {
    expect(muteUntil("Plus tard", NOW).getTime()).toBeLessThan(
      muteUntil("Déjà traité", NOW).getTime(),
    );
    expect(muteUntil("Déjà traité", NOW).getTime()).toBeLessThan(
      muteUntil("Pas pertinent", NOW).getTime(),
    );
  });
});

describe("compareRecommendations", () => {
  it("place l'urgence avant la récence", () => {
    const urgent = { severity: "urgent" as const, createdAt: new Date("2026-01-01") };
    const info = { severity: "info" as const, createdAt: new Date("2026-08-01") };
    expect([info, urgent].sort(compareRecommendations)[0]).toBe(urgent);
  });

  it("à sévérité égale, le plus récent d'abord", () => {
    const old = { severity: "info" as const, createdAt: new Date("2026-01-01") };
    const recent = { severity: "info" as const, createdAt: new Date("2026-08-01") };
    expect([old, recent].sort(compareRecommendations)[0]).toBe(recent);
  });
});

describe("effectiveStatus", () => {
  it("réveille un sommeil échu sans rien écrire", () => {
    expect(
      effectiveStatus({ status: "snoozed", snoozedUntil: new Date("2026-08-01") }, NOW),
    ).toBe("new");
  });

  it("laisse dormir un sommeil en cours", () => {
    expect(
      effectiveStatus({ status: "snoozed", snoozedUntil: new Date("2026-09-01") }, NOW),
    ).toBe("snoozed");
  });

  it("ne touche pas aux autres statuts", () => {
    expect(effectiveStatus({ status: "dismissed", snoozedUntil: null }, NOW)).toBe("dismissed");
  });
});
