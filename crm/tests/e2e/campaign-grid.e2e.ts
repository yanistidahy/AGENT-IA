import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * `/campagnes` en deux niveaux : une grille pour choisir, une page pour
 * travailler.
 *
 * **Ce test clique, et c'est le seul moyen.** Ce qui a été reproché à l'écran
 * précédent — « je fais défiler beaucoup et je vois peu » — ne se lit pas dans
 * le code : il faut mesurer combien de vignettes tiennent réellement dans un
 * écran, et vérifier qu'une vignette ne porte pas ce qui appartient au détail.
 * C'est la leçon du jalon 60, où un contrôle rendu correctement ne faisait
 * rien parce qu'un ancêtre le rognait.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

describe.skipIf(skip)("les campagnes, en grille puis en détail", () => {
  let browser: Browser;
  let session: Session;
  let mailboxId = "";
  const ids: string[] = [];
  const names = ["E2E grille A", "E2E grille B", "E2E grille C", "E2E grille D"];

  beforeAll(async () => {
    const box = await prisma.mailbox.upsert({
      where: { slug: "e2e-grid" },
      update: {},
      create: {
        slug: "e2e-grid",
        label: "E2E Grille",
        signName: "Camille Rouvier",
        signTitle: "Fondatrice, Aura Flow AI",
        smtpFrom: "camille@e2e.test",
      },
    });
    mailboxId = box.id;

    for (const name of names) {
      const campaign = await prisma.campaign.create({ data: { name, mailboxId, selection: "" } });
      ids.push(campaign.id);
      await prisma.emailSequence.create({
        data: {
          name,
          active: true,
          campaignId: campaign.id,
          steps: { create: [{ position: 1, delayDays: 0, brief: "Angle SAV." }] },
        },
      });
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await prisma.emailSequence.deleteMany({ where: { campaignId: { in: ids } } });
    await prisma.campaign.deleteMany({ where: { id: { in: ids } } });
    await prisma.mailbox.deleteMany({ where: { id: mailboxId } });
  });

  it("la liste est une grille : plusieurs vignettes par rangée", async () => {
    await session.page.setViewportSize({ width: 1440, height: 900 });
    await session.page.goto(`${BASE_URL}/campagnes`, { waitUntil: "domcontentloaded" });
    await session.page.waitForTimeout(800);

    const tiles = session.page.locator('a[href^="/campagnes/"]');
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(names.length);

    const boxes: { x: number; y: number; height: number }[] = [];
    for (let i = 0; i < count; i += 1) {
      const box = await tiles.nth(i).boundingBox();
      if (box !== null) boxes.push(box);
    }
    const first = boxes[0];
    expect(first).toBeDefined();
    if (first === undefined) return;

    // Plusieurs par rangée, sinon ce n'est pas une grille mais la pile d'avant.
    const perRow = boxes.filter((box) => Math.round(box.y) === Math.round(first.y)).length;
    expect(perRow).toBeGreaterThanOrEqual(2);

    // Quatre visibles sans défiler : c'est la demande, et elle se mesure.
    const visible = boxes.filter((box) => box.y + box.height <= 900).length;
    expect(visible).toBeGreaterThanOrEqual(4);
  });

  it("une vignette porte le nécessaire, et rien du détail", async () => {
    const tile = session.page.locator(`a[href="/campagnes/${ids[0]}"]`).first();
    expect(await reachable(tile)).toBe(true);

    const text = await tile.innerText();
    expect(text).toContain(names[0]);
    expect(text).toContain("E2E Grille");
    expect(text).toContain("Camille Rouvier");
    expect(text).toMatch(/EN COURS|BROUILLON|ARCHIVÉE/);
    for (const figure of ["INSCRITS", "ENVOYÉS", "RÉPONSES"]) expect(text).toContain(figure);
    expect(await tile.locator('[role="progressbar"]').count()).toBe(1);

    // Ce qui appartient au détail n'a pas à encombrer la vignette — c'est tout
    // l'objet de la restructuration.
    expect(await tile.locator("textarea, select, input").count()).toBe(0);
    expect(text).not.toContain("Consigne");
    expect(text).not.toContain("Sélection");
  });

  it("cliquer une vignette ouvre la page de la campagne", async () => {
    await session.page.locator(`a[href="/campagnes/${ids[0]}"]`).first().click();
    await session.page.waitForURL(new RegExp(`/campagnes/${ids[0]}$`), { timeout: 10_000 });
    await session.page.waitForTimeout(800);

    const body = await session.page.innerText("body");
    expect(body).toContain("Envoyée depuis et signée par");
    expect(body).toContain("Écrire les mails");
    expect(body).toMatch(/Lancer|Mettre en pause/);
    expect(body).toMatch(/Archiver|Désarchiver/);
    // `innerText` rend le texte **tel qu'il s'affiche** : le titre du bloc est
    // en petites capitales CSS, donc il remonte en majuscules.
    expect(body).toMatch(/Inscrits/i);
    expect(body).toContain("Voir ses départs du jour");
    // Les étapes sont éditables ici, et seulement ici — mais **repliées**
    // depuis le jalon 80 : la structure d'abord, le champ à l'ouverture.
    expect(body).toContain("Étape 1");
    expect(await session.page.locator('input[placeholder^="ex. rappeler"]').count()).toBe(0);
    await session.page.getByRole("button", { name: "Ouvrir l'étape 1" }).click();
    expect(
      await session.page.locator('input[placeholder^="ex. rappeler"]').count(),
    ).toBeGreaterThan(0);
  });

  it("les deux niveaux tiennent à 390 px", async () => {
    await session.page.setViewportSize({ width: 390, height: 844 });
    await session.page.waitForTimeout(400);

    const overflow = async () =>
      session.page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);

    // La cible tactile de l'action primaire fait bien ses 44 px (jalon 46).
    const write = session.page.locator("button").filter({ hasText: "Écrire les mails" }).first();
    const box = await write.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await session.page.goto(`${BASE_URL}/campagnes`, { waitUntil: "domcontentloaded" });
    await session.page.waitForTimeout(800);
    expect(await overflow()).toBeLessThanOrEqual(0);

    const tiles = session.page.locator('a[href^="/campagnes/"]');
    const firstBox = await tiles.first().boundingBox();
    let perRow = 0;
    for (let i = 0; i < (await tiles.count()); i += 1) {
      const box2 = await tiles.nth(i).boundingBox();
      if (box2 !== null && firstBox !== null && Math.round(box2.y) === Math.round(firstBox.y)) {
        perRow += 1;
      }
    }
    // Une colonne sous `lg` : deux vignettes côte à côte à 390 px ne
    // laisseraient de place ni au nom ni aux trois nombres.
    expect(perRow).toBe(1);
  });

  it("rien n'a été écrit dans la console", () => {
    expect(session.errors).toEqual([]);
  });
});
