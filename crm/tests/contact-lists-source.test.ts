import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Une liste range, elle ne modifie rien.**
 *
 * Trois façons de rater ce jalon, et aucune ne lève, ne casse un type ni ne fait
 * rougir un test :
 *
 * 1. **une seconde résolution de sélection** — la primauté des fiches cochées
 *    sur le filtre est une règle subtile (jalon 54) ; réécrite pour les listes,
 *    la seconde version l'oublierait, et l'écran montrerait treize fiches pour
 *    en ranger cinq ;
 * 2. **un second tableau de contacts** pour la page d'une liste — il finirait
 *    par ne plus offrir les mêmes colonnes ni le même sélecteur, et c'est
 *    toujours le second qu'on oublie de compléter (jalons 55, 64 et 66) ;
 * 3. **un retrait qui touche la fiche** — retirer quelqu'un d'une liste, ou
 *    supprimer la liste, doit laisser le CRM exactement dans l'état où il
 *    était. Une écriture de trop ici ne se verrait qu'au moment où l'on
 *    chercherait un statut disparu.
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
    for (const file of ["lib/api/campaigns.ts", "lib/api/contact-lists.ts"]) {
      expect(sourceOf(file)).toMatch(/resolveSelectionIds\(/);
    }
  });

  it("aucune des deux ne la recompose", () => {
    // La version fautive : ré-évaluer le filtre soi-même, donc décider une
    // seconde fois si les cases l'emportent.
    for (const file of ["lib/api/campaigns.ts", "lib/api/contact-lists.ts"]) {
      expect(sourceOf(file)).not.toMatch(/parseContactsQuery\(/);
      expect(sourceOf(file)).not.toMatch(/listContacts\(/);
    }
  });

  it("les fiches cochées l'emportent, et c'est écrit une fois", () => {
    const resolver = sourceOf("lib/api/contact-selection.ts");
    expect(resolver).toMatch(/contactIds !== undefined && contactIds\.length > 0/);
  });
});

describe("un seul tableau de contacts, deux routes", () => {
  it("la page d'une liste appelle l'écran de /contacts", () => {
    const page = sourceOf("app/(crm)/listes/[id]/page.tsx");
    expect(page).toMatch(/<ContactsScreen/);
    // Un second tableau : une liste de colonnes recopiée dans la page.
    expect(page).not.toMatch(/CONTACT_COLUMNS|ContactsTable/);
  });

  it("l'écran accepte une portée de liste plutôt que d'en supposer une", () => {
    const screen = sourceOf("app/(crm)/contacts/screen.tsx");
    expect(screen).toMatch(/listScope\?:/);
    expect(screen).toMatch(/liste: listScope\.id/);
  });

  it("les liens de filtre suivent le chemin courant", () => {
    // Écrit en dur, « /contacts » ferait quitter la page d'une liste au premier
    // clic sur une puce — la liste filtrée disparaîtrait sous les doigts.
    const view = sourceOf("components/contacts/contacts-view.tsx");
    expect(view).toMatch(/const pathname = usePathname\(\)/);
    expect(view).not.toMatch(/router\.replace\(`\/contacts\?/);
  });
});

describe("retirer d'une liste ne touche pas la fiche", () => {
  const service = sourceOf("lib/api/contact-lists.ts");

  it("le service n'écrit jamais sur `contact`", () => {
    // Il **lit** les fiches encore vivantes avant d'insérer ; il ne les modifie
    // ni ne les supprime jamais.
    expect(service).not.toMatch(/prisma\.contact\.(update|updateMany|delete|deleteMany|create)/);
  });

  it("le retrait porte sur l'appartenance, et sur elle seule", () => {
    expect(service).toMatch(
      /prisma\.contactListMember\.deleteMany\(\{[\s\S]{0,160}listId: input\.listId/,
    );
  });

  it("supprimer la liste ne supprime que la liste", () => {
    const body = service.slice(service.indexOf("export async function deleteContactList"));
    expect(body).toMatch(/prisma\.contactList\.delete\(\{ where: \{ id \} \}\)/);
    expect(body.slice(0, body.indexOf("export async function", 10))).not.toMatch(/contact\./);
  });

  it("l'unicité vient de la base, pas d'une vérification", () => {
    // Une vérification applicative se ferait contourner par deux onglets.
    expect(service).toMatch(/skipDuplicates: true/);
  });
});

describe("une liste se sauvegarde", () => {
  it("elle figure dans l'export et dans le schéma de restauration", () => {
    const backup = sourceOf("lib/api/backup.ts");
    expect(backup).toMatch(/prisma\.contactList\.findMany\(\)/);
    expect(backup).toMatch(/contactLists: z\.array\(contactListRow\)\.optional\(\)/);
    // Une sauvegarde d'avant ce jalon ne doit pas effacer les listes.
    expect(backup).toMatch(/if \(payload\.contactLists !== undefined\)/);
  });
});
