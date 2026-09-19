import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * La frise des étapes — **au clic**, parce que rien d'autre ne la juge.
 *
 * Ce jalon est une affaire de structure lue à l'œil : trois blocs séparés, un
 * connecteur qui porte le délai, un aperçu lisible **sans ouvrir**, et une
 * numérotation qui se referme quand on retire celle du milieu. Aucune de ces
 * quatre choses ne se vérifie dans le code — la précédente refonte d'un
 * contrôle « qui rend correctement et ne fait rien » a coûté le jalon 60.
 *
 * `reachable()` plutôt qu'`isVisible()`, toujours : le second ignore un
 * ancêtre qui rogne, et déclarerait verte une frise coupée.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const NAME = "E2E — frise des étapes";

describe.skipIf(skip)("les étapes d'une séquence se lisent comme une suite", () => {
  let browser: Browser;
  let session: Session;
  let campaignId: string;
  let mailboxId: string;

  beforeAll(async () => {
    const mailbox = await prisma.mailbox.upsert({
      where: { slug: "e2e-sequence-steps" },
      update: {},
      create: { slug: "e2e-sequence-steps", label: "E2E frise", signName: "Test" },
    });
    mailboxId = mailbox.id;

    const campaign = await prisma.campaign.create({
      data: { name: NAME, mailboxId, selection: "" },
    });
    campaignId = campaign.id;

    await prisma.emailSequence.create({
      data: {
        name: NAME,
        campaignId,
        steps: {
          create: [
            { position: 1, delayDays: 0, brief: "présenter la démonstration préparée" },
            { position: 2, delayDays: 4, brief: "relancer sans répéter le premier message" },
            { position: 3, delayDays: 7, brief: "clore poliment" },
          ],
        },
      },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD as string);
  }, 60_000);

  afterAll(async () => {
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.emailSequence.deleteMany({ where: { name: NAME } });
    await prisma.mailbox.deleteMany({ where: { slug: "e2e-sequence-steps" } });
    await browser?.close();
  });

  /**
   * La frise vit en bas de la page d'une campagne : sans amener le bloc dans
   * le champ, `reachable()` répondrait « non » pour la seule raison qu'il faut
   * défiler — ce qui n'est pas le défaut qu'on cherche.
   */
  const seen = async (locator: ReturnType<Session["page"]["getByText"]>) => {
    await locator.scrollIntoViewIfNeeded();
    return reachable(locator);
  };

  const open = async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Étape 1", { exact: false }).first().waitFor({ timeout: 15_000 });
  };

  it("montre trois blocs numérotés, séparés et reliés par leurs délais", async () => {
    const { page } = session;
    await open();

    for (const label of ["Étape 1", "Étape 2", "Étape 3"]) {
      expect(await seen(page.getByText(label, { exact: false }).first())).toBe(true);
    }

    // Des blocs réellement distincts : trois conteneurs, pas trois rangées.
    // Chaque étape est un `<section>` dans son `<li>` : trois conteneurs, pas
    // trois rangées de champs. (Les autres cartes de l'écran sont écartées par
    // le `li >`, sans quoi on mesurerait l'entonnoir.)
    const blocks = page.locator("li > section.rounded-card");
    expect(await blocks.count()).toBe(3);

    // La frise nomme le rythme sans qu'on ouvre quoi que ce soit.
    expect(await seen(page.getByText("J+4", { exact: true }).first())).toBe(true);
    expect(await seen(page.getByText("J+7", { exact: true }).first())).toBe(true);

    // Et les blocs sont bien empilés, le connecteur entre deux d'entre eux.
    const first = await blocks.nth(0).boundingBox();
    const second = await blocks.nth(1).boundingBox();
    expect(second!.y).toBeGreaterThan(first!.y + first!.height);
  }, 60_000);

  it("donne à lire le contenu de chaque étape sans l'ouvrir", async () => {
    const { page } = session;
    await open();

    for (const preview of [
      "présenter la démonstration préparée",
      "relancer sans répéter le premier message",
      "clore poliment",
    ]) {
      expect(await seen(page.getByText(preview, { exact: false }).first())).toBe(true);
    }

    // Replié par défaut : le champ d'édition n'est pas encore là.
    expect(await page.locator('input[type="number"]').count()).toBe(0);

    const toggle = page.getByRole("button", { name: "Ouvrir l'étape 2" });
    await toggle.scrollIntoViewIfNeeded();
    expect(await reachable(toggle)).toBe(true);
    await toggle.click();

    const field = page.locator('input[type="number"]').first();
    await field.scrollIntoViewIfNeeded();
    expect(await reachable(field)).toBe(true);
    expect(await field.inputValue()).toBe("4");
  }, 60_000);

  it("renumérote quand on retire celle du milieu", async () => {
    const { page } = session;
    await open();

    const toggle = page.getByRole("button", { name: "Ouvrir l'étape 2" });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    const remove = page.getByRole("button", { name: "Retirer l'étape 2" });
    await remove.scrollIntoViewIfNeeded();
    expect(await reachable(remove)).toBe(true);
    await remove.click();

    await page.waitForFunction(
      () => !document.body.innerText.includes("Étape 3"),
      undefined,
      { timeout: 15_000 },
    );
    // La troisième est devenue la deuxième, et c'est bien son contenu.
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toContain("Étape 2");
    expect(body).toContain("clore poliment");
    expect(body).not.toContain("relancer sans répéter le premier message");
  }, 60_000);

  it("reste lisible à 390×844", async () => {
    const { page } = session;
    await page.setViewportSize({ width: 390, height: 844 });
    await open();

    expect(await seen(page.getByText("Étape 3", { exact: false }).first())).toBe(true);
    expect(await seen(page.getByText("J+7", { exact: true }).first())).toBe(true);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 1440, height: 900 });
  }, 60_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
