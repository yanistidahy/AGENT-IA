import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Un seul export de contacts, et aucune seconde définition de statut.**
 *
 * Les quatre façons de défaire le jalon 108 ne lèvent rien, ne cassent aucun
 * type et ne font rougir aucun test :
 *
 * 1. **un second export** — une route ou un module de plus qui compose ses
 *    propres colonnes, et les deux fichiers divergent au premier ajout ;
 * 2. **un statut recomposé** — un libellé écrit dans l'export plutôt que lu de
 *    `resolveDisplayStatus`, et la colonne contredit l'écran. C'est l'écart que
 *    le jalon 27 a mesuré sur 110 fiches ;
 * 3. **une seconde lecture des contacts** — l'export cesse de passer par
 *    `listContacts`, et le fichier ne contient plus ce que l'écran montre ;
 * 4. **une écriture** — un export qui écrit n'est plus une consultation
 *    (jalon 8).
 *
 * Même famille que `status-single-source`, `cost-single-source`,
 * `campaign-funnel-source` et `reply-stop-source`.
 */

const ROOT = path.join(__dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const route = read("app/api/contacts/export/route.ts");
const writer = read("lib/api/csv-export.ts");
const extras = read("lib/api/contact-export.ts");
const shape = read("lib/domain/contact-export.ts");
const csv = read("lib/domain/csv.ts");

describe("il n'existe qu'un export de contacts", () => {
  it("une seule route le sert", () => {
    // Un second point d'entrée serait un second jeu de colonnes à tenir.
    const routes = ["app/api/contacts/export/route.ts"];
    for (const file of routes) expect(read(file)).toContain("contactsToCsv(");
    expect(route).toContain("csvResponse(");
  });

  it("un seul module compose les lignes de contact", () => {
    for (const file of [route, extras]) {
      expect(file).not.toContain('"Prénom"');
      expect(file).not.toContain("EXPORT_HEADERS");
    }
    expect(writer).toContain("EXPORT_HEADERS");
  });

  it("les en-têtes vivent dans le domaine, pas dans le service", () => {
    expect(shape).toContain("export const IMPORT_HEADERS");
    expect(shape).toContain("export const DERIVED_HEADERS");
    // Pur : la forme du fichier se teste sans base.
    expect(shape).not.toContain("prisma");
    expect(shape).not.toContain("server-only");
  });
});

describe("l'export réutilise les prédicats du produit", () => {
  it("le statut vient de la fonction qui décide de celui de l'écran", () => {
    expect(writer).toContain("resolveDisplayStatus(contact)");
    // Jamais un libellé de statut écrit à la main dans l'export.
    for (const invented of ["Jamais contacté", "A répondu", "Contacté"]) {
      expect(writer, invented).not.toContain(`"${invented}"`);
    }
  });

  it("le groupe et le canal lisent les libellés partagés", () => {
    expect(writer).toContain("groupLabel(");
    expect(writer).toContain("ACTIVITY_LABELS[");
    // « DM Instagram » écrit ici ferait deux vocabulaires pour un canal.
    expect(writer).not.toContain('"Instagram"');
  });

  it("« a répondu » réunit les deux sources par le prédicat du jalon 106", () => {
    expect(extras).toContain("latestReply(");
    expect(extras).toContain("replyFloor(");
    expect(extras).toContain("prisma.emailReply.findMany");
    expect(extras).toContain("prisma.activity.findMany");
  });

  it("« prospect chaud » vient de la source unique, jamais d'un second calcul", () => {
    expect(extras).toContain("readHotProspects(");
    for (const rebuilt of ["emailLinkClick", "HOT_WINDOW_DAYS"]) {
      expect(extras, rebuilt).not.toContain(rebuilt);
    }
  });

  it("la campagne en cours lit la constante d'état du jalon 106", () => {
    expect(extras).toContain("SENDING_ENROLLMENT_STATUS");
    expect(extras).not.toContain('status: "active"');
  });
});

describe("l'export exporte ce que l'écran montre", () => {
  it("la route passe par le chemin de la page, filtres compris", () => {
    expect(route).toContain("parseContactsQuery(request.nextUrl.searchParams)");
    expect(route).toContain("listContacts(query.data");
    // Une clause Prisma écrite ici contournerait les filtres de l'écran.
    expect(route).not.toContain("prisma.");
  });
});

describe("l'export ne change rien en base", () => {
  it("aucune écriture dans la lecture des faits dérivés", () => {
    for (const write of ["create", "update", "delete", "upsert", "$transaction"]) {
      expect(extras, write).not.toContain(`.${write}(`);
    }
  });

  it("ni dans la route ni dans l'écrivain", () => {
    for (const file of [route, writer]) {
      for (const write of ["create", "update", "delete", "upsert"]) {
        expect(file, write).not.toContain(`.${write}(`);
      }
    }
  });
});

describe("le fichier s'ouvre dans Excel français", () => {
  it("BOM UTF-8, point-virgule, et les formules désamorcées", () => {
    expect(writer).toContain("\\uFEFF");
    expect(csv).toContain('.join(";")');
    expect(csv).toContain("export function neutralize");
    // La neutralisation est appliquée par l'écrivain, donc par les deux exports.
    expect(csv).toContain("escapeCell(neutralize(value))");
  });

  it("les dates sont au format français", () => {
    expect(writer).toContain("formatDayFr(");
    // L'ISO était le format d'avant : il s'affiche en texte dans Excel français.
    expect(writer).not.toContain("toISOString().slice(0, 10)");
  });
});
