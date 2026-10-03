import { describe, expect, it } from "vitest";
import { auditClicks, auditHot, clickVerdict, type ClickFact } from "../hot-clicks";

/**
 * L'audit des clics qui rendent un prospect « chaud ».
 *
 * **La règle n'est pas changée par ces tests** : `total` reste ce que le jalon 92
 * retient, clics douteux compris. Ce qui est vérifié, c'est que la décomposition
 * dit juste — c'est elle qui permettra de décider, plus tard, en connaissance de
 * cause.
 */

const SENT = new Date("2026-10-01T09:00:00Z");

function click(over: Partial<ClickFact> = {}): ClickFact {
  return {
    sendId: "s1",
    kind: "demo",
    at: new Date("2026-10-01T10:00:00Z"),
    sentAt: SENT,
    contactId: "c1",
    ...over,
  };
}

describe("le verdict d'un clic", () => {
  it("moins de deux minutes après l'envoi : une livraison, pas une lecture", () => {
    expect(clickVerdict(click({ at: new Date(SENT.getTime() + 5_000) }), 1)).toBe("livraison");
    expect(clickVerdict(click({ at: new Date(SENT.getTime() + 119_000) }), 1)).toBe("livraison");
  });

  it("au-delà du seuil, un clic seul est solide", () => {
    expect(clickVerdict(click({ at: new Date(SENT.getTime() + 121_000) }), 1)).toBe("solide");
  });

  it("deux liens dans la même seconde : un automate", () => {
    expect(clickVerdict(click({ at: new Date(SENT.getTime() + 3_600_000) }), 2)).toBe("simultane");
  });

  it("le délai l'emporte sur la simultanéité, parce qu'il est plus net", () => {
    // Un clic à cinq secondes est de la livraison, qu'il soit seul ou non : le
    // dire « simultané » rangerait deux faits différents sous un même mot.
    expect(clickVerdict(click({ at: new Date(SENT.getTime() + 5_000) }), 2)).toBe("livraison");
  });

  it("le seuil est injectable, pour pouvoir le remettre en question", () => {
    const fast = click({ at: new Date(SENT.getTime() + 60_000) });
    expect(clickVerdict(fast, 1, 120)).toBe("livraison");
    expect(clickVerdict(fast, 1, 30)).toBe("solide");
  });
});

describe("l'audit d'un jeu de clics", () => {
  it("compte chaque forme, et nomme les fiches qui n'ont que du suspect", () => {
    const hour = (h: number) => new Date(`2026-10-01T${String(h).padStart(2, "0")}:00:00Z`);
    const audit = auditClicks([
      // c1 : un clic de livraison, puis un vrai clic → solide.
      click({ contactId: "c1", at: new Date(SENT.getTime() + 2_000) }),
      click({ contactId: "c1", at: hour(14) }),
      // c2 : deux liens à la même seconde, et rien d'autre → suspect seulement.
      click({ contactId: "c2", sendId: "s2", kind: "demo", at: hour(15) }),
      click({ contactId: "c2", sendId: "s2", kind: "video", at: hour(15) }),
      // c3 : un seul clic, à la livraison → suspect seulement.
      click({ contactId: "c3", sendId: "s3", at: new Date(SENT.getTime() + 10_000) }),
    ]);

    expect(audit.clicks).toBe(5);
    expect(audit.delivery).toBe(2);
    expect(audit.simultaneous).toBe(2);
    expect(audit.solid).toBe(1);
    expect(audit.solidContacts).toEqual(["c1"]);
    expect([...audit.suspectOnlyContacts].sort()).toEqual(["c2", "c3"]);
  });

  it("la simultanéité se juge par envoi, pas par contact", () => {
    /*
      Deux messages différents peuvent légitimement être lus dans la même
      seconde par deux personnes de la même maison ; c'est le **même** message
      suivi deux fois qui trahit l'automate.
    */
    const at = new Date("2026-10-01T16:00:00Z");
    const audit = auditClicks([
      click({ sendId: "s1", kind: "demo", at, contactId: "a" }),
      click({ sendId: "s2", kind: "video", at, contactId: "b" }),
    ]);
    expect(audit.simultaneous).toBe(0);
    expect([...audit.solidContacts].sort()).toEqual(["a", "b"]);
  });

  it("un clic sans fiche compte dans les totaux, et ne désigne personne", () => {
    const audit = auditClicks([
      click({ contactId: null, at: new Date(SENT.getTime() + 1_000) }),
    ]);
    expect(audit.delivery).toBe(1);
    expect(audit.solidContacts).toEqual([]);
    expect(audit.suspectOnlyContacts).toEqual([]);
  });
});

describe("le total des prospects chauds, décomposé", () => {
  it("un autre signal sauve une fiche dont les clics sont douteux", () => {
    const audit = auditHot(
      [click({ contactId: "repondu", at: new Date(SENT.getTime() + 1_000) })],
      ["repondu"],
    );
    expect(audit.total).toBe(1);
    expect(audit.withoutClick).toBe(1);
    expect(audit.suspectOnly).toBe(0);
  });

  it("le total ne retire personne : il mesure, il ne décide pas", () => {
    const audit = auditHot(
      [
        click({ contactId: "douteux", at: new Date(SENT.getTime() + 1_000) }),
        click({ contactId: "solide", sendId: "s9", at: new Date("2026-10-01T18:00:00Z") }),
      ],
      ["qualifie"],
    );
    // Trois personnes, « douteux » comprise — c'est la règle actuelle.
    expect(audit.total).toBe(3);
    expect(audit.withoutClick).toBe(1);
    expect(audit.solidClick).toBe(1);
    // Et le seul nombre qui décide : ce que le total perdrait si on changeait.
    expect(audit.suspectOnly).toBe(1);
  });

  it("une même personne n'est comptée qu'une fois, quels que soient ses signaux", () => {
    const audit = auditHot(
      [
        click({ contactId: "nina", at: new Date("2026-10-01T18:00:00Z") }),
        click({ contactId: "nina", sendId: "s2", at: new Date("2026-10-02T18:00:00Z") }),
      ],
      ["nina"],
    );
    expect(audit.total).toBe(1);
  });

  it("sans aucun clic, le total est celui des deux autres signaux", () => {
    const audit = auditHot([], ["a", "b"]);
    expect(audit.total).toBe(2);
    expect(audit.suspectOnly).toBe(0);
    expect(audit.clicks.clicks).toBe(0);
  });
});
