import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Le logo de marque, aux quatre endroits qu'il doit tenir.
 *
 * Ce fichier existe parce que « une seule source, quatre surfaces » est
 * exactement le genre de promesse qui se vérifie à l'œil et jamais au
 * typecheck : un `<img>` qui pointe vers la mauvaise route, une favicon restée
 * sur le tracé dessiné ou un repli qui ne revient pas quand on retire le logo
 * ne font échouer aucun test statique (leçon du jalon 60).
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

describe.skipIf(skip)("le logo de marque, aux quatre endroits", () => {
  let browser: Browser;
  let session: Session;
  let version = "";

  beforeAll(async () => {
    const logo = await prisma.mailLogo.findUnique({ where: { id: "singleton" } });
    version = logo?.version ?? "";

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("le rail sert le rendu d'interface, pas celui de la signature", async () => {
    await session.page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded" });
    const mark = session.page.locator("aside img").first();

    if (version === "") {
      // Aucun logo : le tracé dessiné garde sa place. C'est le comportement
      // voulu, pas un état d'erreur — une installation neuve doit ressembler
      // à quelque chose.
      expect(await mark.count()).toBe(0);
      expect(await session.page.locator("aside svg").first().count()).toBe(1);
      return;
    }

    expect(await reachable(mark)).toBe(true);
    // **`/app` et non la route de courriel** : le rendu de 120 px étiré à la
    // taille du rail serait mou, et c'est toute la raison du second fichier.
    expect(await mark.getAttribute("src")).toBe(`/api/logo/${version}/app`);

    // Net, et non l'image de courriel agrandie : la source doit être plus
    // large que ce qui est affiché.
    const natural = await mark.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    const box = await mark.boundingBox();
    expect(natural).toBeGreaterThan(box?.width ?? 0);
  });

  it("la favicon suit la même source", async () => {
    await session.page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded" });
    const href = await session.page
      .locator('link[rel="icon"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    if (version === "") {
      // Rien de déclaré : Next sert `app/icon.svg`, le tracé dessiné.
      expect(href === null || href.includes("icon.svg")).toBe(true);
      return;
    }
    expect(href).toContain(`/api/logo/${version}/app`);
  });

  it("la page de connexion porte le logo sans session", async () => {
    // La route est publique précisément pour cet écran : il s'affiche par
    // définition sans cookie, et un logo privé y laisserait un trou.
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    const img = page.locator("h1 img").first();

    if (version === "") {
      expect(await img.count()).toBe(0);
    } else {
      expect(await img.count()).toBe(1);
      const response = await page.request.get(`${BASE_URL}/api/logo/${version}/app`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
    }
    await page.close();
  });

  it("une version inconnue rend 404, jamais l'image courante", async () => {
    // Servir autre chose que ce qui est demandé ferait mentir le cache.
    const response = await session.page.request.get(`${BASE_URL}/api/logo/inconnu/app`);
    expect(response.status()).toBe(404);
  });

  it("rien n'a été écrit dans la console", () => {
    expect(session.errors).toEqual([]);
  });
});
