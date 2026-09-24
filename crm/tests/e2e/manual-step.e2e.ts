import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * L'étape écrite à la main, au clic.
 *
 * Deux choses ne se lisent pas dans le code : **la bascule change-t-elle
 * réellement d'éditeur**, et **l'aperçu se met-il à jour à la frappe**. C'est
 * la classe de défaut des jalons 60 et 83 — un contrôle qui rend correctement
 * et ne fait rien.
 *
 * L'aperçu est la moitié de la fonction : ce qu'on veut voir avant
 * d'enregistrer, c'est ce que reçoit une **fiche incomplète**. Le semis en
 * pose donc une, sans prénom ni site.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const P = "e2e87";

describe.skipIf(skip)("une étape écrite à la main", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";
  let sequenceId = "";
  let mailboxId = "";

  beforeAll(async () => {
    const mailbox = await prisma.mailbox.upsert({
      where: { slug: "e2e-manual" },
      update: {},
      create: {
        slug: "e2e-manual",
        label: "E2E Manuel",
        signName: "Camille Rouvier",
        smtpFrom: "camille@e2e.test",
      },
    });
    mailboxId = mailbox.id;

    const company = await prisma.company.create({
      data: { name: `${P} Vertu`, nameKey: `${P} vertu`, domain: `${P}-vertu.test` },
    });

    const campaign = await prisma.campaign.create({
      data: { name: "E2E — étape manuelle", mailboxId, selection: "" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: { name: "E2E — étape manuelle", campaignId, active: true },
    });
    sequenceId = sequence.id;
    await prisma.emailSequenceStep.create({
      data: { sequenceId, position: 1, delayDays: 0, brief: "Premier message." },
    });

    // Une fiche complète, une fiche sans prénom ni site : c'est la seconde qui
    // rend l'aperçu utile.
    await prisma.contact.create({
      data: {
        id: `${P}a`,
        firstName: "Anna",
        lastName: "Test",
        email: `${P}a@${P}-vertu.test`,
        companyId: company.id,
        lifecycle: "Prospect",
      },
    });
    await prisma.contact.create({
      data: {
        id: `${P}b`,
        firstName: "",
        lastName: "",
        email: `${P}b@gmail.com`,
        lifecycle: "Prospect",
      },
    });
    for (const id of [`${P}a`, `${P}b`]) {
      await prisma.sequenceEnrollment.create({ data: { sequenceId, contactId: id } });
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
    await session.page.goto(`${BASE_URL}/campagnes/${campaignId}`, {
      waitUntil: "domcontentloaded",
    });
    await session.page.waitForTimeout(1500);
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    await prisma.sequenceDeparture.deleteMany({ where: { enrollment: { sequenceId } } });
    await prisma.sequenceEnrollment.deleteMany({ where: { sequenceId } });
    await prisma.emailSequenceStep.deleteMany({ where: { sequenceId } });
    await prisma.emailSequence.deleteMany({ where: { id: sequenceId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.contact.deleteMany({ where: { id: { startsWith: P } } });
    await prisma.company.deleteMany({ where: { name: { startsWith: P } } });
    await prisma.mailbox.deleteMany({ where: { id: mailboxId } });
  });

  it("la bascule change d'éditeur, et l'aperçu suit la frappe", async () => {
    const { page } = session;

    // L'étape est repliée par défaut (jalon 80) : on l'ouvre.
    await page.getByRole("button", { name: /Étape 1/ }).first().click();
    await page.waitForTimeout(400);

    const manual = page.getByRole("button", { name: "Écrite à la main" }).first();
    await manual.scrollIntoViewIfNeeded();
    expect(await reachable(manual)).toBe(true);
    await manual.click();
    await page.waitForTimeout(600);

    // L'éditeur manuel a remplacé la consigne d'Alex.
    const body = page.getByPlaceholder("Bonjour {prenom},").first();
    await body.scrollIntoViewIfNeeded();
    expect(await reachable(body)).toBe(true);

    await body.fill("Bonjour {prenom},\n\nUne démonstration pour {societe} sur {site}.");
    await page.waitForTimeout(500);

    // L'aperçu est rendu par la même fonction que la composition, à la frappe :
    // pas d'aller-retour, donc il est là tout de suite.
    const preview = page.locator("pre").first();
    await preview.scrollIntoViewIfNeeded();
    expect(await reachable(preview)).toBe(true);
    const first = await preview.innerText();
    expect(first.length).toBeGreaterThan(0);

    // Le cas dégradé passe devant dans le sélecteur : l'aperçu doit montrer un
    // appel correct et **aucune balise littérale**.
    for (const text of [first]) {
      expect(text).not.toContain("{prenom}");
      expect(text).not.toContain("{societe}");
      expect(text).not.toContain("{site}");
      expect(text).not.toMatch(/Bonjour\s+,/);
    }

    expect(session.errors).toEqual([]);
  }, 60_000);

  it("une balise inconnue est signalée avant d'enregistrer", async () => {
    const { page } = session;
    const body = page.getByPlaceholder("Bonjour {prenom},").first();
    await body.fill("Bonjour {prenom}, et {inconnue}.");
    await page.waitForTimeout(500);

    const danger = page.getByText(/Balise inconnue/).first();
    await danger.scrollIntoViewIfNeeded();
    expect(await reachable(danger)).toBe(true);
    expect(await danger.innerText()).toContain("{inconnue}");

    expect(session.errors).toEqual([]);
  }, 60_000);
});
