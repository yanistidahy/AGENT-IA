import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Le pilotage, cliqué pour de vrai.**
 *
 * Trois choses qu'aucun test unitaire ne peut voir, et c'est pour elles que ce
 * fichier existe :
 *
 * 1. **les pastilles et les filtres sont atteignables** — `reachable()`, jamais
 *    `isVisible()` : la seconde ne voit pas un ancêtre qui rogne, et c'est
 *    exactement le défaut du jalon 60 ;
 * 2. **un nombre et la liste qu'il ouvre comptent la même chose** — le compte
 *    lu sur la pastille et le nombre de lignes de la page ouverte sont relevés
 *    dans le DOM, pas dans le HTML brut (le flux RSC y répète le balisage, ce
 *    qui double tout comptage fait au `grep`) ;
 * 3. **l'écran tient en clair comme en sombre** — le produit n'a qu'un thème
 *    clair (voir CLAUDE.md) ; on vérifie donc sous les deux préférences du
 *    système que le texte reste atteignable, au lieu d'affirmer un thème sombre
 *    qui n'existe pas.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] pilotage ignoré : ni Chromium ni E2E_PASSWORD");
}

describeBrowser("le pilotage", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("ouvre l'écran avec sa barre de filtres et ses six pastilles", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

    expect(await reachable(page.locator("h1"))).toBe(true);
    expect(await reachable(page.locator("[data-filter-bar]"))).toBe(true);
    for (const filter of ["periode", "campagne", "canal", "proprietaire", "segment"]) {
      expect(await reachable(page.locator(`[data-filter="${filter}"]`)), filter).toBe(true);
    }

    const tiles = page.locator("[data-tile]");
    expect(await tiles.count()).toBe(6);
    for (let index = 0; index < 6; index += 1) {
      expect(await reachable(tiles.nth(index)), `pastille ${index}`).toBe(true);
    }
    // Cinq des six ouvrent une liste : le taux de réponse n'a pas de personnes
    // derrière lui, il a deux chiffres qui ont chacun la leur.
    expect(await page.locator("[data-kpi]").count()).toBe(5);
  });

  /**
   * **L'item 6 du test d'acceptation, vérifié au clic.**
   *
   * On lit le nombre sur la pastille, on clique, on compte les lignes. Les deux
   * viennent du même appel (`metricResult`) : le test le prouve en les
   * comparant sur l'écran plutôt qu'en relisant le code.
   */
  it("ouvre derrière chaque pastille une liste de la même longueur", async () => {
    const { page } = session;

    for (const metric of ["messages", "new_contacted", "replies", "demos_sent", "qualified"]) {
      await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
      const tile = page.locator(`[data-kpi="${metric}"]`);
      if ((await tile.count()) === 0) continue;

      const shown = Number(await tile.getAttribute("data-count"));
      expect(await reachable(tile), metric).toBe(true);
      await tile.click();
      await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), {
        timeout: 15_000,
      });

      const announced = Number(await page.locator("[data-list-count]").innerText());
      const rows = await page.locator("[data-row]").count();
      expect(announced, `${metric} : la liste annonce le compte de la pastille`).toBe(shown);
      expect(rows, `${metric} : ${shown} annoncés, ${rows} lignes`).toBe(shown);
    }
  });

  it("ouvre aussi la liste derrière une marche de l'entonnoir et une cellule de tableau", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

    const stage = page.locator('[data-funnel-stage="contacted"]');
    const shown = Number(await stage.getAttribute("data-count"));
    /*
      **On descend d'abord, comme un humain.** C'est déjà la règle appliquée à
      la cellule de tableau plus bas, et elle vaut ici pour la même raison :
      `reachable()` interroge le point au centre de l'élément, donc un élément
      hors du cadre n'est pas atteignable — et c'est exact.

      Ce test passait sans défiler tant que l'entonnoir tenait dans le premier
      écran. Le compteur du jalon 112, posé au-dessus, l'a poussé dessous, et
      la garde a fait son travail : elle a signalé un élément réellement hors
      de l'écran. Le bloc a été resserré en conséquence (date et contact
      derrière un dépli) **et** ce test défile, parce qu'un tableau de bord est
      plus haut qu'un écran et le restera.
    */
    await stage.scrollIntoViewIfNeeded();
    expect(await reachable(stage)).toBe(true);
    await stage.locator("a").first().click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), { timeout: 15_000 });
    expect(await page.locator("[data-row]").count()).toBe(shown);

    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
    /*
      **La cellule et son compte doivent être ceux de la *même* ligne.**

      Toutes les cellules ne portent pas de lien — une ligne « Hors campagne »
      n'en a pas, parce qu'il n'y a pas de campagne à filtrer. Prendre « le
      premier compte » et « le premier lien » séparément les appariait alors
      sur deux lignes différentes, et le test échouait en annonçant un écart
      qui n'existait pas. C'était un défaut du test, pas du produit : corrigé
      en ne regardant que les cellules **qui portent un lien**.
    */
    const cellWithLink = page.locator('[data-cell="messages"]:has(a)').first();
    const cellCount = Number(await cellWithLink.getAttribute("data-count"));
    const cell = cellWithLink.locator("a");
    // Les tableaux sont en bas de l'écran : on descend d'abord, comme un
    // humain. `reachable()` interroge le point au centre de l'élément, donc un
    // élément hors du cadre n'est pas atteignable — et c'est exact : il faut
    // bien faire défiler pour le toucher.
    await cell.scrollIntoViewIfNeeded();
    expect(await reachable(cell)).toBe(true);
    await cell.click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), { timeout: 15_000 });
    expect(await page.locator("[data-row]").count()).toBe(cellCount);
  });

  it("bascule l'entonnoir entre nombres et pourcentages", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

    const toggle = page.locator("[data-funnel-toggle]");
    await toggle.scrollIntoViewIfNeeded();
    expect(await reachable(toggle)).toBe(true);
    const before = await page.locator('[data-funnel-stage="replied"]').innerText();
    await toggle.click();
    await page.waitForURL((url) => url.searchParams.get("part") === "1", { timeout: 15_000 });
    const after = await page.locator('[data-funnel-stage="replied"]').innerText();

    expect(after).not.toBe(before);
    expect(after).toMatch(/%|—/);
  });

  it("garde le graphique et sa ligne de cible atteignables", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
    expect(await reachable(page.locator("svg").first())).toBe(true);
    expect(await page.locator("[data-target-line]").count()).toBeGreaterThan(0);
  });

  /**
   * Une période sans aucune ligne doit **expliquer**, jamais afficher un zéro
   * qui ressemble à un résultat. Une plage libre de deux jours d'il y a deux
   * ans ne porte rien, par construction.
   */
  it("explique une période vide au lieu d'afficher zéro", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage?periode=libre&du=2024-01-01&au=2024-01-02`, {
      waitUntil: "domcontentloaded",
    });
    const body = await page.locator("body").innerText();
    expect(body).toContain("Aucune donnée sur cette période");
    expect(await page.locator("[data-tile]").count()).toBe(0);
  });

  it("reste lisible sous les deux préférences de thème", async () => {
    for (const scheme of ["light", "dark"] as const) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        colorScheme: scheme,
        storageState: await session.page.context().storageState(),
      });
      await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
      expect(await reachable(page.locator("h1")), scheme).toBe(true);
      expect(await reachable(page.locator('[data-kpi="messages"]')), scheme).toBe(true);
      expect(await reachable(page.locator("[data-filter-bar]")), scheme).toBe(true);
      await page.close();
    }
  });

  /**
   * **Les anciens écrans de mesure, cliqués depuis un favori.**
   *
   * Un lien vieilli doit ouvrir le nouvel écran, pas une 404 qui ressemble à
   * une panne. La redirection est déclarée dans `next.config.ts` pour passer
   * **avant** le verrou d'espace : connecté ou non, on arrive à destination.
   */
  it("fait atterrir les anciennes adresses sur le pilotage", async () => {
    const { page } = session;
    for (const old of ["/performance", "/rapports"]) {
      await page.goto(`${BASE_URL}${old}`, { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname, old).toBe("/pilotage");
      expect(await reachable(page.locator("h1")), old).toBe(true);
    }
  });

  /**
   * Ce que les deux écrans amputés doivent encore montrer — et ne plus montrer.
   * Les bandeaux opérationnels restent : ce ne sont pas des indicateurs, ce
   * sont des pannes à réparer.
   */
  it("laisse /emails et l'accueil sans indicateur, mais avec leur travail", async () => {
    const { page } = session;

    await page.goto(`${BASE_URL}/emails`, { waitUntil: "domcontentloaded" });
    const emails = await page.locator("body").innerText();
    expect(emails).toContain("Emails");
    for (const gone of ["Entonnoir", "Ont ouvert", "Par signataire", "DM + email"]) {
      expect(emails, gone).not.toContain(gone);
    }

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const home = await page.locator("body").innerText();
    expect(home).toContain("À traiter maintenant");
    for (const gone of [
      "Entonnoir de prospection",
      "Ma semaine",
      "Contactés cette semaine",
      "en pipeline pondéré",
    ]) {
      expect(home, gone).not.toContain(gone);
    }
  });

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
