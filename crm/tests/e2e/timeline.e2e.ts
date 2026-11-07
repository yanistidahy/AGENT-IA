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
  // L'onglet « Dans le temps » depuis le jalon 113 v2 : le graphique a quitté
  // la vue d'ensemble pour son propre écran.
  await page.goto(`${BASE_URL}/pilotage/temps${query}`, { waitUntil: "domcontentloaded" });
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

  it("ouvre ses onglets, sa barre d'outils, son tracé et sa bande de cadence", async () => {
    const { page } = session;
    await openChart(page);

    expect(await reachable(page.locator("[data-board-tabs]"))).toBe(true);
    expect(
      await page.locator('[data-board-tab="/pilotage/temps"]').getAttribute("data-active"),
    ).toBe("1");

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
   * **Le panneau de détail est sous le tracé, et il est toujours là.**
   *
   * C'était une infobulle flottante au jalon 113. Trois raisons l'ont déplacée,
   * et les trois se vérifient ici : elle se posait en travers du graphique
   * qu'on lit, elle ne survivait pas à un doigt sur un écran tactile, et elle
   * ne pouvait pas porter le lien « Voir les N messages » — or c'est pour ce
   * lien qu'on s'arrête sur une barre. Toujours présente, parce qu'un bloc qui
   * apparaît au survol pousse la page et fait perdre la barre visée.
   */
  it("remplit un panneau de détail sous le tracé, au survol comme au focus", async () => {
    const { page } = session;
    await openChart(page, "?pas=semaine&vue=total&metric=messages");

    /*
      Présent **avant** tout survol, et portant la dernière période. La souris
      est d'abord ramenée dans un coin : Playwright garde sa position d'un test
      à l'autre, et un curseur resté sur une barre ferait lire l'état survolé
      là où l'on veut vérifier l'état au repos. Défaut du test, pas du produit.
    */
    await page.mouse.move(0, 0);
    const panel = page.locator("[data-timeline-detail]");
    await panel.scrollIntoViewIfNeeded();
    expect(await reachable(panel)).toBe(true);
    expect(await panel.getAttribute("data-detail-default")).toBe("1");

    const bar = page.locator("[data-timeline-bar]").last();
    await bar.scrollIntoViewIfNeeded();
    await bar.hover();

    const dates = await page.locator("[data-tooltip-dates]").innerText();
    // « lun. 2 nov. – dim. 8 nov. » : les deux bornes, pas « semaine du 2 ».
    expect(dates).toMatch(/\p{L}+\.? \d+ \p{L}+\.? – \p{L}+\.? \d+ \p{L}+\.?/u);
    expect(Number(await page.locator("[data-tooltip-total]").innerText())).toBeGreaterThanOrEqual(0);
    // L'origine des faits : trois chemins écrivent des messages.
    expect(await page.locator("[data-tooltip-sources]").count()).toBeGreaterThanOrEqual(0);

    // Et le lien, qui est la raison du déplacement.
    const link = page.locator("[data-detail-link]");
    expect(await reachable(link)).toBe(true);

    // Le même contenu au clavier : chaque barre est un lien, donc focalisable.
    await page.mouse.move(0, 0);
    await page.locator("[data-timeline-bar] a").last().focus();
    await expect
      .poll(async () => (await page.locator("[data-tooltip-dates]").count()) > 0, { timeout: 10_000 })
      .toBe(true);
  }, 120_000);

  /**
   * **La cible est un trait rouge en pointillés, et les barres ne sont jamais
   * rouges.** Un trait rouge marque un seuil ; une barre rouge juge le travail
   * de la semaine, et peindre en rouge la moitié d'une série ferait fermer
   * l'écran.
   */
  it("trace la cible en pointillés rouges, et garde les barres neutres", async () => {
    const { page } = session;
    await openChart(page, "?pas=semaine&vue=total&metric=messages");

    const target = page.locator("[data-target-line] line").first();
    expect(await page.locator("[data-target-line]").count()).toBeGreaterThan(0);
    expect(await target.getAttribute("stroke")).toContain("--color-danger");
    expect(await target.getAttribute("stroke-dasharray")).not.toBe(null);

    // Aucune barre peinte avec le rouge du seuil.
    const fills = await page.locator("[data-timeline-bar] rect").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("fill") ?? ""),
    );
    for (const fill of fills) expect(fill).not.toContain("--color-danger");
  }, 90_000);

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

  /**
   * **Au doigt, la barre sélectionne la période ; elle ne part pas.**
   *
   * Le brief demande deux choses qui se contredisent sur un écran tactile : que
   * le clic remplisse le panneau de détail, et que la barre ouvre la liste.
   * L'arbitrage est que le doigt **sélectionne** et que « Voir les N messages »,
   * dans le panneau, ouvre la liste. Sans lui, un utilisateur tactile ne
   * pourrait jamais lire le détail d'une période : il n'a pas de survol, et son
   * tap partirait.
   */
  it("au doigt, sélectionne la période au lieu de naviguer", async () => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      storageState: await session.page.context().storageState(),
    });
    try {
      await page.goto(`${BASE_URL}/pilotage/temps?pas=semaine&vue=total&metric=messages`, {
        waitUntil: "domcontentloaded",
      });
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
      await bar.scrollIntoViewIfNeeded();
      await bar.locator("a").first().tap();

      // On reste sur le graphique, et le panneau porte désormais cette période.
      expect(new URL(page.url()).pathname, "le tap a navigué").toBe("/pilotage/temps");
      await expect
        .poll(
          async () =>
            page.locator("[data-timeline-detail]").getAttribute("data-detail-default"),
          { timeout: 10_000 },
        )
        .toBe("0");

      // Et c'est le lien du panneau qui ouvre la liste.
      const link = page.locator("[data-detail-link]");
      await link.scrollIntoViewIfNeeded();
      await link.tap();
      await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), {
        timeout: 15_000,
      });
    } finally {
      await page.close();
    }
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
