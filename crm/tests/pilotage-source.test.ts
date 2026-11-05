import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * **Aucun chiffre du tableau de bord ne se calcule hors de `lib/domain/`.**
 *
 * C'est la garde que le jalon 109 a demandée, et elle est **statique** parce
 * que le défaut l'est : une seconde addition juste de son côté ne lève rien, ne
 * fait échouer aucun type, et ne devient visible qu'en comparant deux écrans à
 * l'œil. Les jalons 49, 78 et 105 l'ont payé trois fois — une pastille et la
 * liste qu'elle ouvrait comptaient des choses différentes.
 *
 * Elle lit la source **à l'exécution** plutôt qu'une liste recopiée : une
 * constante finirait par ne plus décrire les fichiers qu'elle prétend décrire.
 * Les commentaires sont retirés avant l'examen, sinon la garde attraperait sa
 * propre documentation (leçon du jalon 52).
 */

const ROOT = path.join(__dirname, "..");

function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function sourceOf(relative: string): string {
  return strip(readFileSync(path.join(ROOT, relative), "utf8"));
}

function filesIn(relative: string): string[] {
  const dir = path.join(ROOT, relative);
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) out.push(...filesIn(next));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(next);
  }
  return out;
}

const PAGES = filesIn("app/(crm)/pilotage");
const VIEWS = filesIn("components/pilotage");

describe("le tableau de bord ne calcule rien", () => {
  it("couvre bien les deux écrans et les cinq vues", () => {
    // Sans cette vérification, renommer un dossier rendrait la garde verte en
    // n'examinant plus rien.
    expect(PAGES.length).toBeGreaterThanOrEqual(2);
    expect(VIEWS.length).toBeGreaterThanOrEqual(5);
  });

  /**
   * Une addition, une déduplication ou une requête dans un écran de mesure est
   * une **seconde définition** : c'est ainsi qu'une campagne et la page des
   * emails ont fini par afficher deux nombres sur les mêmes gens (jalon 54).
   */
  it("n'additionne, ne dédoublonne et n'interroge nulle part", () => {
    for (const file of [...PAGES, ...VIEWS]) {
      const source = sourceOf(file);
      expect(source, `${file} : .reduce( est une addition`).not.toMatch(/\.reduce\s*\(/);
      expect(source, `${file} : new Set() est une définition de « personnes »`).not.toMatch(
        /new Set\s*\(/,
      );
      expect(source, `${file} : aucune requête dans un écran`).not.toMatch(/prisma\s*\./);
      expect(source, `${file} : la base ne s'importe pas ici`).not.toContain("@/lib/db");
    }
  });

  /**
   * Les pages ne **choisissent** pas non plus les lignes qui comptent : le
   * bornage à la période vit dans `slice`, et le pourcentage dans `rateLabel`.
   * Les vues ont droit à de la géométrie (largeur d'une barre, hauteur d'un
   * rectangle) : c'est du dessin, pas un chiffre.
   */
  it("laisse au domaine le bornage à la période et les pourcentages", () => {
    for (const file of PAGES) {
      const source = sourceOf(file);
      expect(source, `${file} : le bornage passe par slice()`).not.toMatch(/\.filter\s*\(/);
      expect(source, `${file} : un pourcentage se demande à rateLabel()`).not.toMatch(/\*\s*100/);
      expect(source, `${file} : la période vient de periodOf()`).toContain("periodOf");
      expect(source, `${file} : les lignes sont bornées par slice()`).toContain("slice(all, period)");
      expect(source, `${file} : les filtres passent par applyFilters()`).toContain("applyFilters");
      expect(source, `${file} : les chiffres viennent du domaine`).toContain(
        "@/lib/domain/pilotage",
      );
    }
  });

  /**
   * **Un chiffre et la liste qu'il ouvre sortent du même appel.** Les deux
   * pages passent par `metricResult`, avec les mêmes filtres et la même
   * période : il n'existe donc aucun ordre d'appel qui les sépare.
   */
  it("fait sortir la pastille et sa liste du même appel", () => {
    for (const file of PAGES) {
      expect(sourceOf(file), file).toContain("metricResult");
    }
  });

  it("ne garde aucune définition de taux dans les vues", () => {
    for (const file of VIEWS) {
      const source = sourceOf(file);
      // Un taux affiché vient de `rateLabel`, qui reçoit une part déjà
      // calculée. `toFixed` ou un `%` composé à la main serait un second
      // arrondi, donc un second chiffre.
      expect(source, `${file} : toFixed compose un taux`).not.toMatch(/toFixed\s*\(/);
    }
  });
});

/**
 * Ce que le jalon a retiré, et qui ne doit pas revenir par la fenêtre.
 *
 * Le test porte sur le **disque** : un écran de mesure recréé à côté de
 * `/pilotage` le ferait échouer, et c'est tout l'intérêt — « un seul tableau de
 * bord » est une promesse qu'un fichier suffit à rompre.
 */
describe("les anciens écrans de mesure ont disparu", () => {
  it("ne laisse ni « Ma performance », ni « Rapports », ni leurs services", () => {
    for (const gone of [
      "app/(crm)/performance",
      "app/(crm)/rapports",
      "components/performance",
      "components/charts",
      "components/reports",
      "lib/api/reports.ts",
      "lib/api/performance.ts",
      "lib/api/dm-lift.ts",
      "lib/domain/performance.ts",
      "lib/domain/dm-lift.ts",
      "lib/domain/funnel.ts",
    ]) {
      expect(existsSync(path.join(ROOT, gone)), gone).toBe(false);
    }
  });

  it("redirige les deux anciennes adresses vers /pilotage", () => {
    const config = sourceOf("next.config.ts");
    expect(config).toMatch(/source:\s*"\/performance"/);
    expect(config).toMatch(/source:\s*"\/rapports"/);
    const destinations = config.match(/destination:\s*"([^"]+)"/g) ?? [];
    expect(destinations).toHaveLength(2);
    for (const destination of destinations) expect(destination).toContain("/pilotage");
  });

  /**
   * **Les ouvertures ne sont plus un indicateur.** Rien n'est supprimé en base
   * — les chargements de pixel continuent d'être enregistrés et restent
   * visibles ligne à ligne sur une campagne — mais aucun chiffre du tableau de
   * bord ne les lit, parce qu'ils surestiment par construction (jalons 37, 43).
   */
  it("ne fait entrer aucune ouverture dans le pilotage", () => {
    for (const file of [...PAGES, ...VIEWS, "lib/domain/pilotage.ts", "lib/api/pilotage.ts"]) {
      const source = sourceOf(file);
      expect(source, `${file} : openCount`).not.toContain("openCount");
      expect(source, `${file} : firstOpenAt`).not.toContain("firstOpenAt");
      expect(source, `${file} : email_opened`).not.toContain("opened");
    }
  });

  it("garde l'entonnoir d'une campagne, qui n'a pas été retiré", () => {
    expect(existsSync(path.join(ROOT, "lib/api/email-stats.ts"))).toBe(true);
    expect(sourceOf("lib/api/email-stats.ts")).toContain("readFunnelFacts");
    expect(existsSync(path.join(ROOT, "components/campaigns/funnel-row.tsx"))).toBe(true);
  });
});

/**
 * Le journal est la **seule** source des chiffres.
 *
 * `lib/api/pilotage.ts` lit `outreach_events` et rien d'autre : si un chiffre
 * venait d'`email_sends` ou d'`activities`, il faudrait tenir deux comptages
 * sur les mêmes faits — exactement ce que le journal a été écrit pour éviter.
 */
describe("tout vient du journal", () => {
  it("ne lit les chiffres que dans outreach_events", () => {
    const source = sourceOf("lib/api/pilotage.ts");
    expect(source).toContain("readEventRows");
    // Et `readEventRows` ne lit que le journal. Le rattrapage, lui, a le droit
    // de lire les tables d'origine : c'est sa raison d'être, et il écrit dans
    // le journal au lieu de servir un écran.
    expect(sourceOf("lib/api/outreach-events.ts")).toContain("prisma.outreachEvent.findMany");
    for (const table of ["emailSend", "emailReply", "activity.findMany", "task.findMany"]) {
      expect(source, `${table} n'est pas une source de chiffres ici`).not.toContain(table);
    }
  });
});
