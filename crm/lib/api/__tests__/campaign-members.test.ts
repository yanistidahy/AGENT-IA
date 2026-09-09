import { describe, expect, it } from "vitest";

import { memberState, MEMBER_STATES } from "../campaigns";

/**
 * **L'état d'un inscrit se dérive, il ne se stocke pas.**
 *
 * Le stocker, c'est accepter qu'il contredise un jour les envois et les
 * réponses — la même faute que le statut de relance aurait été s'il avait été
 * saisi partout (jalon 6). Ici, l'ordre des règles est la décision : ce qui
 * compte pour agir passe avant ce qui décrit.
 */

const NOW = new Date("2026-09-09T10:00:00Z");
const HIER = new Date("2026-09-08T10:00:00Z");

describe("l'état d'un inscrit", () => {
  it("« a répondu » l'emporte sur tout le reste", () => {
    // Y compris sur une inscription arrêtée : c'est précisément la réponse qui
    // l'a arrêtée (jalon 38), et afficher « arrêtée » masquerait la bonne
    // nouvelle derrière sa conséquence.
    expect(memberState({ status: "stopped", lastSentAt: HIER, repliedAt: NOW })).toBe("replied");
    expect(memberState({ status: "active", lastSentAt: HIER, repliedAt: NOW })).toBe("replied");
  });

  it("une inscription arrêtée sans réponse se dit arrêtée", () => {
    expect(memberState({ status: "stopped", lastSentAt: HIER, repliedAt: null })).toBe("stopped");
    // Arrêtée avant même le premier message — retirée à la main, ou campagne
    // archivée : elle ne recevra rien, et ce n'est pas « pas encore écrit ».
    expect(memberState({ status: "stopped", lastSentAt: null, repliedAt: null })).toBe("stopped");
  });

  it("distingue « pas encore écrit » de « silencieux »", () => {
    // C'est le partage qui décide de la journée : l'un attend un envoi, l'autre
    // attend une réponse. Les confondre ferait relancer quelqu'un à qui l'on
    // n'a jamais écrit.
    expect(memberState({ status: "active", lastSentAt: null, repliedAt: null })).toBe("pending");
    expect(memberState({ status: "active", lastSentAt: HIER, repliedAt: null })).toBe("waiting");
  });

  it("les quatre états sont proposés au filtre, sans trou", () => {
    // Un état qu'aucune puce ne sélectionne est un segment invisible : les
    // fiches y disparaissent sans que rien ne le dise.
    const offered = new Set(MEMBER_STATES.map((entry) => entry.value));
    const produced = new Set([
      memberState({ status: "active", lastSentAt: null, repliedAt: null }),
      memberState({ status: "active", lastSentAt: HIER, repliedAt: null }),
      memberState({ status: "active", lastSentAt: HIER, repliedAt: NOW }),
      memberState({ status: "stopped", lastSentAt: HIER, repliedAt: null }),
    ]);
    for (const state of produced) {
      expect(offered.has(state), `l'état « ${state} » n'a pas de puce`).toBe(true);
    }
    expect(offered.size).toBe(produced.size);
  });
});
