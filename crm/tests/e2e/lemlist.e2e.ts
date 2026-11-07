import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **La synchronisation lemlist, dans un vrai navigateur.**
 *
 * Quatre choses qu'aucun test unitaire ne peut voir, et c'est pour elles que ce
 * fichier existe :
 *
 * 1. **la section est atteignable** — `reachable()`, jamais `isVisible()` : la
 *    seconde ne voit pas un ancêtre qui rogne, et c'est exactement le défaut du
 *    jalon 60, livré deux fois ;
 * 2. **les deux boutons font quelque chose** — un bouton qui rend bien et ne
 *    fait rien a été livré deux fois dans ce projet (jalons 56 et 59) ;
 * 3. **la clé n'est pas dans la page** — on lit le HTML réellement servi, pas
 *    l'intention du code. C'est la seule preuve qui vaille, et c'est celle du
 *    jalon 2 pour la clé Anthropic ;
 * 4. **une pastille du pilotage et la liste qu'elle ouvre comptent la même
 *    chose, événements lemlist compris** — l'invariant du jalon 109, vérifié
 *    sur des lignes importées.
 *
 * `E2E_LEMLIST_KEY` : la valeur exacte de `LEMLIST_API_KEY` du serveur sous
 * test. Sans elle, la recherche de clé dans la page est **sautée en le disant**
 * plutôt que de passer en ne cherchant rien — un test qui cherche la chaîne
 * vide trouve toujours, et affirmerait l'inverse de ce qu'il vérifie.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] lemlist ignoré : ni Chromium ni E2E_PASSWORD");
}

describeBrowser("la section lemlist de /reglages", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("s'ouvre avec son état, ses comptes et ses deux boutons", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });

    const panel = page.locator("[data-lemlist-panel]");
    await panel.scrollIntoViewIfNeeded();
    expect(await reachable(panel)).toBe(true);

    // L'état est l'un des quatre du vocabulaire, jamais une chaîne libre.
    const badge = page.locator("[data-lemlist-status]");
    expect(await reachable(badge)).toBe(true);
    const status = await badge.getAttribute("data-lemlist-status");
    expect(["connected", "missing_key", "refused", "unknown"]).toContain(status);

    /*
      **Les boutons sont cherchés dans le panneau, pas dans la page.**
      « Tester la connexion » existe déjà sur l'écran pour l'API Anthropic
      (« Tester la connexion à l'API », jalon 16) : chercher le nom dans toute
      la page en trouve deux et Playwright refuse de choisir. C'était un défaut
      de ce test, pas du produit.
    */
    for (const name of ["Synchroniser maintenant", "Tester la connexion"]) {
      const button = panel.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      expect(await reachable(button), name).toBe(true);
      expect(await button.isEnabled(), name).toBe(true);
    }

    // La date du dernier succès est dite, même quand il n'y en a pas.
    expect(await reachable(page.locator("[data-lemlist-last-success]"))).toBe(true);
  });

  /**
   * **La clé ne doit pas être dans le HTML servi.** Le panneau ne la reçoit
   * jamais : il reçoit un état, des comptes et des phrases. On le vérifie sur
   * les octets, parce que c'est le résultat qui compte et non l'intention.
   */
  it("ne porte la clé ni en clair ni encodée", async () => {
    const key = process.env.E2E_LEMLIST_KEY ?? "";
    if (key === "") {
      console.warn("[e2e] recherche de clé sautée : E2E_LEMLIST_KEY absente");
      return;
    }
    const { page } = session;
    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });
    const html = await page.content();
    expect(html).not.toContain(key);
    expect(html).not.toContain(Buffer.from(`:${key}`, "utf8").toString("base64"));
    // Et la valeur n'est pas non plus passée à l'état du composant.
    expect(html).not.toContain("LEMLIST_API_KEY=");
  });

  /**
   * **« Tester la connexion » dit quelque chose.** Lequel des quatre verdicts
   * dépend de l'environnement du serveur sous test ; ce qui est vérifié ici,
   * c'est qu'un clic produit une phrase et non un silence.
   */
  it("répond quelque chose au clic sur « Tester la connexion »", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });

    const button = page
      .locator("[data-lemlist-panel]")
      .getByRole("button", { name: "Tester la connexion", exact: true });
    await button.scrollIntoViewIfNeeded();
    expect(await reachable(button)).toBe(true);
    await button.click();

    const said = page.locator("[data-lemlist-said]");
    await expect.poll(async () => (await said.count()) > 0, { timeout: 30_000 }).toBe(true);
    const text = await said.innerText();
    expect(text.trim().length).toBeGreaterThan(10);
    // Quoi qu'il réponde, la clé n'est pas dans la réponse affichée.
    const key = process.env.E2E_LEMLIST_KEY ?? "";
    if (key !== "") expect(text).not.toContain(key);
  });

  /**
   * **« Synchroniser maintenant » relit l'état**, et la phrase rendue dit ce
   * qui s'est passé. Un bouton qui tourne sans rien dire est indiscernable d'un
   * bouton cassé.
   */
  it("répond quelque chose au clic sur « Synchroniser maintenant »", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });

    const button = page
      .locator("[data-lemlist-panel]")
      .getByRole("button", { name: "Synchroniser maintenant", exact: true });
    await button.scrollIntoViewIfNeeded();
    expect(await reachable(button)).toBe(true);
    await button.click();

    const said = page.locator("[data-lemlist-said]");
    await expect.poll(async () => (await said.count()) > 0, { timeout: 60_000 }).toBe(true);
    expect((await said.innerText()).trim().length).toBeGreaterThan(10);
  });
});

/**
 * **Les événements importés arrivent dans le pilotage**, et l'invariant du
 * jalon 109 tient sur eux.
 *
 * Ce fichier-ci ne refait pas tout `pilotage.e2e.ts` : il vérifie la seule
 * chose que le jalon 111 ajoute — qu'une campagne lemlist apparaît dans le
 * menu et dans « Campagnes côte à côte », et qu'une pastille filtrée sur elle
 * ouvre une liste de la même longueur.
 */
describeBrowser("les événements lemlist dans /pilotage", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("propose les campagnes lemlist dans le menu des campagnes", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

    const select = page.locator('[data-filter="campagne"]');
    await select.scrollIntoViewIfNeeded();
    expect(await reachable(select)).toBe(true);

    const values = await select.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLOptionElement).value),
    );
    /*
      Les clés sont préfixées par leur outil. S'il n'y a aucune campagne
      lemlist dans la base sous test, on ne l'affirme pas : on vérifie
      seulement que le menu ne mélange pas deux espaces de noms.
      La recette, elle, en importe et le relève.
    */
    const prefixed = values.filter((value) => value !== "");
    for (const value of prefixed) {
      expect(value, `clé de campagne non préfixée : ${value}`).toMatch(/^(crm|lemlist):/);
    }
  });

  /**
   * L'invariant du jalon 109 sur des lignes importées : on filtre sur une
   * campagne lemlist, on lit la pastille, on clique, on compte.
   */
  it("garde l'égalité pastille / liste quand le filtre est une campagne lemlist", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });

    const values = await page
      .locator('[data-filter="campagne"] option')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
    const lemlist = values.find((value) => value.startsWith("lemlist:"));
    if (lemlist === undefined) {
      console.warn("[e2e] aucune campagne lemlist dans cette base : contrôle sauté");
      return;
    }

    await page.goto(`${BASE_URL}/pilotage?campagne=${encodeURIComponent(lemlist)}&periode=mois`, {
      waitUntil: "domcontentloaded",
    });

    /*
      **Carte d'objectif depuis le jalon 113 v2**, et non plus pastille : les
      messages de la semaine sont devenus « valeur sur cible ». L'invariant
      vérifié n'a pas changé — le nombre affiché est la longueur de la liste
      qu'il ouvre, filtre de campagne lemlist compris —, seul le hameçon a suivi.
    */
    const card = page.locator('[data-objective="messages"]');
    await card.scrollIntoViewIfNeeded();
    expect(await reachable(card)).toBe(true);
    const shown = Number(await card.locator("[data-objective-value]").innerText());
    const tile = card.locator("a").first();
    await tile.click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), {
      timeout: 15_000,
    });

    const announced = Number(await page.locator("[data-list-count]").innerText());
    const rows = await page.locator("[data-row]").count();
    expect(announced, "la liste annonce le compte de la pastille").toBe(shown);
    expect(rows, `${shown} annoncés, ${rows} lignes`).toBe(shown);
  });

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
