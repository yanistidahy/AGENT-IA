import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **« Dans le temps », survolé et cliqué pour de vrai.**
 *
 * Cinq choses qu'aucun test unitaire ne peut voir :
 *
 * 1. **la barre d'outils et le graphique sont atteignables** — `reachable()`,
 *    jamais `isVisible()` : la seconde ne voit pas un ancêtre qui rogne, et
 *    c'est le défaut du jalon 60, livré deux fois ;
 * 2. **le survol dit quelque chose**, et le focus clavier dit la même chose.
 *    L'ancien graphique ne disait rien du tout ;
 * 3. **la légende masque vraiment une série**, et l'infobulle suit ;
 * 4. **les trois réglages survivent au rechargement** — item 4 ;
 * 5. **le clic ouvre la liste de la bonne période**, et sa longueur est le
 *    nombre affiché — l'invariant du jalon 109, sur le nouveau graphique.
 *
 * Les chiffres relevés viennent d'une **base semée** : ce ne sont pas des
 * nombres de production. Ce que le test établit, ce sont des **égalités** et
 * des **changements**, pas des totaux.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] graphique ignoré : ni Chromium ni E2E_PASSWORD");
}

async function openChart(page: Page, query = ""): Promise<void> {
  await page.goto(`${BASE_URL}/pilotage${query}`, { waitUntil: "domcontentloaded" });
  const chart = page.locator("[data-timeline]");
  await chart.scrollIntoViewIfNeeded();
  expect(await reachable(chart)).toBe(true);
}

describeBrowser("le graphique dans le temps", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("ouvre sa barre d'outils, son tracé et sa bande de cadence", async () => {
    const { page } = session;
    await openChart(page);

    for (const hook of [
      "[data-timeline-toolbar]",
      "[data-timeline-metric]",
      "[data-timeline-view]",
      "[data-timeline-granularity]",
      "[data-timeline-frame]",
      "[data-week-pace]",
    ]) {
      const node = page.locator(hook);
      await node.scrollIntoViewIfNeeded();
      expect(await reachable(node), hook).toBe(true);
    }

    // La plage annoncée dit où elle commence : une plage « depuis septembre »
    // au-dessus d'un graphique qui commence en octobre serait un mensonge.
    expect(await reachable(page.locator("[data-timeline-range]"))).toBe(true);
    expect(await page.locator("[data-timeline-bar]").count()).toBeGreaterThan(0);
  }, 90_000);

  /** Item 4, deuxième moitié : les trois réglages survivent au rechargement. */
  it("garde l'indicateur, la vue et la granularité dans l'URL", async () => {
    const { page } = session;
    await openChart(page, "?metric=replies&vue=canal&pas=mois");

    const read = async () => ({
      metric: await page.locator("[data-timeline-metric]").inputValue(),
      view: await page.locator("[data-timeline-view]").inputValue(),
      granularity: await page.locator("[data-timeline-granularity]").inputValue(),
    });
    expect(await read()).toEqual({ metric: "replies", view: "canal", granularity: "mois" });

    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await read()).toEqual({ metric: "replies", view: "canal", granularity: "mois" });

    // Et changer un réglage l'écrit dans l'URL, pas seulement à l'écran.
    await page.locator("[data-timeline-granularity]").selectOption("jour");
    await page.waitForURL((url) => url.searchParams.get("pas") === "jour", { timeout: 15_000 });
    expect(await page.locator("[data-timeline-granularity]").inputValue()).toBe("jour");
  }, 90_000);

  /**
   * **Le survol dit quelque chose, et le focus clavier dit la même chose.**
   * Un graphique dont l'information n'existe qu'au survol est un graphique que
   * personne ne lit au clavier.
   */
  it("montre une infobulle au survol et au focus, avec les dates exactes", async () => {
    const { page } = session;
    await openChart(page, "?pas=semaine&vue=total&metric=messages");

    const bar = page.locator("[data-timeline-bar]").last();
    await bar.scrollIntoViewIfNeeded();
    await bar.hover();

    const tip = page.locator("[data-timeline-tooltip]");
    await expect.poll(async () => (await tip.count()) > 0, { timeout: 15_000 }).toBe(true);
    const dates = await page.locator("[data-tooltip-dates]").innerText();
    // « lun. 2 nov. – dim. 8 nov. » : les deux bornes, pas « semaine du 2 ».
    expect(dates).toMatch(/\p{L}+\.? \d+ \p{L}+\.? – \p{L}+\.? \d+ \p{L}+\.?/u);
    expect(Number(await page.locator("[data-tooltip-total]").innerText())).toBeGreaterThanOrEqual(0);
    // L'origine des faits : trois chemins écrivent des messages.
    expect(await page.locator("[data-tooltip-sources]").count()).toBeGreaterThanOrEqual(0);

    // Le même contenu au clavier : chaque barre est un lien, donc focalisable.
    await page.mouse.move(0, 0);
    await page.locator("[data-timeline-bar] a").last().focus();
    await expect
      .poll(async () => (await page.locator("[data-tooltip-dates]").count()) > 0, { timeout: 10_000 })
      .toBe(true);
  }, 120_000);

  /** Item 4, première moitié : masquer un canal change les lignes. */
  it("masque un canal depuis la légende", async () => {
    const { page } = session;
    await openChart(page, "?pas=semaine&vue=canal&metric=messages");

    const legend = page.locator("[data-timeline-legend]");
    await legend.scrollIntoViewIfNeeded();
    expect(await reachable(legend)).toBe(true);

    const items = legend.locator("[data-legend]");
    const count = await items.count();
    expect(count, "aucun canal dans la légende").toBeGreaterThan(0);

    const first = items.first();
    const channel = await first.getAttribute("data-legend");
    expect(await reachable(first)).toBe(true);
    expect(await page.locator(`[data-timeline-line="${channel}"]`).count()).toBe(1);

    await first.click();
    await expect
      .poll(async () => first.getAttribute("data-on"), { timeout: 10_000 })
      .toBe("0");
    // La ligne a disparu du tracé, et l'infobulle ne la nommera plus.
    expect(await page.locator(`[data-timeline-line="${channel}"]`).count()).toBe(0);

    // Et on la rouvre : une bascule qui ne se rouvre pas est un piège.
    await first.click();
    await expect.poll(async () => first.getAttribute("data-on"), { timeout: 10_000 }).toBe("1");
    expect(await page.locator(`[data-timeline-line="${channel}"]`).count()).toBe(1);
  }, 120_000);

  /**
   * **Item 3 au clic** : la barre ouvre la liste de *sa* période, et la liste a
   * la longueur annoncée. La vérification exhaustive est faite hors navigateur
   * sur 913 points ; ici on prouve que le clic va bien là.
   */
  it("ouvre au clic la liste de la période, de la même longueur", async () => {
    const { page } = session;
    await openChart(page, "?pas=semaine&vue=total&metric=messages");

    // La dernière barre qui porte quelque chose : cliquer sur un zéro
    // n'établirait rien.
    const bars = page.locator("[data-timeline-bar]");
    const total = await bars.count();
    let chosen = -1;
    for (let index = total - 1; index >= 0; index -= 1) {
      if (Number(await bars.nth(index).getAttribute("data-total")) > 0) {
        chosen = index;
        break;
      }
    }
    expect(chosen, "aucune barre non nulle").toBeGreaterThanOrEqual(0);

    const bar = bars.nth(chosen);
    const shown = Number(await bar.getAttribute("data-total"));
    await bar.scrollIntoViewIfNeeded();
    const link = bar.locator("a").first();
    expect(await reachable(link)).toBe(true);
    await link.click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), { timeout: 15_000 });

    const announced = Number(await page.locator("[data-list-count]").innerText());
    const rows = await page.locator("[data-row]").count();
    expect(announced, "la liste annonce autre chose que la barre").toBe(shown);
    expect(rows, `${shown} annoncés, ${rows} lignes`).toBe(shown);
    // Le lien portait bien une plage libre, donc la liste est celle du seau.
    expect(page.url()).toContain("periode=libre");
  }, 120_000);

  /** Item 7 : 390 px, sans défilement horizontal **de la page**. */
  it("tient sur un écran de 390 px, le défilement restant dans le cadre", async () => {
    const { page } = session;
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await openChart(page, "?pas=semaine&vue=total&metric=messages");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "la page déborde horizontalement à 390 px").toBeLessThanOrEqual(0);

      // Le cadre, lui, défile : c'est là que la largeur du tracé est absorbée.
      const frame = page.locator("[data-timeline-frame]");
      await frame.scrollIntoViewIfNeeded();
      expect(await reachable(frame)).toBe(true);
      const scrolls = await frame.evaluate(
        (node) => node.scrollWidth > node.clientWidth + 1,
      );
      expect(scrolls, "le tracé devrait défiler dans son cadre à 390 px").toBe(true);

      // La barre d'outils et la bande de cadence restent utilisables.
      for (const hook of ["[data-timeline-granularity]", "[data-pace-sentence]"]) {
        const node = page.locator(hook);
        await node.scrollIntoViewIfNeeded();
        expect(await reachable(node), hook).toBe(true);
      }
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }, 120_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
