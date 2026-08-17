import { describe, expect, it } from "vitest";
import { composeMessage, DRAFT_CLOSE, DRAFT_OPEN, parseReply } from "../draft-protocol";

/**
 * Le protocole qui permet à une même réponse de parler **et** de réécrire.
 *
 * L'enjeu concret : « qu'est-ce qu'on sait d'elle ? » doit répondre sans toucher
 * aux champs, « fais plus court » doit les remplacer. C'est la présence ou
 * l'absence du bloc qui tranche, et rien d'autre.
 */
const REVISION = `J'ai retiré la phrase sur les stocks, qui doublonnait avec la précédente.

${DRAFT_OPEN}
Objet : Vos questions récurrentes
Bonjour Caroline,

Une seule idée par paragraphe.

À bientôt,

Yanis Tidahy
Fondateur, Aura Flow AI
${DRAFT_CLOSE}`;

describe("réponse portant un brouillon", () => {
  it("sépare le message du brouillon", () => {
    const parsed = parseReply(REVISION);
    expect(parsed.message).toBe(
      "J'ai retiré la phrase sur les stocks, qui doublonnait avec la précédente.",
    );
    expect(parsed.draft?.subject).toBe("Vos questions récurrentes");
    expect(parsed.draft?.body).toContain("Bonjour Caroline,");
    expect(parsed.draft?.body).toContain("Fondateur, Aura Flow AI");
  });

  it("ne laisse aucun marqueur dans le texte affiché ni dans le corps", () => {
    // Un marqueur qui fuit dans le corps partirait tel quel chez le prospect.
    const parsed = parseReply(REVISION);
    expect(parsed.message).not.toContain(DRAFT_OPEN);
    expect(parsed.draft?.body).not.toContain(DRAFT_CLOSE);
  });

  it("garde les lignes vides du corps — c'est la mise en forme du message", () => {
    const parsed = parseReply(REVISION);
    expect(parsed.draft?.body).toContain("Bonjour Caroline,\n\nUne seule idée");
  });

  it("accepte un bloc sans objet : une reprise peut ne changer que le corps", () => {
    const parsed = parseReply(`Voilà.\n\n${DRAFT_OPEN}\nBonjour,\n\nPlus court.\n${DRAFT_CLOSE}`);
    expect(parsed.draft?.subject).toBe("");
    expect(parsed.draft?.body).toBe("Bonjour,\n\nPlus court.");
  });
});

describe("réponse sans brouillon", () => {
  it("rend le texte seul et laisse les champs intacts", () => {
    // Le cas « qu'est-ce qu'on sait d'elle ? » : Alex répond, rien ne bouge.
    const parsed = parseReply(
      "Caroline dirige Miye car depuis 2019. Trois échanges, aucun aboutissement.",
    );
    expect(parsed.draft).toBeNull();
    expect(parsed.message).toContain("Miye car");
  });

  it("ignore un bloc ouvert et jamais refermé", () => {
    // Réponse tronquée par la limite de jetons : appliquer un brouillon à moitié
    // écrit remplacerait un message complet par un fragment, sans rien signaler.
    const parsed = parseReply(`Je réécris.\n\n${DRAFT_OPEN}\nObjet : X\nDébut du corps`);
    expect(parsed.draft).toBeNull();
    expect(parsed.message).toBe("Je réécris.");
  });

  it("rejette un bloc dont le corps est vide", () => {
    const parsed = parseReply(`Voilà.\n\n${DRAFT_OPEN}\nObjet : X\n${DRAFT_CLOSE}`);
    expect(parsed.draft).toBeNull();
  });
});

describe("ce que le client envoie", () => {
  it("porte le brouillon courant avant la demande", () => {
    // Le texte est retouché dans un champ que le serveur ne voit jamais : ne
    // l'envoyer qu'une fois ferait travailler Alex sur une version périmée.
    const message = composeMessage(
      { id: "c_42", name: "Caroline Meyer" },
      { subject: "Objet retouché", body: "Phrase écrite à la main." },
      "fais plus court",
    );
    // L'identifiant permet à Alex de lire la fiche quand on l'interroge sur elle.
    expect(message).toContain("c_42");
    expect(message).toContain("Caroline Meyer");
    expect(message).toContain("Objet retouché");
    expect(message).toContain("Phrase écrite à la main.");
    expect(message).toContain("fais plus court");
    // L'ordre compte : le brouillon d'abord, la demande ensuite.
    expect(message.indexOf("Phrase écrite")).toBeLessThan(message.indexOf("fais plus court"));
  });
});
