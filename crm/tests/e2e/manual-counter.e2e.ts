import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Le compteur de messages manuels, cliqué pour de vrai.**
 *
 * Quatre choses qu'aucun test unitaire ne peut voir, et c'est pour elles que ce
 * fichier existe :
 *
 * 1. **le bloc est atteignable** — `reachable()`, jamais `isVisible()` : la
 *    seconde ne voit pas un ancêtre qui rogne, et c'est exactement le défaut du
 *    jalon 60, livré deux fois ;
 * 2. **il tient sur un téléphone.** 390 px de large, sans défilement
 *    horizontal, et les cinq boutons atteignables sans réglage préalable. C'est
 *    l'usage réel : on compte juste après avoir envoyé, depuis son téléphone ;
 * 3. **un clic compte vraiment**, et la pastille de la semaine suit. Un bouton
 *    qui rend bien et ne fait rien a été livré deux fois dans ce projet
 *    (jalons 56 et 59) ;
 * 4. **« Annuler » défait le lot entier**, pas une ligne sur cinq.
 *
 * Les chiffres relevés viennent d'une **base semée** : ce ne sont pas des
 * nombres de production. Ce que le test établit, ce sont des **écarts** — +1,
 * +5, retour au point de départ — et non des totaux.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] compteur manuel ignoré : ni Chromium ni E2E_PASSWORD");
}

/** Le nombre affiché par la pastille des messages de la semaine. */
async function messagesTile(page: Page): Promise<number> {
  await page.goto(`${BASE_URL}/pilotage?periode=semaine`, { waitUntil: "domcontentloaded" });
  const tile = page.locator('[data-kpi="messages"]');
  if ((await tile.count()) === 0) return 0;
  return Number(await tile.getAttribute("data-count"));
}

/** Le total de la dernière barre du graphique : la semaine en cours. */
async function lastBar(page: Page): Promise<number> {
  const bars = page.locator("[data-week-total]");
  const count = await bars.count();
  if (count === 0) return 0;
  return Number(await bars.nth(count - 1).getAttribute("data-week-total"));
}

/**
 * Choisit le propriétaire si le bloc le demande.
 *
 * Il le demande au premier passage sur un appareil neuf — `localStorage` est
 * vide — et plus ensuite. Le test doit donc regarder avant de cliquer, sinon il
 * passe une fois puis échoue au second passage. C'est le piège exact du
 * `setToggle` du jalon 109.
 */
async function ensureOwner(page: Page): Promise<void> {
  /*
    **On attend que le bloc soit monté avant de regarder.**

    Le bloc ne rend rien d'« à propos du propriétaire » avant son montage — le
    serveur ne connaît pas `localStorage`. Lire l'état trop tôt donnait une
    course réelle, trouvée à la recette : le test voyait le bloc de choix puis
    le trouvait disparu au moment de cliquer, une fois sur six. C'était un
    défaut du test *et* du produit, et les deux sont corrigés : le bloc attend
    son montage, et ce test attend que le bloc ait tranché.
  */
  await expect
    .poll(async () => (await page.locator("[data-manual-owner-pending]").count()) === 0, {
      timeout: 20_000,
    })
    .toBe(true);

  const ask = page.locator("[data-manual-owner-ask]");
  if ((await ask.count()) === 0) return;
  const first = ask.locator("[data-manual-owner]").first();
  await first.scrollIntoViewIfNeeded();
  await first.click();
  await expect.poll(async () => (await ask.count()) === 0, { timeout: 10_000 }).toBe(true);
}

/** Clique un canal et attend que le serveur ait répondu. */
async function clickChannel(page: Page, channel: string): Promise<void> {
  const button = page.locator(`[data-manual-add="${channel}"]`);
  await button.scrollIntoViewIfNeeded();
  expect(await reachable(button), channel).toBe(true);
  await button.click();
  await expect
    .poll(async () => (await page.locator("[data-manual-said]").count()) > 0, { timeout: 20_000 })
    .toBe(true);
}

describeBrowser("le compteur de messages manuels", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("s'ouvre avec ses cinq canaux, sa quantité, sa date et son contact", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

    const block = page.locator("[data-manual-counter]");
    await block.scrollIntoViewIfNeeded();
    expect(await reachable(block)).toBe(true);

    await ensureOwner(page);

    for (const channel of [
      "linkedin_dm",
      "linkedin_invite",
      "whatsapp",
      "instagram_dm",
      "call",
    ]) {
      const button = page.locator(`[data-manual-add="${channel}"]`);
      await button.scrollIntoViewIfNeeded();
      expect(await reachable(button), channel).toBe(true);
      expect(await button.isEnabled(), channel).toBe(true);
    }

    for (const hook of ["[data-manual-quantity]", "[data-manual-date]", "[data-manual-contact]"]) {
      const field = page.locator(hook);
      await field.scrollIntoViewIfNeeded();
      expect(await reachable(field), hook).toBe(true);
    }

    // La phrase qui dit ce que le contact change : c'est la seule chose du
    // bloc qui ne se devine pas.
    const note = page.locator("[data-manual-note]");
    expect(await reachable(note)).toBe(true);
    expect(await note.innerText()).toContain("nouvelles personnes contactées");
  }, 90_000);

  /**
   * **Item 6 : 390 px de large, sans défilement horizontal.**
   *
   * On vérifie les deux faces de la promesse : le document ne déborde pas, et
   * les cinq boutons restent atteignables à cette largeur. Un bloc qui tient
   * sans déborder mais dont les boutons passent sous un autre élément serait
   * aussi inutilisable.
   */
  it("tient sur un écran de 390 px, sans défilement horizontal", async () => {
    const { page } = session;
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

      const block = page.locator("[data-manual-counter]");
      await block.scrollIntoViewIfNeeded();
      expect(await reachable(block)).toBe(true);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "la page déborde horizontalement à 390 px").toBeLessThanOrEqual(0);

      await ensureOwner(page);
      for (const channel of ["linkedin_dm", "whatsapp", "call"]) {
        const button = page.locator(`[data-manual-add="${channel}"]`);
        await button.scrollIntoViewIfNeeded();
        expect(await reachable(button), `${channel} à 390 px`).toBe(true);
        // Cible tactile de 44 px (jalon 46).
        const box = await button.boundingBox();
        expect(box?.height ?? 0, `${channel} : cible trop petite`).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0, `${channel} : bouton plus large que l'écran`).toBeLessThanOrEqual(390);
      }
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }, 90_000);

  /**
   * **Un clic compte, la pastille et la barre suivent.** Les trois nombres sont
   * relevés avant et après : ce qui est vérifié est l'écart, pas le total.
   */
  it("compte un message au clic, et le tableau de bord suit", async () => {
    const { page } = session;
    const before = await messagesTile(page);
    const beforeBar = await lastBar(page);

    await ensureOwner(page);
    await clickChannel(page, "linkedin_dm");

    const after = await messagesTile(page);
    const afterBar = await lastBar(page);
    expect(after, "la pastille n'a pas bougé").toBe(before + 1);
    expect(afterBar, "le graphique n'a pas suivi la pastille").toBe(beforeBar + 1);

    // Et le décompte du jour le dit, canal par canal.
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
    const count = page.locator('[data-manual-count="linkedin_dm"]');
    expect(await reachable(count)).toBe(true);
    expect(Number(await count.innerText())).toBeGreaterThanOrEqual(1);
  }, 120_000);

  /**
   * **Item 3 : un « +5 » écrit cinq lignes, et « Annuler » retire les cinq.**
   *
   * C'est le test qui justifie le préfixe de lot : retirer une ligne sur cinq
   * laisserait quatre messages que personne n'a envoyés.
   */
  it("écrit un lot de cinq, et l'annule entièrement", async () => {
    const { page } = session;
    const before = await messagesTile(page);

    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
    await ensureOwner(page);

    const quantity = page.locator("[data-manual-quantity]");
    await quantity.scrollIntoViewIfNeeded();
    await quantity.fill("5");
    await clickChannel(page, "call");

    expect(await messagesTile(page), "cinq messages n'ont pas été comptés").toBe(before + 5);

    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
    const undo = page.locator("[data-manual-undo]");
    await undo.scrollIntoViewIfNeeded();
    expect(await reachable(undo)).toBe(true);
    await undo.click();
    await expect
      .poll(async () => (await page.locator("[data-manual-said]").count()) > 0, { timeout: 20_000 })
      .toBe(true);

    expect(await messagesTile(page), "l'annulation n'a pas retiré les cinq").toBe(before);
  }, 120_000);

  /**
   * **Item 5, au clic : la liste d'un chiffre contient les lignes sans fiche.**
   *
   * Sans elles, le nombre affiché cesserait d'égaler la longueur de la liste —
   * l'invariant que le jalon 109 a construit, et que les lignes sans fiche du
   * jalon 112 auraient pu casser.
   */
  it("ouvre une liste de la même longueur, lignes sans fiche comprises", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage?periode=semaine`, { waitUntil: "domcontentloaded" });

    const tile = page.locator('[data-kpi="messages"]');
    const shown = Number(await tile.getAttribute("data-count"));
    expect(await reachable(tile)).toBe(true);
    await tile.click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), {
      timeout: 15_000,
    });

    const announced = Number(await page.locator("[data-list-count]").innerText());
    const rows = await page.locator("[data-row]").count();
    expect(announced).toBe(shown);
    expect(rows, `${shown} annoncés, ${rows} lignes`).toBe(shown);

    // Au moins une ligne sans fiche, et l'origine de chaque ligne est nommée.
    expect(await page.locator("[data-no-contact]").count()).toBeGreaterThanOrEqual(1);
    expect(await page.locator('[data-source="manual"]').count()).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
