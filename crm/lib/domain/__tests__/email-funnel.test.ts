import { describe, expect, it } from "vitest";
import { buildFunnel, OPEN_RATE_SHORT, type FunnelStep } from "../email-funnel";
import { formatRate, OPEN_RATE_CAVEAT, rate } from "../email-stats";

/**
 * **Quatre nombres côte à côte se lisent comme quatre mesures ; ce sont les
 * mêmes personnes à quatre moments.**
 *
 * Ces tests fixent ce qui fait de la rangée un entonnoir : l'ordre, la chute,
 * le dénominateur nommé — et l'interdiction qu'une estimation serve de
 * dénominateur à un fait.
 */

const FULL = { written: 20, messages: 31, opened: 9, tracked: 18, replied: 6, meetings: 2 };

function step(steps: readonly FunnelStep[], key: string): FunnelStep {
  const found = steps.find((entry) => entry.key === key);
  if (found === undefined) throw new Error(`étape ${key} absente`);
  return found;
}

describe("l'ordre et la chute", () => {
  it("suit la séquence écrit → ouvert → répondu → rendez-vous", () => {
    expect(buildFunnel(FULL).map((entry) => entry.key)).toEqual([
      "sent",
      "opened",
      "replied",
      "meetings",
    ]);
  });

  it("la première étape n'a ni chute ni taux — il n'y a rien avant elle", () => {
    // « 100 % des personnes écrites » est une tautologie déguisée en mesure.
    const sent = step(buildFunnel(FULL), "sent");
    expect(sent.drop).toBeNull();
    expect(sent.rate).toBeNull();
  });

  it("chaque étape suivante dit combien de personnes se sont perdues", () => {
    const steps = buildFunnel(FULL);
    expect(step(steps, "opened").drop).toBe(9); // 18 suivies − 9 ouvertures
    expect(step(steps, "replied").drop).toBe(14); // 20 écrites − 6 réponses
    expect(step(steps, "meetings").drop).toBe(4); // 6 réponses − 2 rendez-vous
  });

  it("ne lisse pas une étape qui remonte", () => {
    // Plus de réponses que d'ouvertures arrive : un client qui ne charge pas
    // les images répond quand même. C'est un signal — l'estimation est basse ce
    // mois-ci — et le corriger en silence l'effacerait.
    const steps = buildFunnel({ ...FULL, opened: 2, replied: 6 });
    expect(step(steps, "opened").count).toBe(2);
    expect(step(steps, "replied").count).toBe(6);
  });
});

describe("les dénominateurs", () => {
  it("**une estimation ne sert jamais de dénominateur à un fait**", () => {
    // Le taux de réponse se rapporte aux personnes écrites, pas à celles qui
    // « ont ouvert » : diviser un fait par un chiffre surestimé donnerait un
    // résultat faux dans un sens qu'on ne saurait plus nommer.
    const replied = step(buildFunnel(FULL), "replied");
    expect(replied.rate?.denominator).toBe(FULL.written);
    expect(replied.rateOf).toContain("écrites");
    expect(formatRate(replied.rate ?? rate(0, 0))).toBe("30 %");
  });

  it("l'ouverture se rapporte aux personnes suivies, pas à toutes", () => {
    // Un message parti sans pixel n'avait aucune chance d'être compté.
    const opened = step(buildFunnel(FULL), "opened");
    expect(opened.rate?.denominator).toBe(FULL.tracked);
    expect(formatRate(opened.rate ?? rate(0, 0))).toBe("50 %");
  });

  it("le rendez-vous se rapporte aux réponses obtenues", () => {
    const meetings = step(buildFunnel(FULL), "meetings");
    expect(meetings.rate?.denominator).toBe(FULL.replied);
    expect(formatRate(meetings.rate ?? rate(0, 0))).toBe("33 %");
  });

  it("chaque taux nomme son dénominateur", () => {
    // « 45 % » sans « de quoi » n'apprend rien, et se lit toujours comme le
    // dénominateur le plus flatteur.
    for (const entry of buildFunnel(FULL)) expect(entry.rateOf.length).toBeGreaterThan(3);
  });

  it("la première étape porte le nombre de messages, accordé", () => {
    expect(step(buildFunnel(FULL), "sent").rateOf).toBe("31 messages partis");
    expect(step(buildFunnel({ ...FULL, messages: 1 }), "sent").rateOf).toBe("1 message parti");
  });
});

describe("sans dénominateur, aucun taux", () => {
  it("rend « — » plutôt que « 0 % » sur un entonnoir vide", () => {
    // Zéro pour cent affirmerait un échec de conversion ; sans personne à
    // convertir, il n'y a rien à affirmer. Règle du jalon 20.
    const steps = buildFunnel({
      written: 0,
      messages: 0,
      opened: 0,
      tracked: 0,
      replied: 0,
      meetings: 0,
    });
    for (const entry of steps) {
      if (entry.rate === null) continue;
      expect(entry.rate.value).toBeNull();
      expect(formatRate(entry.rate)).toBe("—");
    }
  });

  it("aucun suivi ne rend pas l'ouverture nulle, il la rend inconnue", () => {
    const opened = step(buildFunnel({ ...FULL, tracked: 0, opened: 0 }), "opened");
    expect(opened.rate?.value ?? null).toBeNull();
    expect(formatRate(opened.rate ?? rate(0, 0))).toBe("—");
  });
});

describe("l'estimation reste distincte du fait", () => {
  it("une seule étape est marquée estimation, et c'est l'ouverture", () => {
    const estimates = buildFunnel(FULL).filter((entry) => entry.kind === "estimate");
    expect(estimates).toHaveLength(1);
    expect(estimates[0]?.key).toBe("opened");
    expect(estimates[0]?.label).toContain("estimation");
  });

  it("la mise en garde courte tient sur une ligne et dit l'essentiel", () => {
    expect(OPEN_RATE_SHORT.length).toBeLessThan(60);
    expect(OPEN_RATE_SHORT).toContain("Surestim");
    // Et la version longue survit : elle est repliée au survol, pas supprimée.
    expect(OPEN_RATE_CAVEAT.length).toBeGreaterThan(OPEN_RATE_SHORT.length);
    expect(OPEN_RATE_CAVEAT).toContain("Apple Mail");
  });
});
