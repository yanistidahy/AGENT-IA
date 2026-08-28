import { describe, expect, it } from "vitest";
import { MIN_GROUP, describeLift, dmLift, type DmLiftRow } from "../dm-lift";

const day = (iso: string) => new Date(`${iso}T09:00:00Z`);

function row(overrides: Partial<DmLiftRow> & { contactId: string }): DmLiftRow {
  return {
    firstEmailAt: day("2026-08-10"),
    dmBeforeAt: null,
    repliedAt: null,
    ...overrides,
  };
}

/** Cinq de chaque côté : le minimum au-delà duquel la lecture s'autorise. */
function population(withDmReplies: number, withoutDmReplies: number): DmLiftRow[] {
  const rows: DmLiftRow[] = [];
  for (let i = 0; i < MIN_GROUP; i += 1) {
    rows.push(
      row({
        contactId: `dm${i}`,
        dmBeforeAt: day("2026-08-01"),
        repliedAt: i < withDmReplies ? day("2026-08-12") : null,
      }),
    );
    rows.push(
      row({
        contactId: `plain${i}`,
        repliedAt: i < withoutDmReplies ? day("2026-08-12") : null,
      }),
    );
  }
  return rows;
}

describe("la comparaison DM / sans DM", () => {
  it("sépare les deux groupes et calcule leur taux", () => {
    const lift = dmLift(population(3, 1));
    expect(lift.withDm).toMatchObject({ people: 5, replies: 3 });
    expect(lift.withoutDm).toMatchObject({ people: 5, replies: 1 });
    expect(lift.withDm.rate.value).toBeCloseTo(0.6);
    expect(lift.withoutDm.rate.value).toBeCloseTo(0.2);
    expect(lift.deltaPoints).toBe(40);
  });

  it("compte un écart négatif aussi honnêtement qu'un positif", () => {
    expect(dmLift(population(1, 4)).deltaPoints).toBe(-60);
  });

  it("**n'invente aucun taux** quand un groupe est vide", () => {
    const only = [row({ contactId: "a", dmBeforeAt: day("2026-08-01") })];
    const lift = dmLift(only);
    expect(lift.withoutDm.rate.value).toBeNull();
    expect(lift.deltaPoints).toBeNull();
  });

  it("ne compte rien du tout sur une période vide", () => {
    const lift = dmLift([]);
    expect(lift.total).toBe(0);
    expect(lift.withDm.rate.value).toBeNull();
    expect(lift.delayDays).toBeNull();
  });
});

describe("un DM postérieur à l'email n'est pas un DM préalable", () => {
  it("la ligne rejoint le groupe « sans DM »", () => {
    // C'est la borne qui donne son sens à la mesure : un DM envoyé après coup
    // n'a rien préparé, et le compter dirait l'inverse de ce qu'on mesure.
    // (Le service ne remonte que les DM antérieurs — ici on vérifie que le
    // domaine traite bien `null` comme « pas de DM préalable ».)
    const lift = dmLift([
      row({ contactId: "a", dmBeforeAt: null, repliedAt: day("2026-08-12") }),
    ]);
    expect(lift.withDm.people).toBe(0);
    expect(lift.withoutDm.people).toBe(1);
  });
});

describe("le délai entre le DM et la réponse", () => {
  it("est une médiane, pas une moyenne", () => {
    const rows = [
      row({ contactId: "a", dmBeforeAt: day("2026-08-01"), repliedAt: day("2026-08-03") }),
      row({ contactId: "b", dmBeforeAt: day("2026-08-01"), repliedAt: day("2026-08-05") }),
      // Une réponse très tardive : elle ne doit pas emporter la mesure.
      row({ contactId: "c", dmBeforeAt: day("2026-08-01"), repliedAt: day("2026-12-01") }),
    ];
    expect(dmLift(rows).delayDays).toBe(4);
  });

  it("ignore les lignes sans réponse", () => {
    const rows = [
      row({ contactId: "a", dmBeforeAt: day("2026-08-01"), repliedAt: day("2026-08-03") }),
      row({ contactId: "b", dmBeforeAt: day("2026-08-01") }),
    ];
    expect(dmLift(rows).delayDays).toBe(2);
  });
});

describe("la phrase de lecture refuse de conclure trop tôt", () => {
  it("le dit quand rien n'a été envoyé", () => {
    expect(describeLift(dmLift([]))).toContain("rien à comparer");
  });

  it("nomme le geste manquant quand aucun DM n'a été consigné", () => {
    const rows = [row({ contactId: "a" }), row({ contactId: "b" })];
    expect(describeLift(dmLift(rows))).toContain("type « Instagram »");
  });

  it("**refuse de conclure sur des groupes minuscules**", () => {
    const rows = [
      row({ contactId: "a", dmBeforeAt: day("2026-08-01"), repliedAt: day("2026-08-03") }),
      row({ contactId: "b" }),
    ];
    const message = describeLift(dmLift(rows));
    expect(message).toContain("Trop peu de monde pour conclure");
    expect(message).toContain(`${MIN_GROUP}`);
  });

  it("annonce l'écart **et** la réserve sur la sélection", () => {
    const message = describeLift(dmLift(population(4, 1)));
    expect(message).toContain("60 points de plus");
    expect(message).toMatch(/pas tirés au sort/);
  });

  it("dit « moins » quand le DM fait moins bien", () => {
    expect(describeLift(dmLift(population(1, 4)))).toContain("points de moins");
  });
});
