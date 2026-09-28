import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * **`{notresite}` se substitue à un seul endroit, et le lien reste direct.**
 *
 * Les trois défauts que cette garde ferme ne lèvent rien, ne cassent aucun type
 * et ne font rougir aucun test :
 *
 * 1. **une seconde substitution** — un écran ou une route qui remplacerait la
 *    balise de son côté ferait diverger l'aperçu de l'envoi, ou la partie texte
 *    de la partie HTML. C'est la famille de défauts payée aux jalons 55, 64, 66,
 *    74 et 85 ;
 * 2. **une redirection ou un paramètre dans le href** — mesurer les clics sur
 *    notre propre site depuis un courriel demanderait un jeton par destinataire,
 *    c'est-à-dire le pistage que le produit s'interdit (jalon 89) ;
 * 3. **un second libellé** — un champ saisi à côté de l'adresse afficherait un
 *    jour un domaine en pointant ailleurs, ce qu'un lecteur attentif lit comme
 *    une usurpation (jalon 62).
 *
 * Même famille que `cost-single-source`, `status-single-source` et
 * `video-link-source` : un défaut statique mérite une garde statique.
 */

const ROOT = path.join(__dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

/** Les fichiers autorisés à écrire la balise : le rendu, et ce qui la décrit. */
const ALLOWED = new Set([
  "lib/domain/merge-tags.ts",
  "lib/domain/our-site.ts",
  "lib/domain/__tests__/our-site.test.ts",
  "lib/domain/__tests__/merge-tags.test.ts",
  "components/settings/manual-step-editor.tsx",
  "components/settings/mail-panel.tsx",
  "tests/our-site-source.test.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(path.join(ROOT, dir))) {
    if (entry === "node_modules" || entry === ".next") continue;
    const rel = `${dir}/${entry}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

const FILES = [...walk("lib"), ...walk("app"), ...walk("components"), ...walk("tests")];

describe("une seule substitution de {notresite}", () => {
  it("aucun fichier hors du rendu ne remplace la balise", () => {
    const offenders = FILES.filter((file) => {
      if (ALLOWED.has(file)) return false;
      const source = read(file);
      return /replaceAll\(\s*"\{notresite\}"|replace\(\s*"\{notresite\}"|replace\(\s*\/\\?\{notresite/.test(
        source,
      );
    });
    expect(
      offenders,
      `Ces fichiers substituent {notresite} hors de renderTemplate : ${offenders.join(", ")}. ` +
        `Une seconde substitution ferait diverger l'aperçu de l'envoi.`,
    ).toEqual([]);
  });

  it("le rendu la substitue dans le corps et dans l'objet", () => {
    const tags = read("lib/domain/merge-tags.ts");
    expect(tags).toContain('.replaceAll("{notresite}"');
    // Deux occurrences : `renderTemplate` et `renderSubject`. Un objet qui
    // garderait la balise l'enverrait telle quelle dans un en-tête.
    expect(tags.split('.replaceAll("{notresite}"').length - 1).toBe(2);
  });
});

describe("le lien est direct, et il n'a qu'une source", () => {
  const format = read("lib/domain/email-format.ts");
  const site = read("lib/domain/our-site.ts");
  const mail = read("lib/api/mail.ts");

  it("l'ancre porte l'adresse réglée, sans rien y accrocher", () => {
    const body = format.slice(format.indexOf("export function withOurSiteLink"));
    const fn = body.slice(0, body.indexOf("\n}\n"));
    expect(fn).toContain('<a href="${needle}">');
    // Le href est l'adresse réglée, au caractère près : aucun paramètre accroché.
    expect(fn).not.toMatch(/href="\$\{needle\}[^"]/);
    for (const forbidden of ["clickUrl", "utm", "/api/l/", "trackToken"]) {
      expect(fn, `withOurSiteLink ne doit pas contenir « ${forbidden} »`).not.toContain(forbidden);
    }
  });

  it("l'envoi pose l'ancre après le logo, et le pixel reste le dernier", () => {
    const anchor = mail.indexOf("withOurSiteLink(");
    const logo = mail.indexOf("withSignatureLogo(");
    const pixel = mail.indexOf("withTrackingPixel(html");
    expect(anchor).toBeGreaterThan(-1);
    expect(logo).toBeGreaterThan(anchor);
    expect(pixel).toBeGreaterThan(anchor);
  });

  it("le libellé est dérivé, jamais un second champ", () => {
    expect(site).toContain("export function ourSiteLabel");
    // Une colonne de libellé à côté de l'adresse pourrait la contredire.
    // Aucune **colonne** de libellé : le mot peut figurer dans un commentaire
    // qui explique justement pourquoi elle n'existe pas.
    expect(read("prisma/schema.prisma")).not.toMatch(/ourSiteLabel\s+String/);
    const labels = FILES.filter(
      (file) =>
        !ALLOWED.has(file) &&
        file !== "lib/domain/our-site.ts" &&
        /function ourSiteLabel/.test(read(file)),
    );
    expect(labels, "le libellé ne se calcule qu'à un endroit").toEqual([]);
  });
});

describe("la balise est reconnue", () => {
  it("elle figure dans le vocabulaire, donc jamais signalée comme inconnue", () => {
    const tags = read("lib/domain/merge-tags.ts");
    expect(tags).toContain('tag: "{notresite}"');
    expect(tags).toContain('{ tag: "{notresite}"');
  });
});
