import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Onglet « Campagnes côte à côte ».**
 *
 * Ce que seul un navigateur établit ici :
 *
 * 1. **les deux origines sont dans le même tableau**, chacune nommée par sa
 *    puce — sans quoi la question « laquelle marche mieux » serait inposable ;
 * 2. **l'état de chaque campagne porte son explication au survol**, parce que
 *    « en pause » couvre deux réalités que l'API lemlist ne distingue pas ;
 * 3. **le résultat par étape s'ouvre**, et il est replié par défaut : trois
 *    campagnes à cinq étapes font quinze lignes qui noient les trois lignes
 *    qu'on venait comparer ;
 * 4. **un chiffre ouvre la liste de sa campagne**, de la même longueur.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] campagnes ignorées : ni Chromium ni E2E_PASSWORD");
}

describeBrowser("l'onglet Campagnes", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("réunit les campagnes des deux outils, chacune avec son état et son origine", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/campagnes?periode=libre&du=2026-09-01&au=2026-12-31`, {
      waitUntil: "domcontentloaded",
    });

    const board = page.locator("[data-campaign-board]");
    expect(await reachable(board)).toBe(true);

    const lines = page.locator("[data-board-line]");
    const count = await lines.count();
    expect(count, "aucune campagne dans cette base").toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const line = lines.nth(index);
      await line.scrollIntoViewIfNeeded();
      const state = await line.locator("[data-board-state]").getAttribute("data-board-state");
      expect(["running", "paused", "done"], `ligne ${index}`).toContain(state);
      // L'état porte son explication : « en pause » couvre une campagne lemlist
      // arrêtée et une campagne simplement silencieuse, et l'API ne les
      // distingue pas. Le dire au survol est la seule forme honnête.
      const hint = await line.locator("[data-board-state]").getAttribute("title");
      expect((hint ?? "").length, `ligne ${index} : état sans explication`).toBeGreaterThan(10);
      expect(await line.locator("[data-board-origin]").count(), `ligne ${index}`).toBe(1);
    }

    // Et la note sur les invitations : sans elle, l'écart entre « messages » et
    // le nombre d'emails partis serait mis sur le dos d'un bug.
    expect(await page.locator("[data-board-note]").innerText()).toContain("invitations LinkedIn");
  }, 120_000);

  it("ouvre le résultat par étape, replié par défaut", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/campagnes?periode=libre&du=2026-09-01&au=2026-12-31`, {
      waitUntil: "domcontentloaded",
    });

    const details = page.locator("details[data-board-steps]").first();
    if ((await details.count()) === 0) {
      // Aucune campagne ne porte plusieurs étapes : l'écran doit alors le dire
      // au lieu d'afficher un dépli vide.
      expect(await page.locator("[data-board-nosteps]").count()).toBeGreaterThan(0);
      return;
    }

    await details.scrollIntoViewIfNeeded();
    // Replié : les lignes d'étape ne sont pas atteignables avant le clic.
    expect(await details.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(false);

    const summary = details.locator("summary");
    expect(await reachable(summary)).toBe(true);
    await summary.click();
    await expect
      .poll(async () => details.evaluate((node) => (node as HTMLDetailsElement).open), {
        timeout: 10_000,
      })
      .toBe(true);

    const steps = details.locator("[data-board-step]");
    expect(await steps.count()).toBeGreaterThan(1);
    // Chaque étape porte son propre taux **et** sa propre fiabilité : diviser
    // les réponses de l'étape 3 par les inscrits de la campagne donnerait un
    // taux qui baisse mécaniquement à chaque relance.
    const first = steps.first();
    await first.scrollIntoViewIfNeeded();
    expect(await reachable(first.locator("[data-reliability]"))).toBe(true);
  }, 120_000);

  it("ouvre derrière un chiffre la liste de sa campagne, de la même longueur", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/campagnes?periode=libre&du=2026-09-01&au=2026-12-31`, {
      waitUntil: "domcontentloaded",
    });

    const link = page.locator('[data-board-line] a[href*="/pilotage/liste"]').first();
    await link.scrollIntoViewIfNeeded();
    expect(await reachable(link)).toBe(true);
    const shown = Number((await link.innerText()).trim());
    expect(Number.isFinite(shown)).toBe(true);
    await link.click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), { timeout: 15_000 });

    expect(Number(await page.locator("[data-list-count]").innerText())).toBe(shown);
    expect(await page.locator("[data-row]").count()).toBe(shown);
    expect(new URL(page.url()).searchParams.get("campagne")).not.toBeNull();
  }, 120_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
