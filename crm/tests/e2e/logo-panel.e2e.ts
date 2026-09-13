import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Le panneau du logo, au clic.
 *
 * Ce fichier existe pour une raison précise : l'aperçu du logo dépendait
 * d'abord de `CRM_PUBLIC_URL`, si bien qu'il disparaissait sur toute
 * installation où cette variable n'est pas posée — c'est-à-dire au moment
 * exact où l'on veut vérifier à quoi ressemble l'image qu'on vient de choisir.
 * Le défaut ne se voyait ni au typecheck ni dans la suite : il fallait ouvrir
 * l'écran (leçon du jalon 60).
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

describe.skipIf(skip)("le panneau du logo", () => {
  let browser: Browser;
  let session: Session;
  let version = "";

  beforeAll(async () => {
    const logo = await prisma.mailLogo.findUnique({ where: { id: "singleton" } });
    version = logo?.version ?? "";

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
    await session.page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });
    await session.page.waitForTimeout(1500);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  const panel = () =>
    session.page
      .getByRole("heading", { name: "Logo", exact: true })
      .locator("xpath=ancestor::section[1]");

  it("le panneau est à l'écran, sans avoir rien à déplier", async () => {
    await panel().scrollIntoViewIfNeeded();
    expect(await panel().count()).toBe(1);
    expect(await reachable(panel().getByRole("heading", { name: "Logo", exact: true }))).toBe(
      true,
    );
  });

  it("l'aperçu s'affiche par un chemin relatif, donc toujours", async () => {
    if (version === "") return; // aucun logo en base : rien à apercevoir.
    await panel().scrollIntoViewIfNeeded();
    const img = panel().locator("img").first();
    expect(await reachable(img)).toBe(true);
    // **Relatif, pas absolu** : c'est le défaut corrigé au jalon 62. Une
    // adresse absolue rendrait l'aperçu dépendant d'un réglage de
    // déploiement qui n'a rien à voir avec l'affichage de cet écran.
    expect(await img.getAttribute("src")).toBe(`/api/logo/${version}`);
    expect(await img.getAttribute("alt")).toBe("Aura Flow AI");
  });

  it("le fichier servi est bien une image, pas une page d'erreur", async () => {
    if (version === "") return;
    const response = await session.page.request.get(`${BASE_URL}/api/logo/${version}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });

  it("le téléphone de chaque boîte est saisissable, et distinct", async () => {
    const phones = session.page.locator('input[placeholder="07 85 28 35 36"]');
    expect(await phones.count()).toBeGreaterThan(0);
    // `reachable()` exige le viewport courant — c'est ce qui attrape un
    // contrôle rogné. Le champ vit plus haut dans la page, on y va comme un
    // doigt le ferait.
    await phones.first().scrollIntoViewIfNeeded();
    expect(await reachable(phones.first())).toBe(true);
  });

  it("rien n'a été écrit dans la console", () => {
    expect(session.errors).toEqual([]);
  });
});
