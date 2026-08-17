import { describe, expect, it } from "vitest";
import { AGENTS } from "../registry";
import { COMPANY_CONTEXT, EMAIL_SIGNATURE, SALES_WRITING_RULES } from "../prompts/company";
import { buildSystemPrompt } from "../prompts/shared";
import { enforceSignature, lastLine, signsWithName } from "@/lib/domain/email-format";

/**
 * **Aucun prospect ne doit lire le nom d'un agent.**
 *
 * Le défaut signalé : le premier vrai brouillon d'Alex se terminait par
 * « Alex ». Le message part de la boîte de l'utilisateur, sous son adresse : une
 * signature au nom d'un agent est une contradiction visible dans le message
 * lui-même, et elle apprend au destinataire qu'il ne parle pas à un humain.
 *
 * La règle est posée à trois endroits, et ce test couvre les trois : le prompt
 * la demande, `enforceSignature()` la garantit quoi qu'ait rendu le modèle, et
 * les tests ci-dessous échouent si la dernière ligne d'un brouillon porte un nom
 * d'agent.
 */
const AGENT_NAMES = AGENTS.map((agent) => agent.name);

/** Ce qu'un modèle rend quand il oublie la consigne — observé en production. */
const DRAFTS_SIGNED_WRONG = [
  "Bonjour Marc,\n\nJ'ai essayé de vous joindre.\n\nJeudi vous irait ?\n\nAlex",
  "Bonjour,\n\nUne question rapide.\n\nBien à vous,\nAlex",
  "Bonjour,\n\nUne question rapide.\n\nCordialement,\nSabrina",
  "Bonjour,\n\nUne question.\n\nAlex.",
];

describe("un brouillon ne signe jamais du nom d'un agent", () => {
  it("détecte le nom d'agent en dernière ligne", () => {
    for (const draft of DRAFTS_SIGNED_WRONG) {
      expect(signsWithName(draft, AGENT_NAMES), `« ${lastLine(draft)} » doit être refusé`).toBe(
        true,
      );
    }
  });

  it("corrige chacun de ces brouillons", () => {
    for (const draft of DRAFTS_SIGNED_WRONG) {
      const fixed = enforceSignature(draft, EMAIL_SIGNATURE, AGENT_NAMES);
      expect(lastLine(fixed), `corrigé : « ${lastLine(draft)} »`).toBe(EMAIL_SIGNATURE);
      expect(signsWithName(fixed, AGENT_NAMES)).toBe(false);
    }
  });

  it("garde la formule de politesse qui précède", () => {
    // Remplacer « Alex » ne doit pas emporter « Bien à vous, » avec lui : c'est
    // la ligne du dessus, elle appartient au message.
    const fixed = enforceSignature(
      "Bonjour,\n\nUne question rapide.\n\nBien à vous,\nAlex",
      EMAIL_SIGNATURE,
      AGENT_NAMES,
    );
    expect(fixed).toContain("Bien à vous,\nL'équipe AuraFLOW AI");
  });

  it("ajoute la signature quand il n'y en a aucune", () => {
    const fixed = enforceSignature("Bonjour,\n\nJeudi vous irait ?", EMAIL_SIGNATURE, AGENT_NAMES);
    expect(lastLine(fixed)).toBe(EMAIL_SIGNATURE);
    expect(fixed).toContain("Jeudi vous irait ?\n\nL'équipe AuraFLOW AI");
  });

  it("ne touche pas à un brouillon déjà correct", () => {
    const good = `Bonjour Marc,\n\nJeudi vous irait ?\n\n${EMAIL_SIGNATURE}`;
    expect(enforceSignature(good, EMAIL_SIGNATURE, AGENT_NAMES)).toBe(good);
  });

  it("ne confond pas une mention dans une phrase avec une signature", () => {
    // « Alex » cité au milieu d'une phrase longue est du texte, pas une
    // signature : le remplacer mutilerait le message.
    const phrase = "Bonjour,\n\nJe transmets votre demande à Alex dès demain matin sans faute";
    expect(signsWithName(phrase, AGENT_NAMES)).toBe(false);
    expect(enforceSignature(phrase, EMAIL_SIGNATURE, AGENT_NAMES)).toContain(
      "à Alex dès demain matin sans faute\n\nL'équipe AuraFLOW AI",
    );
  });

  it("remplace aussi le nom de l'utilisateur, sans doubler la signature", () => {
    // Défaut trouvé à la vérification du jalon 33 : un brouillon signé « Yanis »
    // ne portait aucun nom d'agent, la signature était donc **ajoutée**, et le
    // message partait avec deux signatures l'une sous l'autre.
    const forbidden = [...AGENT_NAMES, "Yanis Tidahy", "Yanis"];
    const draft = "Bonjour,\n\nJeudi vous irait ?\n\nYanis";
    const fixed = enforceSignature(draft, EMAIL_SIGNATURE, forbidden);

    expect(lastLine(fixed)).toBe(EMAIL_SIGNATURE);
    expect(fixed).not.toContain("Yanis");
    // Une seule signature, pas deux empilées.
    expect(fixed.split(EMAIL_SIGNATURE)).toHaveLength(2);
  });

  it("couvre tous les agents du registre, pas seulement Alex", () => {
    // Un agent ajouté demain entre dans la garde sans qu'on y pense.
    for (const name of AGENT_NAMES) {
      expect(signsWithName(`Bonjour,\n\nUne question.\n\n${name}`, AGENT_NAMES)).toBe(true);
    }
  });
});

describe("le prompt porte la règle", () => {
  it("Alex reçoit la signature et les interdits commerciaux", () => {
    const alex = AGENTS.find((agent) => agent.slug === "alex");
    expect(alex).toBeDefined();
    const prompt = buildSystemPrompt(alex!.persona, {
      name: "Alex",
      role: "Emails",
      colleagues: [],
    }, alex!.rules);

    expect(prompt).toContain(EMAIL_SIGNATURE);
    expect(prompt).toContain("Jamais de prix");
    expect(prompt).toContain("Jamais d'affirmation inventée");
  });

  it("tous les agents reçoivent le contexte entreprise", () => {
    // Sabrina raisonne sur le même métier : deux descriptions du positionnement
    // finiraient par se contredire.
    for (const agent of AGENTS) {
      const prompt = buildSystemPrompt(
        agent.persona,
        { name: agent.name, role: agent.specialty, colleagues: [] },
        agent.rules,
      );
      expect(prompt, `${agent.slug} ignore le positionnement`).toContain(COMPANY_CONTEXT);
      expect(prompt, `${agent.slug} ignore l'offre`).toContain("assistants virtuels");
    }
  });

  it("seul Alex porte les interdits de rédaction", () => {
    // Sabrina n'écrit pas d'email : lui imposer une signature de courriel serait
    // du bruit dans son prompt.
    const carriers = AGENTS.filter((agent) => agent.rules?.includes(SALES_WRITING_RULES) === true);
    expect(carriers.map((agent) => agent.slug)).toEqual(["alex"]);
  });
});
