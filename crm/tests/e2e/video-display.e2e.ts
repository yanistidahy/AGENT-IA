import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Le mode d'affichage de la vidéo, cliqué pour de vrai.**
 *
 * Ce qu'aucune lecture de code n'établit : que les deux modes soient réellement
 * **atteignables** — ce projet a livré deux fois un contrôle rendu dans un
 * conteneur qui le rogne (jalons 60, 79) —, et que le clic écrive en base au
 * lieu de rester un état d'écran (le défaut de `campaign-detail.tsx`, jalon 95).
 * L'assertion qui compte est donc `reachable()`, **jamais `isVisible()`**, qui ne
 * voit pas un ancêtre qui découpe.
 *
 * Le test sème sa vidéo, et remet la ligne d'avant.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

describe.skipIf(skip)("le mode d'affichage de la vidéo se choisit et s'enregistre", () => {
  let browser: Browser;
  let session: Session;
  let hadVideo = false;
  let display = "link";

  beforeAll(async () => {
    const settings = await prisma.settings.findUniqueOrThrow({
      where: { id: "singleton" },
      select: { videoDisplay: true },
    });
    display = settings.videoDisplay;
    hadVideo = (await prisma.mailVideo.count()) > 0;

    if (!hadVideo) {
      await prisma.mailVideo.create({
        data: {
          id: "singleton",
          kind: "hosted",
          url: "https://vimeo.com/e2evideo99",
          label: "Voir la démonstration en vidéo",
          poster: Buffer.alloc(64, 9),
          posterMime: "image/jpeg",
          posterWidth: 480,
          posterBytes: 64,
          posterGenerated: true,
          version: "e2ev99",
        },
      });
    }
    // Le défaut, pour que le test parte de l'état d'une installation neuve.
    await prisma.settings.update({
      where: { id: "singleton" },
      data: { videoDisplay: "link" },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  });

  afterAll(async () => {
    await browser?.close();
    if (!hadVideo) await prisma.mailVideo.deleteMany({ where: { id: "singleton" } });
    await prisma.settings.update({ where: { id: "singleton" }, data: { videoDisplay: display } });
    await prisma.$disconnect();
  });

  it("les deux modes sont atteignables, et le clic écrit en base", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "networkidle" });

    const lien = page.getByText("Lien texte", { exact: true }).first();
    await lien.scrollIntoViewIfNeeded();
    expect(await reachable(lien), "le mode « Lien texte » est atteignable").toBe(true);

    const vignette = page.getByText("Vignette", { exact: true }).first();
    await vignette.scrollIntoViewIfNeeded();
    expect(await reachable(vignette), "le mode « Vignette » est atteignable").toBe(true);

    // Le défaut se lit à l'écran : la radio « Lien texte » est cochée avant tout
    // clic, parce que c'est la colonne qui porte ce défaut.
    const radios = page.locator('input[name="video-display"]');
    expect(await radios.count()).toBe(2);
    expect(await radios.nth(0).isChecked(), "« Lien texte » coché par défaut").toBe(true);

    /*
      La radio est cochée par `check()` et **vérifiée** avant d'enregistrer : un
      clic posé avant l'hydratation est repris par React, qui repose la valeur
      d'origine — c'est le flottement payé au jalon 81 sur la page de connexion.
    */
    await radios.nth(1).check();
    await expect.poll(async () => await radios.nth(1).isChecked(), { timeout: 45_000 }).toBe(true);

    const save = page.getByRole("button", { name: "Enregistrer la vidéo" }).first();
    await save.scrollIntoViewIfNeeded();
    expect(await reachable(save), "« Enregistrer la vidéo » est atteignable").toBe(true);
    await save.click();

    // La base, pas l'écran : un contrôle qui change d'apparence sans rien écrire
    // est précisément le défaut qu'on cherche à empêcher.
    await expect
      .poll(
        async () =>
          (
            await prisma.settings.findUniqueOrThrow({
              where: { id: "singleton" },
              select: { videoDisplay: true },
            })
          ).videoDisplay,
        { timeout: 45_000 },
      )
      .toBe("thumbnail");

    // Et le retour au lien texte s'écrit aussi : le réglage n'est pas à sens
    // unique, et « Lien texte » reste le mode recommandé en prospection froide.
    // On attend la fin du premier enregistrement : il réécrit la file, donc il
    // dure, et le bouton est désactivé pendant ce temps.
    await page.getByText("Enregistrée.", { exact: false }).first().waitFor({ timeout: 45_000 });
    await radios.nth(0).check();
    await expect.poll(async () => await radios.nth(0).isChecked(), { timeout: 45_000 }).toBe(true);
    await page.getByRole("button", { name: "Enregistrer la vidéo" }).first().click();
    await expect
      .poll(
        async () =>
          (
            await prisma.settings.findUniqueOrThrow({
              where: { id: "singleton" },
              select: { videoDisplay: true },
            })
          ).videoDisplay,
        { timeout: 45_000 },
      )
      .toBe("link");

    expect(session.errors).toEqual([]);
  }, 240_000);
});
