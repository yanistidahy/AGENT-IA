import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_MODES,
  CAMPAIGN_PATHS,
  describeCampaignMode,
  stepModeFor,
  toCampaignMode,
} from "../campaign-mode";

describe("la frontière string → union", () => {
  it("reconnaît les deux voies", () => {
    expect(toCampaignMode("manual")).toBe("manual");
    expect(toCampaignMode("alex")).toBe("alex");
  });

  it("retombe sur Alex sur une valeur inconnue", () => {
    // Une valeur héritée ou fautive ne doit pas devenir une panne : c'est la
    // posture de `modelFor` depuis le jalon 36.
    expect(toCampaignMode("")).toBe("alex");
    expect(toCampaignMode("Manuel")).toBe("alex");
  });
});

describe("le mode d'une étape neuve", () => {
  it("hérite de la voie de la campagne", () => {
    expect(stepModeFor("manual")).toBe("manual");
    expect(stepModeFor("alex")).toBe("alex");
  });
});

describe("les deux voies proposées", () => {
  it("couvrent exactement les modes, une fois chacun", () => {
    expect(CAMPAIGN_PATHS.map((path) => path.mode)).toEqual([...CAMPAIGN_MODES]);
  });

  it("portent un titre, une phrase et de quoi savoir ce qui suit", () => {
    for (const path of CAMPAIGN_PATHS) {
      expect(path.title.length).toBeGreaterThan(0);
      expect(path.summary.length).toBeGreaterThan(20);
      expect(path.next.length).toBeGreaterThan(1);
    }
  });

  it("disent ce qu'elles font, pas le nom du réglage", () => {
    const alex = CAMPAIGN_PATHS.find((path) => path.mode === "alex");
    const manual = CAMPAIGN_PATHS.find((path) => path.mode === "manual");
    // Le coût d'un côté, la gratuité de l'autre : c'est l'écart qui décide.
    expect(alex?.summary).toMatch(/factur/);
    expect(manual?.summary).toMatch(/\{prenom\}/);
    expect(manual?.next.join(" ")).toMatch(/gratuite/);
  });

  it("nomment les deux voies comme l'écran les nomme", () => {
    expect(CAMPAIGN_PATHS[0]?.title).toBe("Automatique (Alex)");
    expect(CAMPAIGN_PATHS[1]?.title).toBe("Manuel");
  });
});

describe("le rappel affiché sur la campagne", () => {
  it("distingue les deux voies", () => {
    expect(describeCampaignMode("manual")).toMatch(/à la main/);
    expect(describeCampaignMode("alex")).toMatch(/Alex/);
  });
});
