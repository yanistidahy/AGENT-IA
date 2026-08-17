import { describe, expect, it } from "vitest";
import { AGENTS } from "../registry";
import {
  COMPANY_CONTEXT,
  DEFAULT_DEMO,
  DEFAULT_SIGNATURE,
  demoRule,
  SALES_WRITING_RULES,
  signatureBlock,
  signatureRule,
  WRITING_SHAPE,
} from "../prompts/company";
import { buildSystemPrompt } from "../prompts/shared";
import { enforceSignature, lastLine, signsWithName } from "@/lib/domain/email-format";

/**
 * **Aucun prospect ne doit lire le nom d'un agent.**
 *
 * Le défaut d'origine : le premier vrai brouillon d'Alex se terminait par
 * « Alex ». Le message part de la boîte de l'utilisateur, sous son adresse : une
 * signature au nom d'un agent est une contradiction visible dans le message
 * lui-même.
 *
 * **Révisé au jalon 34.** La signature n'est plus une constante mais un réglage
 * — deux lignes, nom et titre, pour que l'associé signe le sien. Le test change
 * donc de forme sans changer d'intention : il refuse toujours un nom d'agent en
 * dernière ligne, et **accepte désormais le signataire configuré**, quel qu'il
 * soit.
 */
const AGENT_NAMES = AGENTS.map((agent) => agent.name);
const SIGNATURE = signatureBlock(DEFAULT_SIGNATURE);

/** Ce qu'un modèle rend quand il oublie la consigne — observé en production. */
const DRAFTS_SIGNED_WRONG = [
  "Bonjour Marc,\n\nJ'ai essayé de vous joindre.\n\nJeudi vous irait ?\n\nAlex",
  "Bonjour,\n\nUne question rapide.\n\nÀ bientôt,\nAlex",
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
      const fixed = enforceSignature(draft, SIGNATURE, AGENT_NAMES);
      expect(lastLine(fixed), `corrigé : « ${lastLine(draft)} »`).toBe(DEFAULT_SIGNATURE.title);
      expect(fixed).toContain(DEFAULT_SIGNATURE.name);
      expect(signsWithName(fixed, AGENT_NAMES)).toBe(false);
    }
  });

  it("**accepte le signataire configuré** et n'y touche pas", () => {
    // Le cœur du changement du jalon 34 : « Yanis Tidahy / Fondateur, Aura Flow
    // AI » est la bonne signature, pas une anomalie à corriger.
    const good = `Bonjour Caroline,\n\nÊtes-vous curieux de tester l'outil ?\n\nÀ bientôt,\n\n${SIGNATURE}`;
    expect(enforceSignature(good, SIGNATURE, AGENT_NAMES)).toBe(good);
    expect(signsWithName(good, AGENT_NAMES)).toBe(false);
  });

  it("accepte un signataire différent — l'associé signe le sien", () => {
    const other = signatureBlock({ name: "Camille Roux", title: "Associée, Aura Flow AI" });
    const draft = `Bonjour,\n\nUne question.\n\nÀ bientôt,\n\n${other}`;
    expect(enforceSignature(draft, other, AGENT_NAMES)).toBe(draft);
  });

  it("garde la formule de politesse qui précède", () => {
    const fixed = enforceSignature(
      "Bonjour,\n\nUne question rapide.\n\nÀ bientôt,\nAlex",
      SIGNATURE,
      AGENT_NAMES,
    );
    expect(fixed).toContain("À bientôt,");
    expect(fixed).toContain(DEFAULT_SIGNATURE.name);
  });

  it("ajoute la signature quand il n'y en a aucune", () => {
    const fixed = enforceSignature("Bonjour,\n\nJeudi vous irait ?", SIGNATURE, AGENT_NAMES);
    expect(lastLine(fixed)).toBe(DEFAULT_SIGNATURE.title);
  });

  it("ne confond pas une mention dans une phrase avec une signature", () => {
    const phrase = "Bonjour,\n\nJe transmets votre demande à Alex dès demain matin sans faute";
    expect(signsWithName(phrase, AGENT_NAMES)).toBe(false);
  });

  it("remplace le nom du signataire au lieu d'empiler deux signatures", () => {
    // Régression réintroduite puis rattrapée au jalon 34 : quand la liste des
    // signataires interdits ne portait que les noms d'agents, un brouillon
    // terminé par « Yanis » faisait **ajouter** la signature — et le message
    // partait avec « Yanis » puis « Yanis Tidahy / Fondateur ».
    const forbidden = [...AGENT_NAMES, "Yanis Tidahy", "Yanis"];
    const draft = "Bonjour,\n\nJeudi vous irait ?\n\nYanis";
    const fixed = enforceSignature(draft, SIGNATURE, forbidden);

    expect(lastLine(fixed)).toBe(DEFAULT_SIGNATURE.title);
    // Une seule fois le nom, pas deux blocs empilés.
    expect(fixed.split(DEFAULT_SIGNATURE.name)).toHaveLength(2);
  });

  it("couvre tous les agents du registre, pas seulement Alex", () => {
    for (const name of AGENT_NAMES) {
      expect(signsWithName(`Bonjour,\n\nUne question.\n\n${name}`, AGENT_NAMES)).toBe(true);
    }
  });
});

describe("le prompt porte le pitch et les règles", () => {
  const alex = AGENTS.find((agent) => agent.slug === "alex");

  it("Alex reçoit la forme attendue et les interdits", () => {
    expect(alex).toBeDefined();
    const prompt = buildSystemPrompt(
      alex!.persona,
      { name: "Alex", role: "Emails", colleagues: [] },
      alex!.rules,
    );

    expect(prompt).toContain("Jamais de prix");
    expect(prompt).toContain("Jamais d'affirmation inventée");
    // Les trois règles de forme, tirées du mail de référence.
    expect(prompt).toContain("Ouvre sur quelque chose de concret sur leur activité");
    expect(prompt).toContain("Nomme la douleur de leur côté");
    // Les deux règles ajoutées au jalon 35, tirées du nouveau mail de référence.
    expect(prompt).toContain("Deux appels à l'action, dans cet ordre, jamais un seul");
    expect(prompt).toContain("La démonstration est préparée pour LEUR site");
  });

  it("l'ordre des deux appels à l'action est explicite", () => {
    // Commencer par le calendrier demande un engagement à quelqu'un qui ne nous
    // connaît pas : la réponse d'abord, la réservation en second.
    const reponse = WRITING_SHAPE.indexOf("d'abord leur demander de répondre");
    const creneau = WRITING_SHAPE.indexOf("proposer la réservation d'un créneau");
    expect(reponse).toBeGreaterThan(-1);
    expect(creneau).toBeGreaterThan(reponse);
  });

  it("le mail de référence est donné comme exemple, jamais comme gabarit", () => {
    // Un modèle à qui l'on montre un texte sans le qualifier le recopie mot pour
    // mot, et cinquante prospects reçoivent la même lettre.
    expect(WRITING_SHAPE).toContain("à imiter, jamais à recopier");
    expect(WRITING_SHAPE).toContain("N'en reprends ni les");
    expect(WRITING_SHAPE).toContain("chaque destinataire doit recevoir un");
    expect(WRITING_SHAPE).toContain("Linaé");
    // L'ancienne référence a disparu : deux exemples se contrediraient.
    expect(WRITING_SHAPE).not.toContain("Miye car");
  });

  it("le positionnement décrit le conseiller proactif, pas le ticket de support", () => {
    // La version faible du discours — « traite les tickets » — vendait un centre
    // de coûts. Ce test fixe le pitch réel.
    expect(COMPANY_CONTEXT).toContain("Personal Shoppers");
    expect(COMPANY_CONTEXT).toContain("conseiller proactif");
    expect(COMPANY_CONTEXT).toContain("guide les visiteurs vers l'achat");
    expect(COMPANY_CONTEXT).toContain("Shopify");
    expect(COMPANY_CONTEXT).not.toContain("assistants virtuels qui traitent les tickets");
  });

  it("tous les agents reçoivent le positionnement", () => {
    for (const agent of AGENTS) {
      const prompt = buildSystemPrompt(
        agent.persona,
        { name: agent.name, role: agent.specialty, colleagues: [] },
        agent.rules,
      );
      expect(prompt, `${agent.slug} ignore le positionnement`).toContain(COMPANY_CONTEXT);
    }
  });

  it("seul Alex porte les interdits de rédaction", () => {
    const carriers = AGENTS.filter((agent) => agent.rules?.includes(SALES_WRITING_RULES) === true);
    expect(carriers.map((agent) => agent.slug)).toEqual(["alex"]);
  });
});

describe("les consignes calculées depuis les réglages", () => {
  it("la signature annonce le nom réglé, pas une valeur figée", () => {
    const rule = signatureRule({ name: "Camille Roux", title: "Associée, Aura Flow AI" });
    expect(rule).toContain("Camille Roux\nAssociée, Aura Flow AI");
    expect(rule).not.toContain("Yanis");
  });

  it("un titre vide ne laisse pas de ligne orpheline", () => {
    expect(signatureBlock({ name: "Yanis Tidahy", title: "" })).toBe("Yanis Tidahy");
  });

  it("le lien est annoncé avec son libellé, sans URL à écrire", () => {
    const rule = demoRule(DEFAULT_DEMO);
    expect(rule).toContain(`→ ${DEFAULT_DEMO.label}`);
    // Alex n'écrit jamais l'adresse : l'application la pose au rendu.
    expect(rule).not.toContain(DEFAULT_DEMO.url);
  });

  it("une URL vide supprime le second appel, pas le premier", () => {
    // Le premier appel — demander une réponse — ne dépend d'aucun lien et doit
    // survivre : c'est lui qui ouvre la conversation.
    const rule = demoRule({ label: "Réserver un appel", url: "" });
    expect(rule).toContain("n'invente aucune adresse");
    expect(rule).toContain("Garde le premier");
  });
});
