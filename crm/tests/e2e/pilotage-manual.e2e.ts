import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Les trois consignations à la main, et la cible hebdomadaire.**
 *
 * Deux items du test d'acceptation du jalon 109 ne se vérifient qu'au clic :
 *
 * - nº 4 : « Démo envoyée » + un clic sur le lien de la démonstration +
 *   « Retour reçu » font une démo qualifiée, et **retirer « Retour reçu » la
 *   retire** ;
 * - nº 5 : changer la cible dans `/reglages` change la pastille **et** la ligne
 *   du graphique.
 *
 * Le test exige une fiche dont la démonstration a déjà été **cliquée** : c'est
 * le contact que `E2E_CONTACT_CLICKED` désigne. Sans lui, il s'ignore en le
 * disant, plutôt que de valider un chemin qu'il n'a pas exercé.
 */

const password = process.env.E2E_PASSWORD ?? "";
const contactId = process.env.E2E_CONTACT_CLICKED ?? "";
const available = chromiumPath() !== null && password !== "" && contactId !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] consignations manuelles ignorées : Chromium, E2E_PASSWORD ou E2E_CONTACT_CLICKED manquant");
}

async function qualifiedCount(session: Session): Promise<number> {
  const { page } = session;
  await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
  const tile = page.locator('[data-kpi="qualified"]');
  return Number(await tile.getAttribute("data-count"));
}

describeBrowser("consigner une démo à la main", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("qualifie la fiche avec les trois faits, et la déqualifie en retirant le retour", async () => {
    const { page } = session;
    const before = await qualifiedCount(session);

    await page.goto(`${BASE_URL}/contacts?lifecycle=all&fiche=${contactId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("tab", { name: /Suivi/ }).click();

    const box = page.locator("[data-outreach-box]");
    await box.scrollIntoViewIfNeeded();
    expect(await reachable(box)).toBe(true);

    // Le clic réel a déjà posé « Démo testée » : l'écran doit le montrer sans
    // qu'on ait rien saisi.
    const tested = page.locator('[data-manual="demo_tested"]');
    await expect
      .poll(async () => tested.getAttribute("data-on"), { timeout: 15_000 })
      .toBe("1");

    for (const type of ["demo_sent", "feedback_received"]) {
      const button = page.locator(`[data-manual="${type}"]`);
      await button.scrollIntoViewIfNeeded();
      expect(await reachable(button), type).toBe(true);
      await button.click();
      await expect
        .poll(async () => button.getAttribute("data-on"), { timeout: 15_000 })
        .toBe("1");
    }

    expect(await qualifiedCount(session)).toBe(before + 1);

    // Retirer le retour retire la qualification — par construction, pas par une
    // seconde règle : `qualifiedAt` exige les trois.
    await page.goto(`${BASE_URL}/contacts?lifecycle=all&fiche=${contactId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("tab", { name: /Suivi/ }).click();
    const feedback = page.locator('[data-manual="feedback_received"]');
    await feedback.scrollIntoViewIfNeeded();
    await expect.poll(async () => feedback.getAttribute("data-on"), { timeout: 15_000 }).toBe("1");
    await feedback.click();
    await expect.poll(async () => feedback.getAttribute("data-on"), { timeout: 15_000 }).toBe("0");

    expect(await qualifiedCount(session)).toBe(before);
  });

  /**
   * **Annuler ne peut pas effacer un clic.** « Démo testée » vient ici d'un
   * geste du prospect ; l'écran ne retire que ce qui a été saisi à la main.
   */
  it("ne retire pas une démo testée par un vrai clic", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/contacts?lifecycle=all&fiche=${contactId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("tab", { name: /Suivi/ }).click();

    const tested = page.locator('[data-manual="demo_tested"]');
    await tested.scrollIntoViewIfNeeded();
    await expect.poll(async () => tested.getAttribute("data-on"), { timeout: 15_000 }).toBe("1");
    await tested.click();
    // Le message le dit, et l'état ne bouge pas : le fait reste.
    await expect
      .poll(async () => tested.getAttribute("data-on"), { timeout: 15_000 })
      .toBe("1");
  });

  it("classe une réponse depuis la fiche", async () => {
    const { page } = session;
    const target = process.env.E2E_CONTACT_REPLIED ?? "";
    if (target === "") return;

    await page.goto(`${BASE_URL}/contacts?lifecycle=all&fiche=${target}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("tab", { name: /Suivi/ }).click();

    const select = page.locator("[data-reply] [data-category]").first();
    await select.scrollIntoViewIfNeeded();
    expect(await reachable(select)).toBe(true);
    await select.selectOption("already_equipped");
    await expect
      .poll(async () => select.inputValue(), { timeout: 15_000 })
      .toBe("already_equipped");
  });
});

describeBrowser("la cible hebdomadaire", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("déplace la pastille et la ligne du graphique", async () => {
    const { page } = session;

    const read = async (): Promise<{ tile: string; line: string | null }> => {
      await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
      const tile = await page.locator('[data-kpi="messages"]').innerText();
      const line = await page.locator("[data-target-line]").first().getAttribute("data-target-line");
      return { tile, line };
    };

    const before = await read();
    expect(before.tile).toContain("/ 100");
    expect(before.line).toBe("100");

    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });
    const field = page.locator('[data-target="messages"]');
    await field.scrollIntoViewIfNeeded();
    expect(await reachable(field)).toBe(true);
    await field.fill("20");
    await page.getByRole("button", { name: "Enregistrer" }).nth(0).waitFor();
    // Le bouton « Enregistrer » du panneau des cibles, pas celui d'à côté.
    await field.locator("xpath=ancestor::section[1]").getByRole("button", { name: "Enregistrer" }).click();
    await expect
      .poll(async () => page.locator("text=Enregistré.").count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    const after = await read();
    expect(after.tile).toContain("/ 20");
    expect(after.line).toBe("20");

    // Remise en état : un test qui laisse la base ailleurs qu'il l'a trouvée
    // fait échouer le suivant pour une raison qui n'est pas la sienne.
    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });
    const again = page.locator('[data-target="messages"]');
    await again.scrollIntoViewIfNeeded();
    await again.fill("100");
    await again.locator("xpath=ancestor::section[1]").getByRole("button", { name: "Enregistrer" }).click();
    await expect
      .poll(async () => (await read()).line, { timeout: 15_000 })
      .toBe("100");
  });
});
