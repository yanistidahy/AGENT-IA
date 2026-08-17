import { describe, expect, it } from "vitest";
import { DRAFT_PROTOCOL } from "../alex-rules";
import { composeMessage } from "@/lib/domain/draft-protocol";

/**
 * **La reprise doit suivre l'instruction, pas produire une variante.**
 *
 * C'est le point qui décide de l'usage de la fonction : « insiste sur le SAV »
 * doit rendre le SAV plus présent et ne rien changer d'autre. Une reprise qui
 * réécrit le message dans un autre style est un échec, même si le texte est bon
 * — l'utilisateur a passé du temps sur des formulations qu'il retrouve modifiées
 * sans les avoir mentionnées.
 *
 * Ce test porte sur la **consigne**, seule chose vérifiable sans appeler le
 * modèle. Que le modèle l'applique relève de lui, et ne s'établira qu'à l'usage.
 */
describe("le protocole exige une reprise fidèle", () => {
  it("demande d'appliquer l'instruction littéralement", () => {
    expect(DRAFT_PROTOCOL).toContain("Applique la demande littéralement");
    // Un exemple concret vaut mieux qu'un principe : le prompt en porte un.
    expect(DRAFT_PROTOCOL).toContain("Insiste sur le SAV");
  });

  it("interdit de toucher à ce qui n'a pas été mentionné", () => {
    expect(DRAFT_PROTOCOL).toContain("Ne touche à rien d'autre");
    expect(DRAFT_PROTOCOL).toContain("mot pour mot");
  });

  it("impose de lire tout l'échange, pas seulement le dernier message", () => {
    // « Fais plus court » puis « garde la phrase sur les stocks » se lisent
    // ensemble : le second message ne remplace pas le premier.
    expect(DRAFT_PROTOCOL).toContain("tout l'échange");
    expect(DRAFT_PROTOCOL).toContain("garde la phrase sur les stocks");
  });

  it("demande de poser une question plutôt que de deviner", () => {
    expect(DRAFT_PROTOCOL).toContain("demande — ne devine pas");
    // Sans bloc : une question ne doit pas modifier le brouillon au passage.
    expect(DRAFT_PROTOCOL).toContain("sans bloc");
  });

  it("exige une ligne qui nomme le changement **et l'endroit**", () => {
    expect(DRAFT_PROTOCOL).toContain("nomme le changement et l'endroit");
    // Le contre-exemple est dans le prompt : c'est lui qui rend la règle claire.
    expect(DRAFT_PROTOCOL).toContain("Voici une nouvelle version");
  });
});

describe("ce que chaque demande transporte", () => {
  it("porte le brouillon courant, le contact et le signataire", () => {
    const message = composeMessage(
      { id: "c_1", name: "Stéphanie Roy" },
      { subject: "Une démonstration préparée pour Linaé", body: "Bonjour Stéphanie,\n\nUn mot." },
      "insiste sur le SAV",
      "Mohamed Targani\nCo-Fondateur, Aura Flow AI",
    );

    expect(message).toContain("c_1");
    expect(message).toContain("Bonjour Stéphanie,");
    expect(message).toContain("Mohamed Targani");
    expect(message).toContain("insiste sur le SAV");

    // La signature est annoncée **avant** le brouillon : intercalée entre le
    // corps et la demande, elle se lisait comme la fin du message et se
    // retrouvait recopiée dedans.
    expect(message.indexOf("[Signataire")).toBeLessThan(message.indexOf("[Brouillon actuel"));
  });

  it("reste lisible sans signataire — le champ est facultatif", () => {
    const message = composeMessage(
      { id: "c_1", name: "X" },
      { subject: "O", body: "Corps." },
      "plus court",
    );
    expect(message).toContain("plus court");
    expect(message).not.toContain("[Signataire");
  });
});
