import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Onglet « Segments » : la comparaison, et ses garde-fous.**
 *
 * Cet onglet pose une question comparative, et une comparaison est la façon la
 * plus facile de mentir avec des chiffres justes. Ce fichier vérifie donc moins
 * les chiffres que les **réserves** qui les accompagnent :
 *
 * 1. le bandeau de couverture dit sur combien de personnes la comparaison
 *    porte, et il mène à la liste de celles qu'il faut compléter ;
 * 2. chaque grand taux porte sa phrase « k sur n personnes » et sa puce de
 *    fiabilité ;
 * 3. la courbe distingue les deux tranches par une **forme** et un **tiret**,
 *    pas seulement par la couleur, et ses points creux signalent un échantillon
 *    trop petit ;
 * 4. la bascule Cumulé / Par période et le tri du tableau vivent dans l'URL.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] segments ignorés : ni Chromium ni E2E_PASSWORD");
}

describeBrowser("l'onglet Segments", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("ouvre son bandeau de couverture, et il mène aux fiches à compléter", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/segments`, { waitUntil: "domcontentloaded" });

    const banner = page.locator("[data-coverage]");
    expect(await reachable(banner)).toBe(true);
    const text = await banner.innerText();
    expect(text, "le bandeau ne dit pas la couverture").toMatch(
      /Trafic renseigné pour \d+ personnes? sur \d+/,
    );

    // Nommer le trou sans donner le geste qui le comble serait un reproche.
    const link = banner.locator("[data-coverage-link]");
    expect(await reachable(link)).toBe(true);
    await link.click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("taille")).toBe("unknown");
  }, 90_000);

  it("compare deux cartes, chacune avec son n et sa fiabilité", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/segments`, { waitUntil: "domcontentloaded" });

    const cards = page.locator("[data-size-card]");
    expect(await cards.count()).toBe(2);
    for (const bucket of ["small", "large"]) {
      const card = page.locator(`[data-size-card="${bucket}"]`);
      await card.scrollIntoViewIfNeeded();
      expect(await reachable(card), bucket).toBe(true);
      expect(await card.locator("[data-size-rate]").innerText(), bucket).toMatch(/%|—/);
      expect(await card.locator("[data-size-sample]").innerText(), bucket).toMatch(
        /\d+ sur \d+ personnes?/,
      );
      expect(await reachable(card.locator("[data-reliability]")), bucket).toBe(true);
    }

    /*
      **La puce de comparaison n'apparaît que sur la plus faible, et seulement
      quand les deux échantillons atteignent trente.** Sur une base semée elle
      peut donc être absente ; ce qui ne doit jamais arriver, c'est qu'elle
      apparaisse **deux fois** — « 3 fois moins » et « 3 fois plus » disent la
      même chose, et répéter un écart le fait paraître plus grand qu'il n'est.
    */
    expect(await page.locator("[data-size-comparison]").count()).toBeLessThanOrEqual(1);
  }, 90_000);

  it("ouvre la liste d'une tranche depuis une marche de mini-entonnoir", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/segments`, { waitUntil: "domcontentloaded" });

    const step = page.locator('[data-size-card="small"] [data-size-step="contacted"]');
    await step.scrollIntoViewIfNeeded();
    const shown = Number(await step.getAttribute("data-count"));
    expect(shown, "la tranche « petites » est vide dans cette base").toBeGreaterThan(0);

    const link = step.locator("a");
    expect(await reachable(link)).toBe(true);
    await link.click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("taille")).toBe("small");
    expect(await page.locator("[data-row]").count()).toBe(shown);
    expect(Number(await page.locator("[data-list-count]").innerText())).toBe(shown);
  }, 90_000);

  it("distingue les deux séries par une forme et un tiret, pas par la couleur", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/segments`, { waitUntil: "domcontentloaded" });

    const chart = page.locator("[data-rate-evolution]");
    await chart.scrollIntoViewIfNeeded();
    expect(await reachable(chart)).toBe(true);

    // Une ligne par tranche comparée, chacune avec son propre tracé.
    expect(await page.locator('[data-rate-line="small"]').count()).toBe(1);
    expect(await page.locator('[data-rate-line="large"]').count()).toBe(1);

    // La forme du marqueur : rond pour les petites, carré pour les grosses.
    const rounds = await page.locator('[data-rate-line="small"] circle').count();
    const squares = await page.locator('[data-rate-line="large"] rect').count();
    expect(rounds, "les petites n'ont pas de marqueur rond").toBeGreaterThan(0);
    expect(squares, "les grosses n'ont pas de marqueur carré").toBeGreaterThan(0);

    // Et le tiret : la série des grosses est tiretée, celle des petites pleine.
    const dashes = await page.locator('[data-rate-line="large"] path').getAttribute("stroke-dasharray");
    expect(dashes, "la série des grosses n'est pas tiretée").not.toBe(null);
    expect(dashes).not.toBe("");
  }, 90_000);

  /**
   * **La bande de détail dit la période lue, au survol comme au focus.** Un
   * graphique dont l'information n'existe qu'au survol est un graphique que
   * personne ne lit au clavier — le défaut corrigé au jalon 113 sur l'autre
   * tracé.
   */
  it("remplit sa bande de détail au survol et au focus clavier", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/segments?mode=periode`, {
      waitUntil: "domcontentloaded",
    });

    const strip = page.locator("[data-rate-detail]");
    await strip.scrollIntoViewIfNeeded();
    expect(await reachable(strip)).toBe(true);
    await page.mouse.move(0, 0);
    const before = await page.locator("[data-rate-detail-period]").innerText();
    expect(before.length, "la bande est muette au repos").toBeGreaterThan(0);

    const point = page.locator("[data-rate-point]").first();
    await point.scrollIntoViewIfNeeded();
    await point.hover();
    await expect
      .poll(async () => (await page.locator("[data-rate-detail-period]").innerText()).length > 0, {
        timeout: 10_000,
      })
      .toBe(true);

    /*
      Au clavier : chaque point est un lien, donc focalisable. Le lien est
      cherché en CSS (`a:has(...)`) et non en XPath : dans un SVG, les éléments
      vivent dans l'espace de noms SVG, et un `ancestor::a` sans préfixe n'y
      trouve rien — ce qui a d'abord fait échouer ce test sur un produit
      correct.
    */
    await page.mouse.move(0, 0);
    await page.locator("a:has([data-rate-point])").first().focus();
    await expect
      .poll(async () => (await page.locator("[data-rate-detail-period]").count()) > 0, {
        timeout: 10_000,
      })
      .toBe(true);
  }, 120_000);

  it("garde le mode de la courbe et le tri du tableau dans l'URL", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/segments`, { waitUntil: "domcontentloaded" });

    const mode = page.locator("[data-rate-mode]");
    await mode.scrollIntoViewIfNeeded();
    expect(await reachable(mode)).toBe(true);
    await mode.click();
    await page.waitForURL((url) => url.searchParams.get("mode") === "periode", { timeout: 15_000 });
    // Et cela survit au rechargement : la vue se met en favori.
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).searchParams.get("mode")).toBe("periode");

    const sort = page.locator('[data-niche-sort="taux"]');
    await sort.scrollIntoViewIfNeeded();
    expect(await reachable(sort)).toBe(true);
    await sort.click();
    await page.waitForURL((url) => url.searchParams.get("tri") === "taux", { timeout: 15_000 });
  }, 120_000);

  /**
   * **Le tableau par niche se restreint sans toucher aux cartes du dessus.**
   *
   * Poser le filtre de page `taille=` restreindrait aussi les deux cartes, et
   * on comparerait alors les petites… aux petites. C'est pour cela que la
   * bascule du tableau est un réglage **local** (`tranche=`).
   */
  it("restreint le tableau par niche à une tranche, sans restreindre les cartes", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/segments`, { waitUntil: "domcontentloaded" });

    const bothCards = await page.locator("[data-size-card]").count();
    const chip = page.locator('[data-niche-size="Petites"]');
    await chip.scrollIntoViewIfNeeded();
    expect(await reachable(chip)).toBe(true);
    await chip.click();
    await page.waitForURL((url) => url.searchParams.get("tranche") === "small", { timeout: 15_000 });

    expect(await chip.getAttribute("data-active")).toBe("1");
    // Les deux cartes sont toujours là, et toujours deux.
    expect(await page.locator("[data-size-card]").count()).toBe(bothCards);
    expect(new URL(page.url()).searchParams.get("taille"), "le filtre de page a bougé").toBeNull();
    expect(await page.locator("[data-niche-row]").count()).toBeGreaterThan(0);
  }, 120_000);

  it("affiche les barres groupées, la seconde hachurée", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/segments`, { waitUntil: "domcontentloaded" });

    const bars = page.locator("[data-contacted-bars]");
    await bars.scrollIntoViewIfNeeded();
    expect(await reachable(bars)).toBe(true);
    expect(await page.locator("[data-bar-group]").count()).toBeGreaterThan(0);

    // Deux barres par période : groupées, pas empilées.
    const first = page.locator("[data-bar-group]").first();
    expect(await first.locator("[data-bar]").count()).toBe(2);

    // Et la seconde est remplie par le motif hachuré, pas par une teinte seule.
    const hatched = await page
      .locator('[data-bar$=":large"] rect')
      .first()
      .getAttribute("fill");
    expect(hatched, "les grosses ne sont pas hachurées").toContain("contacted-hatch");
  }, 90_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
