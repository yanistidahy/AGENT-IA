import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **La puce « {notresite} », et l'aperçu qui la rend cliquable.**
 *
 * Trois choses qu'aucune lecture de code n'établit : qu'une puce soit
 * réellement **atteignable** — ce projet a livré deux fois un contrôle rendu
 * dans un conteneur qui le rogne (jalons 60, 79) —, qu'elle insère au curseur,
 * et que l'aperçu montre une **ancre** plutôt qu'une adresse en texte brut.
 * L'assertion qui compte est donc `reachable()`, **jamais `isVisible()`**, qui
 * ne voit pas un ancêtre qui découpe.
 *
 * Le test sème sa campagne et l'efface.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const TAG = "E2eNotreSite";

describe.skipIf(skip)("{notresite} s'insère et s'affiche en lien", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";

  async function wipe(): Promise<void> {
    await prisma.sequenceEnrollment.deleteMany({
      where: { sequence: { name: { startsWith: TAG } } },
    });
    await prisma.emailSequence.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.contact.deleteMany({ where: { lastName: { startsWith: TAG } } });
    await prisma.campaign.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.company.deleteMany({ where: { name: { startsWith: TAG } } });
  }

  beforeAll(async () => {
    await wipe();
    // L'adresse est réglée une fois, dans /reglages : le rendu et l'aperçu la
    // lisent tous les deux depuis là.
    await prisma.settings.update({
      where: { id: "singleton" },
      data: { ourSiteUrl: "https://auraflowai.fr/" },
    });

    const company = await prisma.company.create({ data: { name: `${TAG} Maison` } });
    const mailbox = await prisma.mailbox.findFirstOrThrow({ select: { id: true } });
    const campaign = await prisma.campaign.create({
      data: {
        name: `${TAG} campagne`,
        mailboxId: mailbox.id,
        mode: "manual",
        sequence: {
          create: {
            name: `${TAG} campagne`,
            active: true,
            steps: {
              create: {
                position: 1,
                delayDays: 0,
                brief: "",
                mode: "manual",
                subject: "Objet {marque}",
                body: "Bonjour {prenom},\n\nDécouvrez notre solution sur {notresite}.",
              },
            },
          },
        },
      },
      include: { sequence: true },
    });
    campaignId = campaign.id;

    const contact = await prisma.contact.create({
      data: {
        firstName: "Nora",
        lastName: `${TAG} Fiche`,
        nameKey: `nora e2enotresite fiche`,
        title: "Fondatrice",
        lifecycle: "Prospect",
        email: "nora@e2enotresite.test",
        companyId: company.id,
        contactGroup: "direction",
        groupSetBy: "auto",
      },
    });
    await prisma.sequenceEnrollment.create({
      data: {
        sequenceId: campaign.sequence?.id ?? "",
        contactId: contact.id,
        status: "active",
        lastStep: 0,
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

  it("l'aperçu rend une ancre, et la balise n'est jamais signalée inconnue", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "networkidle" });

    const opener = page.getByRole("button", { name: "Ouvrir l'étape 1" }).first();
    await opener.scrollIntoViewIfNeeded();
    expect(await reachable(opener), "l'étape s'ouvre comme un doigt le ferait").toBe(true);
    await opener.click();

    const chip = page.getByRole("button", { name: "{notresite}" }).first();
    await chip.scrollIntoViewIfNeeded();
    expect(await reachable(chip), "la puce {notresite} est atteignable").toBe(true);
    // L'infobulle départage les deux balises : la confusion inviterait le
    // prospect à visiter sa propre boutique.
    expect((await chip.getAttribute("title")) ?? "").toContain("notre adresse");

    const link = page.locator("[data-our-site]").first();
    await link.waitFor({ state: "attached", timeout: 20_000 });
    await link.scrollIntoViewIfNeeded();
    expect(await reachable(link), "l'aperçu rend un lien atteignable").toBe(true);
    expect(await link.getAttribute("href")).toBe("https://auraflowai.fr/");
    expect(((await link.textContent()) ?? "").trim()).toBe("auraflowai.fr");

    // Aucun avertissement de balise inconnue : {notresite} est du vocabulaire.
    expect(await page.getByText("Balise inconnue").count()).toBe(0);
    expect(session.errors).toEqual([]);
  }, 120_000);

  it("la puce insère la balise au curseur", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "Ouvrir l'étape 1" }).first().click();

    const area = page.locator("textarea").first();
    await area.waitFor({ state: "attached", timeout: 20_000 });
    await area.fill("Voyez  aujourd'hui.");
    // Curseur entre les deux espaces : c'est là que la balise doit atterrir.
    await area.evaluate((node) => {
      const field = node as HTMLTextAreaElement;
      field.focus();
      field.setSelectionRange(6, 6);
    });

    await page.getByRole("button", { name: "{notresite}" }).first().click();
    await expect
      .poll(async () => await area.inputValue(), { timeout: 20_000 })
      .toBe("Voyez {notresite} aujourd'hui.");

    expect(session.errors).toEqual([]);
  }, 120_000);
});
