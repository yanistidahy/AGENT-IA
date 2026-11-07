import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Onglet « Vue d'ensemble », cliqué pour de vrai.**
 *
 * Quatre choses qu'aucun test unitaire ne peut voir, et c'est pour elles que ce
 * fichier existe :
 *
 * 1. **les cartes et les filtres sont atteignables** — `reachable()`, jamais
 *    `isVisible()` : la seconde ne voit pas un ancêtre qui rogne, et c'est
 *    exactement le défaut du jalon 60 ;
 * 2. **un nombre et la liste qu'il ouvre comptent la même chose** — relevé dans
 *    le DOM, pas dans le HTML brut (le flux RSC y répète le balisage, ce qui
 *    double tout comptage fait au `grep`) ;
 * 3. **l'entonnoir bascule entre nombres et passage**, et le passage n'est pas
 *    la part des contactés — ce sont deux questions différentes ;
 * 4. **l'écran tient en clair comme en sombre** — le produit n'a qu'un thème
 *    clair (voir CLAUDE.md) ; on vérifie sous les deux préférences du système
 *    que le texte reste atteignable, au lieu d'affirmer un thème sombre qui
 *    n'existe pas.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] pilotage ignoré : ni Chromium ni E2E_PASSWORD");
}

describeBrowser("la vue d'ensemble", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("ouvre ses onglets, sa barre de filtres et ses sept cartes", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

    expect(await reachable(page.locator("h1"))).toBe(true);
    expect(await reachable(page.locator("[data-board-tabs]"))).toBe(true);
    expect(await reachable(page.locator("[data-filter-bar]"))).toBe(true);

    // Les sept filtres du prototype. La tranche de taille n'y est pas : c'est
    // l'onglet « Segments » qui la pose, et son absence ici est voulue.
    for (const filter of ["periode", "campagne", "canal", "proprietaire", "niche", "fonction", "origine"]) {
      expect(await reachable(page.locator(`[data-filter="${filter}"]`)), filter).toBe(true);
    }
    expect(await page.locator('[data-filter="taille"]').count()).toBe(0);

    // Trois cartes d'objectif, quatre indicateurs.
    expect(await page.locator("[data-objective]").count()).toBe(3);
    expect(await page.locator("[data-kpi]").count()).toBe(4);
    for (const metric of ["messages", "demos_sent", "qualified"]) {
      const card = page.locator(`[data-objective="${metric}"]`);
      expect(await reachable(card), metric).toBe(true);
    }
  }, 90_000);

  /**
   * **Chaque taux porte son `n`, et c'est la promesse centrale du jalon.**
   *
   * « 12 % » affiché pareil sur neuf personnes et sur trois cents est la façon
   * la plus courante de tromper quelqu'un avec un chiffre exact.
   */
  it("affiche le n et la fiabilité sous le taux de réponse", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

    const card = page.locator('[data-kpi="reply_rate"]');
    await card.scrollIntoViewIfNeeded();
    expect(await reachable(card)).toBe(true);

    const sample = await card.locator("[data-sample]").innerText();
    expect(sample, "le n n'est pas écrit").toMatch(/\d+ sur \d+ personnes?/);

    const chip = card.locator("[data-reliability]");
    expect(await reachable(chip)).toBe(true);
    const state = await chip.getAttribute("data-reliability");
    expect(["unusable", "weak", "solid"]).toContain(state);
    // Le mot, pas seulement la teinte : un daltonien ne distingue pas l'ambre
    // du vert.
    expect(await chip.innerText()).toMatch(/interpréter|faible|fiable/);
  }, 90_000);

  /**
   * **L'invariant du jalon 109, vérifié au clic.** Le nombre est lu sur la
   * carte, puis les lignes de la liste sont comptées. Les deux viennent du même
   * appel ; le test le prouve sur l'écran plutôt qu'en relisant le code.
   */
  it("ouvre derrière chaque objectif une liste de la même longueur", async () => {
    const { page } = session;

    for (const metric of ["messages", "demos_sent", "qualified"]) {
      await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
      const card = page.locator(`[data-objective="${metric}"]`);
      if ((await card.count()) === 0) continue;

      const shown = Number(await card.locator("[data-objective-value]").innerText());
      await card.scrollIntoViewIfNeeded();
      const link = card.locator("a").first();
      expect(await reachable(link), metric).toBe(true);
      await link.click();
      await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), {
        timeout: 15_000,
      });

      const announced = Number(await page.locator("[data-list-count]").innerText());
      const rows = await page.locator("[data-row]").count();
      expect(announced, `${metric} : la liste annonce autre chose que la carte`).toBe(shown);
      expect(rows, `${metric} : ${shown} annoncés, ${rows} lignes`).toBe(shown);
    }
  }, 120_000);

  it("ouvre aussi la liste derrière une marche de l'entonnoir", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

    const stage = page.locator('[data-funnel-stage="contacted"]');
    /*
      **On descend d'abord, comme un humain.** `reachable()` interroge le point
      au centre de l'élément : un élément hors du cadre n'est pas atteignable, et
      c'est exact. Un tableau de bord est plus haut qu'un écran, et le restera.
    */
    await stage.scrollIntoViewIfNeeded();
    expect(await reachable(stage)).toBe(true);
    const shown = Number(await stage.getAttribute("data-count"));
    await stage.locator("a").first().click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), { timeout: 15_000 });
    expect(await page.locator("[data-row]").count()).toBe(shown);

    // Et le retour ramène sur l'onglet d'où l'on vient, pas sur un autre.
    await page.locator("a", { hasText: "Retour" }).first().click();
    await page.waitForURL((url) => url.pathname === "/pilotage", { timeout: 15_000 });
  }, 120_000);

  /**
   * **Nombres contre passage, et le passage n'est pas la part des contactés.**
   *
   * « 4 % des contactés ont testé la démo » dit où l'on en est ; « 80 % de ceux
   * qui l'ont reçue l'ont testée » dit quelle marche coince. Le test vérifie que
   * la bascule change bien de question : la marche « Ont répondu » rend un
   * pourcentage, et la première marche garde son nombre.
   */
  it("bascule l'entonnoir entre nombres et passage", async () => {
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
    // La première marche n'a pas de précédente : un tiret s'y lirait comme une
    // donnée manquante, alors que c'est le point de départ.
    expect(await page.locator('[data-funnel-stage="contacted"]').innerText()).not.toContain("—");
  }, 90_000);

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
    // Les cartes d'objectif restent — un objectif existe même sans travail
    // fourni —, et elles affichent zéro contre leur cible, ce qui est le fait.
    expect(await page.locator("[data-objective]").count()).toBe(3);
  }, 90_000);

  it("reste lisible sous les deux préférences de thème", async () => {
    for (const scheme of ["light", "dark"] as const) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        colorScheme: scheme,
        storageState: await session.page.context().storageState(),
      });
      await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
      expect(await reachable(page.locator("h1")), scheme).toBe(true);
      expect(await reachable(page.locator('[data-objective="messages"]')), scheme).toBe(true);
      expect(await reachable(page.locator("[data-filter-bar]")), scheme).toBe(true);
      await page.close();
    }
  }, 90_000);

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
  }, 90_000);

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
  }, 90_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
