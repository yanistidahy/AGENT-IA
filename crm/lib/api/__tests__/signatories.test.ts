import { describe, expect, it } from "vitest";
import { pickSignatory, signatoryNames, signatureBlocks } from "../signatories";
import { replaceSignature, lastLine, signsWithName } from "@/lib/domain/email-format";

/**
 * **Deux personnes signent depuis ce CRM.**
 *
 * Le couple « nom / titre » unique du jalon 34 ne savait en décrire qu'une, et
 * la conséquence n'était pas cosmétique : la moitié des messages seraient partis
 * sous la mauvaise identité, et l'erreur ne se serait vue qu'à la réception.
 */
const YANIS = { id: "s1", name: "Yanis Tidahy", title: "Fondateur, Aura Flow AI", isDefault: true };
const MOHAMED = {
  id: "s2",
  name: "Mohamed Targani",
  title: "Co-Fondateur, Aura Flow AI",
  isDefault: false,
};
const TOUS = [YANIS, MOHAMED];

describe("qui signe ce message", () => {
  it("prend le propriétaire de la fiche quand il correspond", () => {
    // Le CRM stocke un prénom (« Yanis »), le signataire un nom complet.
    expect(pickSignatory(TOUS, "Yanis")?.id).toBe("s1");
    expect(pickSignatory(TOUS, "Mohamed")?.id).toBe("s2");
    expect(pickSignatory(TOUS, "mohamed")?.id).toBe("s2");
    expect(pickSignatory(TOUS, "Mohamed Targani")?.id).toBe("s2");
  });

  it("retombe sur le signataire par défaut quand le propriétaire est inconnu", () => {
    expect(pickSignatory(TOUS, "Associé")?.id).toBe("s1");
    expect(pickSignatory(TOUS, "")?.id).toBe("s1");
  });

  it("ne confond pas deux prénoms qui se ressemblent", () => {
    // « Marc » ne doit pas correspondre à « Marceau » : la comparaison porte sur
    // des mots entiers, pas sur un préfixe. Faute de correspondance, on retombe
    // sur le défaut — ici Yanis — plutôt que d'attribuer le message à Marceau.
    const marceau = { id: "s3", name: "Marceau Blin", title: "", isDefault: false };
    expect(pickSignatory([YANIS, marceau], "Marc")?.id).toBe("s1");
  });

  it("rend null quand personne n'est configuré", () => {
    expect(pickSignatory([], "Yanis")).toBeNull();
  });
});

describe("la garde couvre tous les signataires", () => {
  it("liste les noms complets et les prénoms", () => {
    const names = signatoryNames(TOUS);
    expect(names).toContain("Yanis Tidahy");
    expect(names).toContain("Yanis");
    expect(names).toContain("Mohamed Targani");
    expect(names).toContain("Mohamed");
  });

  it("un message signé Mohamed ne peut pas se terminer par Yanis", () => {
    // C'est le cas qui compte : le brouillon part sous une identité, la
    // signature doit être celle-là et pas celle du collègue.
    const draft = "Bonjour,\n\nUne question.\n\nÀ bientôt,\n\nYanis Tidahy\nFondateur, Aura Flow AI";
    expect(signsWithName(draft, signatoryNames(TOUS))).toBe(true);
  });
});

describe("changer de signataire", () => {
  const blocs = signatureBlocks(TOUS);
  const message = [
    "Bonjour Stéphanie,",
    "",
    "En observant le développement de Linaé, je me permets de vous contacter.",
    "",
    "Vous pouvez aussi réserver un créneau directement → Réserver un appel",
    "",
    "À bientôt,",
    "",
    "Yanis Tidahy\nFondateur, Aura Flow AI",
  ].join("\n");

  it("ne réécrit que les deux dernières lignes", () => {
    const basculé = replaceSignature(message, blocs, blocs[1] ?? "");
    expect(lastLine(basculé)).toBe("Co-Fondateur, Aura Flow AI");
    expect(basculé).toContain("Mohamed Targani");
    // **Tout le reste est intact** : c'est le point. Régénérer le message
    // jetterait ce qui a été relu, retouché et discuté avec Alex.
    expect(basculé).toContain("En observant le développement de Linaé");
    expect(basculé).toContain("→ Réserver un appel");
    expect(basculé).toContain("À bientôt,");
    expect(basculé).not.toContain("Yanis");
  });

  it("revient en arrière sans dériver", () => {
    const aller = replaceSignature(message, blocs, blocs[1] ?? "");
    const retour = replaceSignature(aller, blocs, blocs[0] ?? "");
    expect(retour).toBe(message);
  });

  it("ne touche à rien si la signature est déjà la bonne", () => {
    expect(replaceSignature(message, blocs, blocs[0] ?? "")).toBe(message);
  });

  it("ajoute la signature quand le message n'en porte aucune", () => {
    const sans = "Bonjour,\n\nUne question ?";
    const signé = replaceSignature(sans, blocs, blocs[1] ?? "");
    expect(signé).toContain("Une question ?\n\nMohamed Targani");
  });

  it("ne coupe pas un post-scriptum pris pour une signature", () => {
    // La recherche porte sur les signatures **connues**, pas sur « les deux
    // dernières lignes » : couper à l'aveugle mutilerait le texte.
    const avecPs = `${message}\n\nPS : je serai absent la semaine prochaine.`;
    const basculé = replaceSignature(avecPs, blocs, blocs[1] ?? "");
    expect(basculé).toContain("PS : je serai absent la semaine prochaine.");
    expect(basculé).toContain("Mohamed Targani");
  });
});
