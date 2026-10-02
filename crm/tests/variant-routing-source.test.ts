import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Router n'est pas classer, et un objet vide ne part jamais.**
 *
 * Trois défauts que rien ne ferait échouer autrement — ni le typage, ni une
 * exception, ni un test de rendu. Ils ont tous la même forme : deux chaînes
 * plausibles, un écran qui affiche une chose et un envoi qui en fait une autre.
 *
 * 1. **le routage écrit le groupe de la fiche.** Un `contact.update` glissé dans
 *    le chemin de routage compilerait parfaitement, et il reclasserait en
 *    silence les personnes dont on a seulement choisi le texte. Une fiche mal
 *    rangée survit ensuite à tous les recalculs (`manual`), et rien à l'écran ne
 *    dirait d'où vient le groupe ;
 * 2. **une seconde règle de routage.** L'aperçu et la composition doivent
 *    appeler `routedGroup` puis `templateFor` ; un écran qui trancherait
 *    lui-même montrerait une variante que l'envoi ne choisirait pas — c'est le
 *    défaut payé aux jalons 55, 66, 74 et 85 ;
 * 3. **un objet vide enregistré.** Le refus vit dans `saveSequence`, avant
 *    d'écrire : sans lui, un `Subject:` vide part, et un message sans objet
 *    n'arrive pas.
 *
 * Éprouvée sur les trois défauts exacts avant d'être livrée.
 */

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Le corps d'une fonction, pour ne juger que d'elle. */
function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start, `${name} introuvable`).toBeGreaterThan(-1);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("le routage choisit un texte, jamais un groupe", () => {
  it("le domaine ne connaît que des valeurs, il n'écrit rien", () => {
    const source = read("lib/domain/step-variants.ts");
    expect(source).toContain("export function routedGroup(");
    // Un module pur : ni Prisma, ni React, ni base. C'est ce qui garantit que
    // la règle sert l'aperçu **et** l'envoi sans pouvoir écrire au passage.
    expect(source).not.toContain("prisma");
    expect(source).not.toContain("contactGroup");
    expect(source).not.toContain("groupSetBy:");
  });

  it("l'écriture du routage ne touche que la campagne", () => {
    const body = bodyOf(read("lib/api/campaigns.ts"), "setCampaignOtherRouting");
    expect(body).toContain("prisma.campaign.update");
    for (const forbidden of [
      "prisma.contact.",
      "contact.update",
      "contactGroup",
      "groupSetBy",
      "recomputeGroups",
    ]) {
      expect(
        body,
        `setCampaignOtherRouting écrit « ${forbidden} » : router, c'est choisir un texte ; ` +
          "classer, c'est décrire une personne. Le groupe se corrige sur la fiche.",
      ).not.toContain(forbidden);
    }
  });

  it("la route d'action ne reclasse personne non plus", () => {
    const source = read("app/api/campaigns/actions/route.ts");
    expect(source).toContain("setCampaignOtherRouting(");
    expect(source).not.toContain("contactGroup");
    expect(source).not.toContain("groupSetBy");
  });

  it("le panneau de campagne règle le routage, il ne classe pas", () => {
    const source = read("components/campaigns/group-targeting.tsx");
    expect(source).toContain('action: "other-routing"');
    // Le seul geste de classement de cet écran reste « Recalculer les groupes »,
    // qui est explicite, nommé, et ne dépend d'aucune campagne.
    expect(source).toContain('action: "recompute"');
    expect(source).not.toMatch(/contactGroup\s*:/);
  });
});

describe("une seule règle de routage, appelée par les deux surfaces", () => {
  it("la composition route puis choisit, sans lire le groupe elle-même", () => {
    const source = read("lib/api/manual-step.ts");
    expect(source).toContain("routedGroup(");
    expect(source).toContain("templateFor(");
    // Pas de branche `=== "autre"` recopiée ici : elle vit dans `routedGroup`.
    expect(source).not.toContain('=== "autre"');
  });

  it("l'aperçu par groupe route de la même façon", () => {
    const source = read("components/settings/variant-tabs.tsx");
    expect(source).toContain("routedGroup(");
    expect(source).toContain("templateFor(");
  });

  it("la file des départs recalcule le routage à la lecture", () => {
    // Ce qu'on relit le matin doit dire ce que le destinataire va lire : le
    // routage d'une campagne peut avoir changé depuis la composition.
    const source = read("lib/api/departures.ts");
    expect(source).toContain("routedGroup(");
    expect(source).toContain("droppedSentences(");
  });
});

describe("jamais d'objet vide", () => {
  it("l'enregistrement refuse avant d'écrire, en nommant l'étape", () => {
    const source = read("lib/api/email-sequences.ts");
    /*
      Depuis le jalon 104 le verdict se lit sur le plan du décideur
      (`subjectForGroup`), qui connaît le mode de l'étape et la variante du
      groupe : `effectiveSubject` ne voyait ni l'un ni l'autre.
    */
    expect(source).toContain("subjectForGroup(");
    const guard = source.slice(0, source.indexOf("const saved = await prisma.$transaction"));
    expect(
      guard,
      "Le refus doit précéder la transaction : refuser après avoir écrit laisserait " +
        "une étape enregistrée avec un objet vide.",
    ).toContain("subjectForGroup(");
    expect(guard).toContain("un message sans objet n'arrive pas");
  });

  it("le repli de la variante est explicite, pas un hasard de lecture", () => {
    const source = read("lib/domain/step-variants.ts");
    expect(source).toContain("subjectFromStep");
    expect(source).toContain("export function subjectForGroup(");
    expect(source).toContain("export function describeSubjectPlan(");
  });

  it("l'aperçu dit quel objet partira", () => {
    expect(read("components/settings/variant-tabs.tsx")).toContain("describeSubjectPlan(");
  });
});

describe("la phrase retirée se voit aux trois endroits demandés", () => {
  it("l'aperçu de l'éditeur la montre", () => {
    const source = read("components/settings/manual-step-editor.tsx");
    expect(source).toContain("droppedSentences(");
    expect(source).toContain("Phrase retirée pour ce contact");
  });

  it("le panneau de campagne liste les destinataires concernés", () => {
    expect(read("components/campaigns/group-targeting.tsx")).toContain(
      "une phrase sera retirée de leur mail",
    );
    expect(read("lib/api/manual-step.ts")).toContain("export async function missingValueReports(");
  });

  it("la carte des départs du jour porte le même avertissement", () => {
    expect(read("components/sequences/departure-card.tsx")).toContain(
      "Phrase retirée pour ce contact",
    );
  });
});

describe("le menu d'aperçu liste tout le groupe", () => {
  it("plus aucune réduction à un contact par groupe", () => {
    const source = read("lib/api/manual-step.ts");
    // Le défaut exact : une `Map` par groupe plafonnait le menu à une entrée.
    expect(
      source,
      "`sampleContacts` ne doit plus réduire la liste à une fiche par groupe : " +
        "c'est ce qui rendait le menu « Aperçu pour » inutilisable.",
    ).not.toMatch(/new Map<string, SampleContact>/);
    expect(source).toContain("SAMPLE_LIMIT");
    // Le compte réel vient d'un `groupBy`, pas de la liste bornée.
    expect(source).toContain("prisma.contact.groupBy(");
    expect(source).toContain("nameKey");
  });

  it("l'écran affiche le compte du groupe", () => {
    const source = read("components/settings/manual-step-editor.tsx");
    expect(source).toContain("dans ce groupe");
    expect(source).toContain("samples.totals");
  });
});
