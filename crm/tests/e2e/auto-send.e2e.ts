import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **L'interrupteur et l'intervalle se cliquent.**
 *
 * Deux contrôles livrés dans ce projet rendaient correctement et ne faisaient
 * rien (jalons 56 et 60) : une lecture de code ne voit pas un `overflow-hidden`
 * posé deux composants plus haut. L'assertion qui compte est donc
 * **`reachable()`, jamais `isVisible()`**.
 *
 * Le test remet l'envoi automatique éteint à la fin : laisser un interrupteur
 * armé par une recette ferait partir de vrais messages au tour suivant.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

let browser: Browser | null = null;
let session: Session | null = null;

async function turnOff(): Promise<void> {
  await prisma.autoSend.updateMany({
    where: { id: "singleton" },
    data: { enabled: false, dueAt: null, failures: 0, stoppedReason: "" },
  });
}

describe.skipIf(skip)("l'envoi automatique se pilote au clic", () => {
  beforeAll(async () => {
    await turnOff();
    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  });

  afterAll(async () => {
    await browser?.close();
    await turnOff();
    await prisma.$disconnect();
  });

  it("l'interrupteur bascule, et la base le suit", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    await page.goto(`${BASE_URL}/departs`, { waitUntil: "networkidle" });

    const panel = page.getByLabel("Envoi automatique");
    expect(await reachable(panel)).toBe(true);

    const on = page.getByRole("button", { name: "Activer l'envoi automatique" });
    expect(await reachable(on)).toBe(true);

    /*
      **Le clic attend l'hydratation.** Un bouton cliqué avant que React ait
      repris la page ne déclenche rien, et l'écran paraît mort — c'est le
      flottement payé au jalon 81 sur la page de connexion.
    */
    await expect
      .poll(
        async () => {
          if (await on.isVisible().catch(() => false)) await on.click().catch(() => {});
          const row = await prisma.autoSend.findUnique({ where: { id: "singleton" } });
          return row?.enabled ?? false;
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    const off = page.getByRole("button", { name: "Arrêter l'envoi automatique" });
    expect(await reachable(off)).toBe(true);

    // **Éteindre efface l'échéance** : rien de déjà programmé ne part ensuite.
    await expect
      .poll(
        async () => {
          if (await off.isVisible().catch(() => false)) await off.click().catch(() => {});
          const row = await prisma.autoSend.findUnique({ where: { id: "singleton" } });
          return `${row?.enabled ?? true}:${row?.dueAt === null}`;
        },
        { timeout: 20_000 },
      )
      .toBe("false:true");

    expect(current.errors).toEqual([]);
  }, 90_000);

  it("l'intervalle se modifie et s'enregistre", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    await page.goto(`${BASE_URL}/departs`, { waitUntil: "networkidle" });

    const settings = page.getByRole("button", { name: "Réglages" });
    expect(await reachable(settings)).toBe(true);

    const minutes = page.getByLabel("Intervalle, minutes");
    await expect
      .poll(
        async () => {
          if (!(await minutes.isVisible().catch(() => false))) {
            await settings.click().catch(() => {});
          }
          return minutes.isVisible().catch(() => false);
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    expect(await reachable(minutes)).toBe(true);
    const seconds = page.getByLabel("Intervalle, secondes");
    expect(await reachable(seconds)).toBe(true);

    await minutes.fill("3");
    await seconds.fill("30");

    const save = page.getByRole("button", { name: "Enregistrer les réglages" });
    expect(await reachable(save)).toBe(true);

    await expect
      .poll(
        async () => {
          if (await save.isEnabled().catch(() => false)) await save.click().catch(() => {});
          const row = await prisma.autoSend.findUnique({ where: { id: "singleton" } });
          return row?.intervalSeconds ?? 0;
        },
        { timeout: 20_000 },
      )
      .toBe(210);

    expect(current.errors).toEqual([]);
  }, 90_000);
});
