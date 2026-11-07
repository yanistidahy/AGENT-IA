import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Les quatre onglets, et ce qui les traverse.**
 *
 * Trois promesses du jalon que seul un navigateur peut établir :
 *
 * 1. **les filtres survivent au changement d'onglet** — on en pose quatre, on
 *    fait le tour des quatre onglets, et ils sont tous encore là. Un filtre
 *    perdu en route est le genre de défaut dont on accuse les chiffres ;
 * 2. **les réglages locaux ne suivent pas** — une granularité de graphique n'a
 *    rien à décider du tri d'un tableau de campagnes ;
 * 3. **l'onglet actif se dit**, et pas seulement se voit : `aria-current` pour
 *    le lecteur d'écran.
 *
 * Et les trois onglets neufs tiennent à 390 px sans défilement horizontal **de
 * la page** — la règle du jalon 46, celle qui a coûté le jalon 60.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] onglets ignorés : ni Chromium ni E2E_PASSWORD");
}

const TABS = ["/pilotage", "/pilotage/temps", "/pilotage/segments", "/pilotage/campagnes"] as const;

/** Quatre filtres partagés, posés dans l'URL. */
const FILTERS = "periode=mois&canal=email&proprietaire=Yanis&origine=lemlist";

describeBrowser("le tableau de bord en quatre onglets", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("ouvre les quatre onglets, chacun se déclarant actif", async () => {
    const { page } = session;
    for (const tab of TABS) {
      await page.goto(`${BASE_URL}${tab}`, { waitUntil: "domcontentloaded" });
      expect(await reachable(page.locator("h1")), tab).toBe(true);

      const nav = page.locator("[data-board-tabs]");
      expect(await reachable(nav), tab).toBe(true);
      expect(await nav.locator("[data-board-tab]").count(), tab).toBe(TABS.length);

      const active = nav.locator(`[data-board-tab="${tab}"]`);
      expect(await active.getAttribute("data-active"), tab).toBe("1");
      // Dit au lecteur d'écran, pas seulement peint.
      expect(await active.getAttribute("aria-current"), tab).toBe("page");
    }
  }, 120_000);

  /**
   * **Le tour complet avec quatre filtres posés.** On clique d'onglet en
   * onglet, comme un humain, et on relit l'URL à chaque étape.
   */
  it("garde les filtres partagés en changeant d'onglet", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage?${FILTERS}`, { waitUntil: "domcontentloaded" });

    for (const tab of TABS.slice(1)) {
      const link = page.locator(`[data-board-tab="${tab}"]`);
      await link.scrollIntoViewIfNeeded();
      expect(await reachable(link), tab).toBe(true);
      await link.click();
      await page.waitForURL((url) => url.pathname === tab, { timeout: 15_000 });

      const search = new URL(page.url()).searchParams;
      expect(search.get("periode"), `${tab} perd la période`).toBe("mois");
      expect(search.get("canal"), `${tab} perd le canal`).toBe("email");
      expect(search.get("proprietaire"), `${tab} perd la personne`).toBe("Yanis");
      expect(search.get("origine"), `${tab} perd l'origine`).toBe("lemlist");

      // Et la barre de filtres les affiche : un filtre actif invisible est un
      // filtre dont on accuse les chiffres.
      expect(await page.locator('[data-filter="canal"]').inputValue(), tab).toBe("email");
    }
  }, 120_000);

  it("laisse les réglages locaux derrière", async () => {
    const { page } = session;
    // Une granularité et une vue posées sur « Dans le temps »…
    await page.goto(`${BASE_URL}/pilotage/temps?${FILTERS}&pas=mois&vue=canal`, {
      waitUntil: "domcontentloaded",
    });
    const link = page.locator('[data-board-tab="/pilotage/campagnes"]');
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await page.waitForURL((url) => url.pathname === "/pilotage/campagnes", { timeout: 15_000 });

    const search = new URL(page.url()).searchParams;
    // …ne doivent rien décider sur « Campagnes », qui n'a ni granularité ni vue.
    expect(search.get("pas")).toBeNull();
    expect(search.get("vue")).toBeNull();
    expect(search.get("canal"), "mais le filtre partagé reste").toBe("email");
  }, 90_000);

  it("tient sur un écran de 390 px, sans défilement horizontal de la page", async () => {
    const { page } = session;
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      for (const tab of TABS) {
        await page.goto(`${BASE_URL}${tab}`, { waitUntil: "domcontentloaded" });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${tab} déborde horizontalement à 390 px`).toBeLessThanOrEqual(0);
        // La barre d'onglets reste utilisable : elle défile dans son propre
        // cadre, ce qui est la règle du jalon 46.
        const nav = page.locator("[data-board-tabs]");
        expect(await reachable(nav), tab).toBe(true);
      }
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }, 120_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
