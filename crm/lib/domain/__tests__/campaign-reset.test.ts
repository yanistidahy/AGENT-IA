import { describe, expect, it } from "vitest";
import {
  describeReset,
  describeRepliers,
  describeResetExclusions,
  replyAnchor,
  resettable,
  type ResetPlan,
} from "../campaign-reset";

const plan = (over: Partial<ResetPlan> = {}): ResetPlan => ({
  included: 52,
  alreadyWritten: 52,
  repliers: [],
  excluded: [],
  includeRepliers: false,
  ...over,
});

describe("resettable", () => {
  it("reprend une inscription terminée : la séquence est épuisée, pas la relation", () => {
    expect(resettable({ status: "done", repliedAt: null }, false).ok).toBe(true);
  });

  it("reprend une inscription arrêtée pour fiche close : l'envoi la refusera de toute façon", () => {
    // Le garde-fou qui protège la personne est revérifié **à l'envoi**
    // (`nextStep`) : le doubler ici ferait deux règles pour une décision.
    expect(resettable({ status: "stopped", repliedAt: null }, false).ok).toBe(true);
  });

  it("laisse dehors une inscription retirée à la main, toujours", () => {
    const verdict = resettable({ status: "removed", repliedAt: new Date() }, true);
    expect(verdict).toEqual({ ok: false, block: "removed" });
  });

  it("exclut celui qui a répondu par défaut, et l'inclut seulement si on le demande", () => {
    const reply = new Date("2026-05-01T10:00:00Z");
    expect(resettable({ status: "stopped", repliedAt: reply }, false)).toEqual({
      ok: false,
      block: "replied",
    });
    expect(resettable({ status: "stopped", repliedAt: reply }, true).ok).toBe(true);
  });
});

describe("replyAnchor", () => {
  const enrolled = new Date("2026-01-01T00:00:00Z");
  const sent = new Date("2026-03-01T00:00:00Z");
  const reset = new Date("2026-06-01T00:00:00Z");

  it("retient le dernier envoi tant qu'il est le plus récent", () => {
    expect(replyAnchor(sent, null, enrolled)).toEqual(sent);
  });

  it("bascule sur la réinitialisation dès qu'elle est postérieure", () => {
    // Sans ce déplacement, quelqu'un inclus volontairement malgré sa réponse
    // ne produirait aucun brouillon, alors que l'écran vient de lui en
    // promettre un.
    expect(replyAnchor(sent, reset, enrolled)).toEqual(reset);
  });

  it("retombe sur la date d'inscription quand rien d'autre n'existe", () => {
    expect(replyAnchor(null, null, enrolled)).toEqual(enrolled);
  });
});

describe("describeReset", () => {
  it("dit ce qui va se lire chez le destinataire, pas ce qui s'écrit en base", () => {
    expect(describeReset(plan())).toBe(
      "52 personnes seront ramenées à l'étape 1 et recevront un nouveau premier message, y compris celles qui ont déjà été contactées il y a plusieurs jours. Cela peut se lire comme un second premier contact.",
    );
  });

  it("ne parle de second premier contact que si quelqu'un a déjà été contacté", () => {
    const text = describeReset(plan({ alreadyWritten: 0 }));
    expect(text).not.toContain("second premier contact");
    expect(text).toContain("avec les consignes d'aujourd'hui");
  });

  it("s'accorde au singulier", () => {
    expect(describeReset(plan({ included: 1, alreadyWritten: 1 }))).toContain(
      "1 personne sera ramenée à l'étape 1 et recevra",
    );
  });

  it("ne promet rien quand personne n'est repris", () => {
    expect(describeReset(plan({ included: 0, alreadyWritten: 0 }))).toBe(
      "Aucune inscription ne sera réinitialisée.",
    );
  });
});

describe("describeRepliers", () => {
  it("nomme les personnes ayant répondu et dit qu'elles sont exclues par défaut", () => {
    const text = describeRepliers(plan({ repliers: ["Caroline Petit", "Léa Ruiz"] }));
    expect(text).toContain("Caroline Petit");
    expect(text).toContain("Léa Ruiz");
    expect(text).toContain("Elles sont exclues");
  });

  it("parle encore plus fort quand on les inclut : la phrase dit ce qu'on autorise", () => {
    const text = describeRepliers(
      plan({ repliers: ["Caroline Petit"], includeRepliers: true }),
    );
    expect(text).toContain("Vous avez choisi de l'inclure");
    expect(text).toContain("malgré sa réponse");
  });

  it("se tait quand personne n'a répondu", () => {
    expect(describeRepliers(plan())).toBe("");
  });
});

describe("describeResetExclusions", () => {
  it("nomme chaque exclu avec son motif", () => {
    const text = describeResetExclusions(
      plan({ excluded: [{ name: "Margaux Keller", block: "removed" }] }),
    );
    expect(text).toContain("Margaux Keller (retirée de la campagne à la main)");
  });

  it("se tait quand personne n'est dehors", () => {
    expect(describeResetExclusions(plan())).toBe("");
  });
});
