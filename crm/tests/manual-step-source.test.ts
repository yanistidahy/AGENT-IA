import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Les trois façons de rater l'étape écrite à la main.**
 *
 * Aucune ne lève et aucune ne fait rougir un type — ce sont des silences, d'où
 * la garde statique (même famille que `campaign-reset-source`,
 * `signature-block-source` et `research-single-source`) :
 *
 * 1. **appeler le modèle sur le chemin manuel.** La promesse est « instantané et
 *    gratuit, pure substitution » : un appel glissé là serait facturé et lent
 *    sans que rien ne le dise ;
 * 2. **rendre l'aperçu autrement que la composition.** Deux rendus d'un même
 *    gabarit finissent par ne plus dire la même chose, et c'est toujours le
 *    second qu'on oublie de corriger (jalons 55, 64, 66, 74, 85). La route
 *    d'aperçu rend donc **des valeurs**, jamais du texte rendu ;
 * 3. **vider la file en touchant au passé.** Un envoi est un fait ; « Vider les
 *    départs » ne supprime que des brouillons jamais partis.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const departures = read("lib/api/departures.ts");
const manual = read("lib/api/manual-step.ts");
const previewRoute = read("app/api/sequences-email/preview/route.ts");
const editor = read("components/settings/manual-step-editor.tsx");
const clearRoute = read("app/api/departures/clear/route.ts");

describe("une étape manuelle n'appelle jamais le modèle", () => {
  it("la composition branche le mode avant toute rédaction", () => {
    expect(departures).toContain("toStepMode(");
    expect(departures).toContain("renderManualStep(");
    // Le brouillon d'Alex n'est atteignable que dans la branche `else` : le
    // mode est lu d'abord, et la branche manuelle rend son texte puis rejoint
    // la création du départ.
    expect(departures).toMatch(/if \(toStepMode\([\s\S]{0,200}renderManualStep\(/);
  });

  it("le rendu manuel est une pure substitution", () => {
    expect(manual).not.toContain("draftEmail");
    expect(manual).not.toContain("messages.create");
    expect(manual).not.toContain("messages.stream");
    expect(manual).not.toContain("researchCompany");
    expect(manual).toContain("renderTemplate(");
    expect(manual).toContain("renderSubject(");
  });

  it("mais les règles d'envoi ne sont pas contournées", () => {
    // Signature imposée et appel réparé, comme sur le chemin d'Alex.
    expect(manual).toContain("enforceSignature(");
    expect(manual).toContain("repairGreeting(");
    // Le départ manuel est un départ ordinaire : il passe par la même création
    // puis la même queue d'envoi, donc par tous les garde-fous du matin.
    expect(departures).toContain("sequenceDeparture.create");
  });
});

describe("l'aperçu et la composition partagent une seule définition", () => {
  it("la route d'aperçu ne rend que des valeurs de fusion", () => {
    expect(previewRoute).toContain("sampleContacts(");
    expect(previewRoute).not.toContain("renderTemplate");
    expect(previewRoute).not.toContain("renderSubject");
  });

  it("l'éditeur rend l'aperçu avec la fonction du domaine", () => {
    expect(editor).toContain('from "@/lib/domain/merge-tags"');
    expect(editor).toContain("renderTemplate(");
    expect(editor).toContain("renderSubject(");
    // Aucune substitution maison : un `replaceAll("{prenom}"…)` dans l'écran
    // serait exactement la seconde définition qu'on s'interdit.
    expect(editor).not.toMatch(/replace(All)?\(\s*["'`]\{/);
  });
});

describe("vider la file ne touche ni aux envois ni aux fiches", () => {
  it("clearDepartures ne supprime que des départs jamais partis", () => {
    expect(departures).toMatch(
      /sequenceDeparture\.deleteMany\(\{[\s\S]{0,200}status:\s*\{\s*in:\s*\["pending",\s*"failed"\]/,
    );
  });

  it("ni le service ni la route ne connaissent emailSend ou contact", () => {
    const clear = departures.slice(departures.indexOf("export async function clearDepartures"));
    expect(clear).not.toContain("emailSend");
    expect(clear).not.toContain("prisma.contact");
    expect(clear).not.toContain("prisma.activity");
    expect(clearRoute).not.toContain("emailSend");
    expect(clearRoute).not.toContain("contact.");
  });
});
