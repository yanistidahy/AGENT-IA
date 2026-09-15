import { describe, expect, it } from "vitest";
import { shiftChips } from "../shift-chips";

const SHIFTS = [{ agentId: "sarah" }, { agentId: "sabrina" }] as const;
const PROFILES = [
  { slug: "sarah", name: "Sarah Lemoine", enabled: false },
  { slug: "sabrina", name: "Sabrina Roche", enabled: true },
  { slug: "alex", name: "Alex", enabled: true },
];

describe("les puces d'agent respectent l'activation", () => {
  it("un agent désactivé n'a pas de puce", () => {
    const chips = shiftChips(SHIFTS, PROFILES, undefined);
    expect(chips.map((c) => c.agentId)).toEqual(["sabrina"]);
  });

  it("la puce porte le nom réglé, jamais le slug", () => {
    // Renommer un agent dans /reglages doit renommer sa puce — c'est la règle
    // du jalon 15 : le nom est de la donnée.
    expect(shiftChips(SHIFTS, PROFILES, undefined)[0]?.label).toBe("Sabrina Roche");
  });

  it("un filtre actif garde sa puce, même désactivé", () => {
    // Sinon un lien mis en favori ouvrirait une liste filtrée qu'aucun contrôle
    // ne nomme, et qu'on ne pourrait annuler qu'en éditant l'URL (jalon 31).
    const chips = shiftChips(SHIFTS, PROFILES, "sarah");
    expect(chips.map((c) => c.agentId)).toEqual(["sarah", "sabrina"]);
  });

  it("une vacation câblée avant son premier semis reste visible", () => {
    // Absent de la base n'est pas désactivé : c'est un agent que le seed n'a
    // pas encore écrit. Le masquer ferait disparaître une vacation qui tourne.
    const chips = shiftChips([{ agentId: "neuf" }], PROFILES, undefined);
    expect(chips.map((c) => c.label)).toEqual(["neuf"]);
  });
});
