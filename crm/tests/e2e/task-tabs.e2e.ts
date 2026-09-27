import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Les onglets, les filtres et « Démarrer » se cliquent.**
 *
 * Deux contrôles livrés dans ce projet rendaient correctement et ne faisaient
 * rien (jalons 56 et 60) : une lecture de code ne voit pas un `overflow-hidden`
 * posé deux composants plus haut. L'assertion qui compte est donc
 * **`reachable()`, jamais `isVisible()`** — celle-ci ne voit pas un ancêtre qui
 * rogne.
 *
 * Ce test vérifie aussi ce qu'aucun test unitaire ne peut voir : qu'un onglet
 * enregistré par « + » **survive à un rechargement** et rende la même liste,
 * parce que sa requête vit dans l'URL.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const TAG = "E2eTabs92";

let browser: Browser | null = null;
let session: Session | null = null;

async function wipe(): Promise<void> {
  await prisma.task.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.taskTab.deleteMany({ where: { name: { startsWith: TAG } } });
}

describe.skipIf(skip)("l'écran Tâches se pilote au clic", () => {
  beforeAll(async () => {
    await wipe();
    const now = Date.now();
    await prisma.task.create({
      data: {
        title: `${TAG} Appeler le prospect`,
        due: new Date(now - 86_400_000),
        owner: `${TAG}Owner`,
        priority: "haute",
      },
    });
    await prisma.task.create({
      data: {
        title: `${TAG} Préparer le devis`,
        due: new Date(now),
        owner: `${TAG}Owner`,
        priority: "basse",
      },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  });

  afterAll(async () => {
    await browser?.close();
    await wipe();
    await prisma.$disconnect();
  });

  it("chaque onglet est atteignable, et sa pastille égale sa liste", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    await page.goto(`${BASE_URL}/taches`, { waitUntil: "networkidle" });

    const tabs = ["Vos tâches", "Appels", "À envoyer", "Prospects chauds", "Réponses des prospects", "Toutes les tâches"];
    for (const label of tabs) {
      const pill = page.getByRole("tab").filter({ hasText: label }).first();
      expect(await reachable(pill), `onglet ${label}`).toBe(true);
    }

    /*
      **La pastille et la liste, comparées à l'écran.** C'est l'assertion du
      jalon : deux nombres justes chacun de son côté et affichés l'un au-dessus
      de l'autre sont exactement le défaut qu'on ferme.
    */
    for (const label of tabs) {
      const pill = page.getByRole("tab").filter({ hasText: label }).first();
      const badge = Number.parseInt(((await pill.textContent()) ?? "").replace(/\D+/g, ""), 10);
      await pill.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);

      const shown = await page.locator("main article").count();
      const range = (await page.locator("main nav span.font-mono").first().textContent()) ?? "";
      const total = Number.parseInt(range.split("de").pop()?.trim() ?? "0", 10);
      if (Number.isNaN(badge)) continue;
      if (badge === 0) expect(shown).toBe(0);
      else expect(total, `onglet ${label} : pastille ${badge}`).toBe(badge);
    }
    expect(current.errors).toEqual([]);
  }, 90_000);

  it("deux filtres qui masquent tout le disent, et « Retirer les filtres » rend la liste", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    await page.goto(`${BASE_URL}/taches?onglet=toutes`, { waitUntil: "networkidle" });
    const before = await page.locator("main article").count();
    expect(before).toBeGreaterThan(0);

    await page.goto(
      `${BASE_URL}/taches?onglet=toutes&proprietaire=${TAG}Owner&priorite=normale`,
      { waitUntil: "networkidle" },
    );

    const message = page.getByText(/filtres actifs masquent/).first();
    expect(await reachable(message)).toBe(true);
    expect((await message.textContent()) ?? "").toMatch(/2 filtres actifs masquent \d+ tâches/);

    const clear = page.getByRole("button", { name: "Retirer les filtres" });
    expect(await reachable(clear)).toBe(true);
    await clear.click();
    // L'URL change sans nouvelle navigation : on attend la liste, pas le réseau.
    await expect.poll(() => page.locator("main article").count(), { timeout: 15_000 }).toBe(before);
    expect(current.errors).toEqual([]);
  }, 90_000);

  it("un onglet enregistré par « + » survit au rechargement et rend la même liste", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    await page.goto(`${BASE_URL}/taches?onglet=toutes&proprietaire=${TAG}Owner`, {
      waitUntil: "networkidle",
    });
    const expected = await page.locator("main article").count();
    expect(expected).toBeGreaterThan(0);

    const plus = page.getByRole("button", { name: "Enregistrer cette vue comme onglet" });
    expect(await reachable(plus)).toBe(true);
    await plus.click();

    const name = page.getByPlaceholder("Nom de l'onglet");
    expect(await reachable(name)).toBe(true);
    await name.fill(`${TAG} à moi`);
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

    const saved = page.getByRole("button", { name: `${TAG} à moi`, exact: true });
    await saved.waitFor({ state: "attached", timeout: 15_000 });
    expect(await reachable(saved)).toBe(true);

    // Rechargement : l'onglet est en base, sa requête dans l'URL.
    await page.goto(`${BASE_URL}/taches`, { waitUntil: "networkidle" });
    const again = page.getByRole("button", { name: `${TAG} à moi`, exact: true });
    expect(await reachable(again)).toBe(true);
    /*
      **Le clic attend l'hydratation.** Un onglet cliqué avant que React ait
      repris la page ne déclenche rien, et l'écran paraît mort — c'est le
      flottement payé au jalon 81 sur la page de connexion. On reclique jusqu'à
      ce que la requête enregistrée arrive dans l'URL.
    */
    await expect
      .poll(
        async () => {
          if (!page.url().includes("proprietaire=")) await again.click();
          return page.url();
        },
        { timeout: 15_000 },
      )
      .toContain("proprietaire=");
    await page.waitForLoadState("networkidle");
    // La requête enregistrée est de retour dans l'URL : c'est elle qui rejoue la vue.
    expect(page.url()).toContain("proprietaire=");
    expect(await page.locator("main article").count()).toBe(expected);
    expect(current.errors).toEqual([]);
  }, 90_000);

  it("« Démarrer » ouvre la première ligne en focus, et « Quitter » revient", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    await page.goto(`${BASE_URL}/taches?onglet=toutes&proprietaire=${TAG}Owner`, {
      waitUntil: "networkidle",
    });

    const start = page.getByRole("button", { name: "Démarrer" });
    expect(await reachable(start)).toBe(true);
    await start.click();

    const quit = page.getByRole("button", { name: "Quitter" });
    expect(await reachable(quit)).toBe(true);
    const skipButton = page.getByRole("button", { name: "Passer" });
    expect(await reachable(skipButton)).toBe(true);

    // On avance : le compteur suit, ce qui prouve que « Passer » fait avancer.
    const counter = page.getByText(/^\d+ sur \d+$/).first();
    expect(await reachable(counter)).toBe(true);
    expect((await counter.textContent()) ?? "").toContain("1 sur");
    await skipButton.click();
    await expect.poll(() => counter.textContent(), { timeout: 10_000 }).toContain("2 sur");

    await quit.click();
    expect(await reachable(page.getByRole("button", { name: "Démarrer" }))).toBe(true);
    expect(current.errors).toEqual([]);
  }, 90_000);
});
