import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * **Une réponse rapprochée qui ne produit rien doit se voir, et se réparer.**
 *
 * Deux défauts du jalon 44, tous deux dans `lib/api/inbox.ts`, tous deux muets :
 *
 * 1. `recordReply()` sortait dès qu'une ligne `email_replies` existait. Une
 *    réponse enregistrée alors que l'envoi n'avait aucune fiche restait donc
 *    sans interaction **définitivement** : rattacher la fiche ensuite ne
 *    changeait rien, le relevé suivant ressortait au même endroit. Le seul
 *    rattrapage possible passait par une écriture SQL à la main.
 * 2. Le rapport comptait cette réponse dans `replies`, donc « 1 réponse » côté
 *    relevé et « 0 réponse » côté `/emails` — deux écrans qui se contredisent
 *    sans que rien ne dise lequel a tort.
 *
 * Ces gardes sont statiques parce que les deux défauts le sont : ils ne
 * produisent ni exception, ni type invalide, ni test rouge — seulement un
 * silence. Même famille que `message-id-source` et `cost-single-source`.
 */
const SOURCE = readFileSync(join(__dirname, "..", "lib/api/inbox.ts"), "utf8");

describe("une réponse non consignée ne peut pas passer pour un succès", () => {
  it("la sortie anticipée exige que l'interaction existe **réellement**", () => {
    // `existing !== null` seul est le défaut : c'est la présence d'une
    // interaction, pas celle d'une ligne, qui prouve que le travail est fait.
    expect(SOURCE).toMatch(/existing !== null && existing\.activityId !== null/);
  });

  it("l'absence de fiche est rendue comme un échec nommé, pas comme une création", () => {
    expect(SOURCE).toMatch(/unlinked: true/);
    // Le chemin « sans fiche » doit sortir **avant** de compter une création.
    const unlinkedAt = SOURCE.indexOf("unlinked: true");
    const createdAt = SOURCE.indexOf("created: manual === null");
    expect(unlinkedAt).toBeGreaterThan(0);
    expect(createdAt).toBeGreaterThan(unlinkedAt);
  });

  it("le rapport porte le compteur et les adresses concernées", () => {
    // Sans les adresses, le bandeau dirait « 3 réponses perdues » sans dire
    // lesquelles — un compteur qu'on ne peut pas traiter.
    expect(SOURCE).toMatch(/readonly unlinked: number/);
    expect(SOURCE).toMatch(/readonly unlinkedAddresses: readonly string\[\]/);
    expect(SOURCE).toMatch(/unlinkedAddresses\.push/);
  });

  it("une ligne existante est **complétée**, jamais dupliquée", () => {
    // La clé d'idempotence reste le `Message-ID` : on met à jour la ligne
    // trouvée plutôt que d'en écrire une seconde.
    expect(SOURCE).toMatch(/prisma\.emailReply\.update\(/);
    expect(SOURCE).toMatch(/readonly repaired: boolean/);
  });
});
