import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * **Un filtre personnalisé range, il ne modifie rien.**
 *
 * Quatre façons de rater ce jalon, et aucune ne lève, ne casse un type ni ne
 * fait rougir un test :
 *
 * 1. **une seconde résolution de sélection** — la primauté des fiches cochées
 *    sur le filtre est une règle subtile (jalon 54) ; réécrite ici, la seconde
 *    version l'oublierait, et l'écran montrerait treize fiches pour en ranger
 *    cinq ;
 * 2. **un second écran** — le jalon 79 supprime la route `/listes` du jalon 77
 *    précisément pour qu'il n'existe qu'un tableau de contacts. Le rail et les
 *    pages doivent donc rester muets sur elle ;
 * 3. **un retrait qui touche la fiche** — retirer quelqu'un d'un filtre, ou
 *    supprimer le filtre, doit laisser le CRM exactement dans l'état où il
 *    était. Une écriture de trop ici ne se verrait qu'au moment où l'on
 *    chercherait un statut disparu ;
 * 4. **un filtre qui ne se croise pas** — la clause vit dans `contactsWhere`
 *    avec les autres, donc elle se combine par construction. La sortir de là
 *    en ferait un filtre exclusif sans que rien ne le dise.
 *
 * Même famille que `campaign-funnel-source`, `campaign-removal-source` et
 * `research-single-source` : une garde statique pour un défaut statique.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("une seule résolution de sélection", () => {
  it("les deux destinations la demandent au même module", () => {
    for (const file of ["lib/api/campaigns.ts", "lib/api/custom-filters.ts"]) {
      expect(sourceOf(file)).toMatch(/resolveSelectionIds\(/);
    }
  });

  it("aucune des deux ne la recompose", () => {
    // La version fautive : ré-évaluer le filtre soi-même, donc décider une
    // seconde fois si les cases l'emportent.
    for (const file of ["lib/api/campaigns.ts", "lib/api/custom-filters.ts"]) {
      expect(sourceOf(file)).not.toMatch(/parseContactsQuery\(/);
      expect(sourceOf(file)).not.toMatch(/listContacts\(/);
    }
  });

  it("les fiches cochées l'emportent, et c'est écrit une fois", () => {
    const resolver = sourceOf("lib/api/contact-selection.ts");
    expect(resolver).toMatch(/contactIds !== undefined && contactIds\.length > 0/);
  });
});

describe("un seul écran : /contacts, et rien d'autre", () => {
  it("la route /listes du jalon 77 n'existe plus", () => {
    for (const gone of ["app/(crm)/listes", "components/lists", "app/api/lists"]) {
      expect(existsSync(path.join(ROOT, gone))).toBe(false);
    }
  });

  it("le rail n'en porte plus l'entrée", () => {
    expect(sourceOf("lib/navigation.ts")).not.toMatch(/"\/listes"/);
  });

  it("les puces vivent dans la barre de filtres de /contacts", () => {
    const chips = sourceOf("components/contacts/contacts-chips.tsx");
    expect(chips).toMatch(/<CustomFilterChips/);
    // Sur la **première** rangée : la seconde est un groupe `overflow-hidden`
    // qui rognerait le panneau posé en absolute (le défaut du jalon 60).
    const panel = chips.indexOf('expanded ? "flex" : "hidden"');
    expect(chips.indexOf("<CustomFilterChips")).toBeLessThan(panel);
  });
});

describe("retirer d'un filtre ne touche pas la fiche", () => {
  const service = sourceOf("lib/api/custom-filters.ts");

  it("le service n'écrit jamais sur `contact`", () => {
    // Il **lit** les fiches encore vivantes avant d'insérer ; il ne les modifie
    // ni ne les supprime jamais.
    expect(service).not.toMatch(/prisma\.contact\.(update|updateMany|delete|deleteMany|create)/);
  });

  it("le retrait porte sur l'appartenance, et sur elle seule", () => {
    expect(service).toMatch(
      /prisma\.customFilterMember\.deleteMany\(\{[\s\S]{0,180}filterId: input\.filterId/,
    );
  });

  it("supprimer le filtre ne supprime que le filtre", () => {
    const body = service.slice(service.indexOf("export async function deleteCustomFilter"));
    expect(body).toMatch(/prisma\.customFilter\.delete\(\{ where: \{ id \} \}\)/);
    expect(body.slice(0, body.indexOf("export const", 10))).not.toMatch(/prisma\.contact\./);
  });

  it("l'unicité vient de la base, pas d'une vérification", () => {
    // Une vérification applicative se ferait contourner par deux onglets.
    expect(service).toMatch(/skipDuplicates: true/);
  });
});

describe("le filtre se croise avec les autres", () => {
  it("sa clause vit dans `contactsWhere`, avec le cycle de vie et le reste", () => {
    const contacts = sourceOf("lib/api/contacts.ts");
    expect(contacts).toMatch(/customFilters: \{ some: \{ filterId: query\.filtre \} \}/);
    // Dans le `and` commun : c'est ce qui rend la combinaison automatique.
    expect(contacts).toMatch(/and\.push\(\{ customFilters:/);
  });
});

describe("un filtre personnalisé se sauvegarde", () => {
  it("il figure dans l'export et dans le schéma de restauration", () => {
    const backup = sourceOf("lib/api/backup.ts");
    expect(backup).toMatch(/prisma\.customFilter\.findMany\(\)/);
    expect(backup).toMatch(/customFilters: z\.array\(customFilterRow\)\.optional\(\)/);
    // Une sauvegarde d'avant ce jalon ne doit pas effacer les filtres.
    expect(backup).toMatch(/if \(payload\.customFilters !== undefined\)/);
  });
});
