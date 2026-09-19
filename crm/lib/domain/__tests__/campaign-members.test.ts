import { describe, expect, it } from "vitest";
import {
  MEMBER_FILTERS,
  compareMembers,
  isHandRemoval,
  matchesMemberFilter,
  memberState,
  sortMembers,
  type CampaignMember,
} from "../campaign-members";

function member(over: Partial<CampaignMember>): CampaignMember {
  return {
    enrollmentId: over.enrollmentId ?? "e1",
    contactId: over.contactId ?? "c1",
    name: over.name ?? "Zoé Martin",
    company: over.company ?? "Alpha",
    role: over.role ?? "",
    step: over.step ?? 0,
    steps: over.steps ?? 3,
    lastSentAt: over.lastSentAt ?? null,
    written: over.written ?? false,
    openedAt: over.openedAt ?? null,
    repliedAt: over.repliedAt ?? null,
    state: over.state ?? "pending",
    stopReason: over.stopReason ?? "",
    handRemoved: over.handRemoved ?? false,
  };
}

const D = (iso: string) => new Date(iso);

describe("« A reçu un premier message » répond à la question la plus simple", () => {
  it("sélectionne tout ce qui a reçu, quoi qu'il se soit passé ensuite", () => {
    // C'est le point : les quatre puces d'état découpent les écrits en trois
    // et n'en rendent jamais la somme.
    const people = [
      member({ written: true, state: "waiting" }),
      member({ written: true, state: "replied" }),
      member({ written: true, state: "stopped" }),
      member({ written: false, state: "pending" }),
      member({ written: false, state: "stopped", handRemoved: true }),
    ];
    expect(people.filter((p) => matchesMemberFilter(p, "written"))).toHaveLength(3);
  });

  it("se lit dans les envois, jamais dans l'étape atteinte", () => {
    // Un inscrit dont l'étape a bougé sans qu'aucun message ne soit parti
    // existerait : le compter ferait diverger la puce de « Personnes écrites ».
    expect(matchesMemberFilter(member({ step: 2, written: false }), "written")).toBe(false);
  });

  it("arrive juste après « Tous »", () => {
    expect(MEMBER_FILTERS.map((entry) => entry.value).slice(0, 2)).toEqual(["all", "written"]);
  });
});

describe("l'état reste dérivé", () => {
  it("une réponse l'emporte sur une inscription arrêtée", () => {
    expect(memberState({ status: "stopped", lastSentAt: D("2026-01-01"), repliedAt: D("2026-01-02") })).toBe(
      "replied",
    );
  });

  it("un retrait à la main se reconnaît à sa raison", () => {
    expect(isHandRemoval("Retiré de la séquence à la main")).toBe(true);
    expect(isHandRemoval("Le contact a répondu")).toBe(false);
  });
});

describe("le tri répond aux questions, l'ordre d'insertion à aucune", () => {
  it("par dernier message, du plus récent au plus ancien", () => {
    const a = member({ enrollmentId: "a", lastSentAt: D("2026-01-01") });
    const b = member({ enrollmentId: "b", lastSentAt: D("2026-03-01") });
    expect(sortMembers([a, b], "lastSentAt", "desc").map((m) => m.enrollmentId)).toEqual(["b", "a"]);
  });

  it("une date absente reste en fin dans les deux sens", () => {
    const withDate = member({ enrollmentId: "a", lastSentAt: D("2026-01-01") });
    const none = member({ enrollmentId: "b", lastSentAt: null });
    for (const dir of ["asc", "desc"] as const) {
      expect(sortMembers([none, withDate], "lastSentAt", dir).map((m) => m.enrollmentId)).toEqual([
        "a",
        "b",
      ]);
    }
  });

  it("par état, dans l'ordre de la progression et non de l'alphabet", () => {
    const rows = [
      member({ enrollmentId: "stopped", state: "stopped" }),
      member({ enrollmentId: "replied", state: "replied" }),
      member({ enrollmentId: "pending", state: "pending" }),
      member({ enrollmentId: "waiting", state: "waiting" }),
    ];
    expect(sortMembers(rows, "state", "asc").map((m) => m.enrollmentId)).toEqual([
      "pending",
      "waiting",
      "replied",
      "stopped",
    ]);
  });

  it("par ouverture et par réponse", () => {
    const a = member({ enrollmentId: "a", openedAt: D("2026-02-01"), repliedAt: null });
    const b = member({ enrollmentId: "b", openedAt: D("2026-04-01"), repliedAt: D("2026-05-01") });
    expect(sortMembers([a, b], "opened", "desc")[0]?.enrollmentId).toBe("b");
    expect(sortMembers([a, b], "reply", "desc").map((m) => m.enrollmentId)).toEqual(["b", "a"]);
  });

  it("n'appelle pas localeCompare, qui suit la locale du conteneur", () => {
    // Jalon 72 : deux environnements rendraient deux ordres.
    const a = member({ name: "Ardent" });
    const b = member({ name: "Zoé" });
    expect(compareMembers(a, b, "name", "asc")).toBeLessThan(0);
    expect(compareMembers(a, b, "name", "desc")).toBeGreaterThan(0);
  });
});

describe("les retirés à la main ne se mêlent pas au reste", () => {
  it("passent en fin de tableau quel que soit le tri", () => {
    const removed = member({ enrollmentId: "r", handRemoved: true, lastSentAt: null });
    const active = member({ enrollmentId: "a", lastSentAt: D("2020-01-01") });
    for (const dir of ["asc", "desc"] as const) {
      expect(sortMembers([removed, active], "lastSentAt", dir).map((m) => m.enrollmentId)).toEqual([
        "a",
        "r",
      ]);
      expect(sortMembers([removed, active], "name", dir)[1]?.enrollmentId).toBe("r");
    }
  });
});
