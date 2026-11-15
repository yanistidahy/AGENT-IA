import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Jalon 115 : le trafic, visible partout et saisissable sur place.**
 *
 * Ce que seul un navigateur établit ici, et que les tests unitaires ne peuvent
 * pas dire :
 *
 * 1. **les cinq bornes s'affichent comme la règle les range.** `sizeBucketOf`
 *    est juste dans son test ; ce qui compte est que la badge de la fiche dise
 *    la même chose, sur des marques réelles aux valeurs exactes du brief ;
 * 2. **taper un nombre met à jour la badge sans rechargement**, et le nombre
 *    survit à une synchronisation lemlist ;
 * 3. **le collage de 5 lignes en met 3 à jour, n'en crée aucune, et nomme les
 *    2 orphelines** — le compte de sociétés avant et après le prouve ;
 * 4. **« 8 000 » insécable, « 8k » et « 8,5k » entrent**, « beaucoup » est
 *    refusé **avec un message à l'écran** ;
 * 5. **la puce « Trafic non renseigné » compte ce qu'elle liste**, et le
 *    bandeau de l'onglet Segments annonce le même nombre ;
 * 6. **à 390 px comme à 1440 px**, le champ est atteignable — `reachable()`,
 *    qui interroge le document au centre de l'élément, et non `isVisible()`.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] trafic ignoré : ni Chromium ni E2E_PASSWORD");
}

/**
 * **Les valeurs semées, reposées avant chaque passage.**
 *
 * Ce fichier **écrit** dans la base : il tape des trafics et en importe. Sans
 * remise à l'état initial, le second passage mesurerait l'effet du premier — un
 * import qui annonce « 2 mises à jour » au lieu de 3 parce qu'une ligne était
 * déjà à jour n'est pas une régression, c'est un test qui se marche dessus.
 * Reposer les sept fixtures coûte sept `update` et rend le fichier rejouable.
 */
const SEEDED: ReadonlyArray<readonly [string, number | null, string]> = [
  ["recette-115-borne-1999", 1_999, "crm"],
  ["recette-115-borne-2000", 2_000, "crm"],
  ["recette-115-borne-10000", 10_000, "crm"],
  ["recette-115-borne-10001", 10_001, "crm"],
  ["recette-115-borne-vide", null, ""],
  ["recette-115-import-domaine", null, ""],
  ["recette-115-import-nom", null, ""],
];

async function reseed(): Promise<void> {
  for (const [id, monthlyVisitors, visitorsSource] of SEEDED) {
    await prisma.company.update({ where: { id }, data: { monthlyVisitors, visitorsSource } });
  }
}

/** Les fixtures de bornes posées par `backups/recette/seed115.ts`. */
const BORNES: ReadonlyArray<readonly [string, string, string]> = [
  ["recette-115-borne-1999", "micro", "Moins de 2 000"],
  ["recette-115-borne-2000", "small", "Petite marque"],
  ["recette-115-borne-10000", "small", "Petite marque"],
  ["recette-115-borne-10001", "large", "Grosse marque"],
  ["recette-115-borne-vide", "unknown", "Trafic non renseigné"],
];

/** Ouvre la fiche d'une société dans `/societes` et rend sa badge. */
async function openCompany(page: Page, id: string) {
  await page.goto(`${BASE_URL}/societes?fiche=${encodeURIComponent(id)}`, {
    waitUntil: "domcontentloaded",
  });
  const badge = page.locator(`[data-visitors-badge="${id}"]`).last();
  await badge.scrollIntoViewIfNeeded();
  return badge;
}

describeBrowser("le trafic d'une marque", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    await reseed();
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  /** Item 1 du test d'acceptation, lu dans le DOM et non dans une fonction. */
  it("range les cinq bornes du brief, et l'écran le dit", async () => {
    const { page } = session;
    for (const [id, bucket, text] of BORNES) {
      const badge = await openCompany(page, id);
      expect(await reachable(badge), id).toBe(true);
      expect(await badge.getAttribute("data-visitors-bucket"), id).toBe(bucket);
      expect((await badge.innerText()).trim(), id).toContain(text);
    }
  }, 180_000);

  /**
   * Item 3 : la badge suit la saisie **sans rechargement**, et la valeur
   * survit à une synchronisation lemlist.
   */
  it("met à jour la badge à la saisie, et la valeur survit à la synchronisation", async () => {
    const { page } = session;
    const id = "recette-115-borne-vide";
    await prisma.company.update({
      where: { id },
      data: { monthlyVisitors: null, visitorsSource: "" },
    });

    const badge = await openCompany(page, id);
    expect(await badge.getAttribute("data-visitors-bucket")).toBe("unknown");

    const edit = page.locator(`[data-visitors-edit="${id}"]`).last();
    expect(await reachable(edit)).toBe(true);
    await edit.click();

    const input = page.locator(`[data-visitors-input="${id}"]`).last();
    expect(await reachable(input)).toBe(true);
    await input.fill("24000");
    await page.locator(`[data-visitors-save="${id}"]`).last().click();

    // **Sans rechargement** : la même page, la même instance de composant.
    await expect
      .poll(
        async () =>
          page.locator(`[data-visitors-badge="${id}"]`).last().getAttribute("data-visitors"),
        { timeout: 15_000 },
      )
      .toBe("24000");
    const after = page.locator(`[data-visitors-badge="${id}"]`).last();
    expect((await after.innerText()).trim()).toContain("Grosse marque");
    expect(await after.getAttribute("data-visitors-bucket")).toBe("large");

    // Et en base : la provenance devient « saisi », donc la synchronisation ne
    // l'écrasera pas (`syncMayWrite`).
    const stored = await prisma.company.findUniqueOrThrow({
      where: { id },
      select: { monthlyVisitors: true, visitorsSource: true },
    });
    expect(stored.monthlyVisitors).toBe(24_000);
    expect(stored.visitorsSource).toBe("crm");

    /*
      **La synchronisation ne peut pas la reprendre.** On ne la lance pas ici
      (il n'y a pas de clé lemlist dans cet environnement) : on vérifie la règle
      qui la gouverne, sur la valeur réellement stockée, avec la fonction que la
      synchronisation appelle.
    */
    const { syncMayWrite } = await import("../../lib/domain/company-profile");
    expect(
      syncMayWrite({ filled: stored.monthlyVisitors !== null, source: stored.visitorsSource }),
    ).toBe(false);
  }, 120_000);

  /** Item 5 : les écritures acceptées, et le refus qui se voit. */
  it("accepte 8 000 insécable, 8k et 8,5k, et refuse « beaucoup » avec un message", async () => {
    const { page } = session;
    const id = "recette-115-borne-2000";

    for (const [typed, expected] of [
      ["8 000", "8000"],
      ["8k", "8000"],
      ["8,5k", "8500"],
    ] as const) {
      await openCompany(page, id);
      await page.locator(`[data-visitors-edit="${id}"]`).last().click();
      const input = page.locator(`[data-visitors-input="${id}"]`).last();
      await input.fill(typed);
      await page.locator(`[data-visitors-save="${id}"]`).last().click();
      await expect
        .poll(
          async () =>
            page.locator(`[data-visitors-badge="${id}"]`).last().getAttribute("data-visitors"),
          { timeout: 15_000 },
        )
        .toBe(expected);
    }

    // « beaucoup » : refusé **à l'écran**, jamais rangé à zéro.
    await openCompany(page, id);
    await page.locator(`[data-visitors-edit="${id}"]`).last().click();
    await page.locator(`[data-visitors-input="${id}"]`).last().fill("beaucoup");
    await page.locator(`[data-visitors-save="${id}"]`).last().click();

    const error = page.locator("[data-visitors-error]").last();
    expect(await reachable(error), "le refus ne se voit pas").toBe(true);
    expect(await error.innerText()).toContain("beaucoup");

    const stored = await prisma.company.findUniqueOrThrow({
      where: { id },
      select: { monthlyVisitors: true },
    });
    expect(stored.monthlyVisitors, "« beaucoup » a été rangé en base").toBe(8_500);

    // On repose la borne pour les autres tests.
    await prisma.company.update({
      where: { id },
      data: { monthlyVisitors: 2_000, visitorsSource: "crm" },
    });
  }, 180_000);

  /** Item 4 : 5 lignes, 3 rapprochées, 0 création, 2 nommées. */
  it("importe 5 lignes dont 3 rapprochées, sans créer aucune société", async () => {
    const { page } = session;
    // Les trois cibles du collage sont reposées : la troisième ligne vise la
    // borne 10001, qu'un passage précédent a pu remplir.
    await reseed();
    const before = await prisma.company.count();

    await page.goto(`${BASE_URL}/societes`, { waitUntil: "domcontentloaded" });
    const open = page.locator("[data-visitors-import-open]");
    await open.scrollIntoViewIfNeeded();
    expect(await reachable(open)).toBe(true);
    await open.click();

    const area = page.locator("[data-visitors-import-text]");
    expect(await reachable(area)).toBe(true);
    await area.fill(
      [
        "Domaine;Visiteurs",
        "import-domaine.fr;8000",
        "import accentué;12 000",
        "borne10001.fr;20000",
        "maison-inconnue.fr;5000",
        "Société Fantôme;900",
      ].join("\n"),
    );

    await page.locator("[data-visitors-import-simulate]").click();
    await expect
      .poll(async () => page.locator("[data-visitors-report]").count(), { timeout: 15_000 })
      .toBe(1);

    const read = page.locator("[data-visitors-report-read]");
    expect(await read.innerText()).toBe("5");
    expect(await page.locator("[data-visitors-report-updated]").innerText()).toBe("3");
    expect(await page.locator("[data-visitors-report-unmatched]").innerText()).toBe("2");

    // Les deux orphelines sont **nommées**, pas seulement comptées.
    const problems = await page
      .locator('[data-visitors-problem="unmatched"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
    expect(problems).toHaveLength(2);
    expect(problems.join(" ")).toContain("maison-inconnue.fr");
    expect(problems.join(" ")).toContain("Société Fantôme");

    // Rien n'a encore été écrit : simuler, c'est lire.
    expect(
      (
        await prisma.company.findUniqueOrThrow({
          where: { id: "recette-115-import-domaine" },
          select: { monthlyVisitors: true },
        })
      ).monthlyVisitors,
    ).toBeNull();

    const apply = page.locator("[data-visitors-import-apply]");
    expect(await reachable(apply)).toBe(true);
    await apply.click();
    await expect
      .poll(async () => page.locator("[data-visitors-report] .text-win-d").count(), {
        timeout: 20_000,
      })
      .toBe(1);

    // Exactement 3 mises à jour, et **aucune société créée**.
    expect(await prisma.company.count(), "l'import a créé une société").toBe(before);
    const touched = await prisma.company.findMany({
      where: { id: { in: ["recette-115-import-domaine", "recette-115-import-nom"] } },
      select: { id: true, monthlyVisitors: true, visitorsSource: true },
      orderBy: { id: "asc" },
    });
    expect(touched.map((row) => row.monthlyVisitors)).toEqual([8_000, 12_000]);
    expect(touched.map((row) => row.visitorsSource)).toEqual(["import", "import"]);
  }, 180_000);

  /** Item 6 : la puce compte ce qu'elle liste, et le bandeau dit le même nombre. */
  it("fait coïncider la puce, sa liste et le bandeau des segments", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/societes?filter=sansTrafic`, { waitUntil: "domcontentloaded" });

    const chip = page.locator('[data-chip-count="sansTrafic"]');
    await chip.scrollIntoViewIfNeeded();
    expect(await reachable(chip)).toBe(true);
    const counted = Number((await chip.innerText()).replace(/[()\s]/g, ""));
    expect(Number.isFinite(counted)).toBe(true);

    // Le tableau de bureau rend une ligne par société ; la liste en cartes rend
    // la même population sous `lg`. On compte les lignes du tableau.
    const rows = await page.locator("tbody tr").count();
    expect(rows, "la puce et sa liste ne comptent pas la même chose").toBe(counted);

    // Et toutes les lignes listées portent bien une badge « non renseigné ».
    const buckets = await page
      .locator("tbody tr [data-visitors-badge]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-visitors-bucket")));
    expect(new Set(buckets)).toEqual(new Set(["unknown"]));

    // Le bandeau de l'onglet Segments annonce le même nombre, et il y mène.
    await page.goto(`${BASE_URL}/pilotage/segments`, { waitUntil: "domcontentloaded" });
    const banner = page.locator("[data-coverage-companies]");
    await banner.scrollIntoViewIfNeeded();
    expect(await reachable(banner)).toBe(true);
    expect(Number(await banner.getAttribute("data-coverage-companies"))).toBe(counted);
    expect(await banner.getAttribute("href")).toContain("filter=sansTrafic");
  }, 120_000);

  /** Item 4 du brief : deux cartes, et les puces de côté quand elles portent. */
  it("ne compare plus que deux tranches sur l'onglet Segments", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/segments`, { waitUntil: "domcontentloaded" });

    const cards = page.locator("[data-size-card]");
    expect(await cards.count()).toBe(2);
    const labels = await cards.evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
    expect(labels.join(" ")).toContain("Petites");
    expect(labels.join(" ")).toContain("Grosses");
    // « Intermédiaires » a disparu de l'écran, pas seulement du code.
    expect(await page.locator("body").innerText()).not.toContain("Intermédiaire");
  }, 120_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});

describeBrowser("le trafic sur un téléphone", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  /**
   * **390 × 844 : la saisie reste atteignable.**
   *
   * Le tableau passe en cartes sous `lg` (jalon 46) ; la cellule de saisie doit
   * donc exister **dans la carte** et pas seulement dans le tableau, sinon le
   * geste du jalon 115 n'existe pas sur un téléphone.
   */
  it("laisse le champ à portée du pouce dans la liste en cartes", async () => {
    const { page } = session;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/societes?filter=sansTrafic`, { waitUntil: "domcontentloaded" });

    /*
      **La puce d'abord** : c'est elle qui mène à la liste de travail, et c'est
      elle qui manquait. Mesuré à 390 px avant correction : la quatrième puce
      tombait hors du groupe `overflow-hidden`, donc invisible et inatteignable
      — le défaut du jalon 60, à l'identique.
    */
    const chip = page.locator('[data-company-chip="sansTrafic"]');
    await chip.scrollIntoViewIfNeeded();
    expect(await reachable(chip), "la puce du trafic est rognée sur mobile").toBe(true);

    const edit = page.locator("[data-visitors-edit]").first();
    await edit.scrollIntoViewIfNeeded();
    expect(await reachable(edit), "la saisie est hors de portée sur mobile").toBe(true);

    // Et aucun débordement horizontal : la page se lit sans balayer de côté.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "la page déborde horizontalement").toBeLessThanOrEqual(1);
  }, 120_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
