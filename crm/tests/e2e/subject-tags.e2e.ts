import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Les balises dans l'objet, au clic.**
 *
 * Le défaut de ce jalon est **invisible à la suite statique**, et c'est mesuré :
 * remis en place (`insert` qui écrit toujours dans `body`), les 1817 tests
 * unitaires restent verts. La puce rend correctement, le bouton répond, et la
 * balise atterrit à la fin du message, hors de vue — la classe de défaut des
 * jalons 60, 61, 77, 79 et 96, qui ne se voit qu'en cliquant.
 *
 * L'assertion qui compte est **`reachable()`, jamais `isVisible()`** : celle-ci
 * ne voit pas un ancêtre qui rogne (leçon du jalon 60).
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const P = "e2e101";
const SLUG = "e2e-subject-101";

describe.skipIf(skip)("une balise s'écrit dans l'objet", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";
  let sequenceId = "";
  let mailboxId = "";

  beforeAll(async () => {
    const mailbox = await prisma.mailbox.upsert({
      where: { slug: SLUG },
      update: {},
      create: {
        slug: SLUG,
        label: "E2E Objet 101",
        signName: "Camille Rouvier",
        smtpFrom: `${SLUG}@e2e.test`,
      },
    });
    mailboxId = mailbox.id;

    const company = await prisma.company.create({
      data: { name: `${P} Dermoplant`, nameKey: `${P} dermoplant`, domain: `${P}.test` },
    });

    const campaign = await prisma.campaign.create({
      data: { name: `${P} — objet`, mailboxId, selection: "" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: { name: `${P} — objet`, campaignId, active: true },
    });
    sequenceId = sequence.id;
    // Deux étapes : la seconde doit porter l'objet de la première, en lecture
    // seule, avec la raison.
    for (const position of [1, 2]) {
      await prisma.emailSequenceStep.create({
        data: { sequenceId, position, delayDays: position === 1 ? 0 : 4, brief: "Un mot." },
      });
    }

    await prisma.contact.create({
      data: {
        id: `${P}a`,
        firstName: "Roxana",
        lastName: "Test",
        email: `${P}a@${P}.test`,
        companyId: company.id,
        lifecycle: "Prospect",
      },
    });
    await prisma.sequenceEnrollment.create({
      data: { sequenceId, contactId: `${P}a` },
    });

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
    await prisma.emailStepVariant.deleteMany({ where: { step: { sequenceId } } });
    await prisma.emailSequenceStep.deleteMany({ where: { sequenceId } });
    await prisma.emailSequence.deleteMany({ where: { id: sequenceId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.contact.deleteMany({ where: { id: { startsWith: P } } });
    await prisma.company.deleteMany({ where: { name: { startsWith: P } } });
    await prisma.mailbox.deleteMany({ where: { id: mailboxId } });
    await prisma.$disconnect();
  });

  /** Ouvre l'étape demandée et bascule en écriture à la main. */
  async function openManualStep(label: RegExp): Promise<void> {
    const { page } = session;
    await page.getByRole("button", { name: label }).first().click();
    await page.waitForTimeout(500);
    const manual = page.getByRole("button", { name: "Écrite à la main" }).first();
    await manual.scrollIntoViewIfNeeded();
    expect(await reachable(manual), "la bascule « Écrite à la main » est atteignable").toBe(true);
    await manual.click();
    await page.waitForTimeout(700);
  }

  it("la puce va dans le champ qui avait le focus, objet ou message", async () => {
    const { page } = session;
    await openManualStep(/Étape 1/);

    const subject = page.locator('input[data-field="subject"]').first();
    const body = page.locator('textarea[data-field="body"]').first();
    await subject.scrollIntoViewIfNeeded();
    expect(await reachable(subject), "le champ Objet est atteignable").toBe(true);

    await subject.fill("Une démonstration préparée pour ");
    await body.fill("Bonjour, un mot.");

    // **Le focus est sur l'objet** : la puce doit y écrire.
    await subject.click();
    const chip = page.getByRole("button", { name: "{societe}", exact: true }).first();
    await chip.scrollIntoViewIfNeeded();
    expect(await reachable(chip), "la puce {societe} est atteignable").toBe(true);
    await chip.click();
    await page.waitForTimeout(400);

    expect(await subject.inputValue(), "la balise est allée dans l'objet").toBe(
      "Une démonstration préparée pour {societe}",
    );
    expect(await body.inputValue(), "le message n'a pas bougé").toBe("Bonjour, un mot.");

    // **Le focus est sur le message** : la même puce doit y écrire.
    await body.click();
    await page.keyboard.press("End");
    await page.getByRole("button", { name: "{site}", exact: true }).first().click();
    await page.waitForTimeout(400);

    expect(await body.inputValue(), "la balise est allée dans le message").toContain("{site}");
    expect(await subject.inputValue(), "l'objet n'a pas bougé").toBe(
      "Une démonstration préparée pour {societe}",
    );

    expect(session.errors).toEqual([]);
  }, 90_000);

  it("l'aperçu rend l'objet, et nomme le repli employé", async () => {
    const { page } = session;

    const preview = page.locator("[data-preview-subject]").first();
    await preview.scrollIntoViewIfNeeded();
    expect(await reachable(preview), "l'objet rendu est atteignable").toBe(true);
    const shown = await preview.innerText();
    // La fiche semée porte une société : pas de repli, pas d'accolade.
    expect(shown).not.toContain("{societe}");
    expect(shown).toContain("Dermoplant");

    expect(session.errors).toEqual([]);
  }, 60_000);

  it("{video} est refusée dans un objet, avec sa raison ; {notresite} rend le libellé", async () => {
    const { page } = session;
    const subject = page.locator('input[data-field="subject"]').first();

    await subject.fill("Regardez {video}");
    await page.waitForTimeout(500);
    const refusal = page.locator("[data-subject-error]").first();
    await refusal.scrollIntoViewIfNeeded();
    expect(await reachable(refusal), "le refus de {video} est atteignable").toBe(true);
    const reason = await refusal.innerText();
    expect(reason).toContain("{video}");
    expect(reason).toContain("lien cliquable");

    // {notresite} est acceptée, et rend le libellé — pas l'adresse entière.
    await subject.fill("Un mot depuis {notresite}");
    await page.waitForTimeout(500);
    expect(await page.locator("[data-subject-error]").count(), "aucun refus").toBe(0);
    const rendered = await page.locator("[data-preview-subject]").first().innerText();
    expect(rendered).not.toContain("{notresite}");
    expect(rendered).not.toContain("https://");
    expect(rendered).toMatch(/auraflowai\.fr|Un mot depuis$/);

    expect(session.errors).toEqual([]);
  }, 60_000);

  it("une relance n'a pas de champ Objet : elle porte celui de l'étape 1", async () => {
    const { page } = session;
    // On repose un objet propre sur l'étape 1 avant d'aller voir l'étape 2.
    await page.locator('input[data-field="subject"]').first().fill("Objet du fil {societe}");
    await page.waitForTimeout(300);

    /*
      **La bascule de l'étape 2 est la dernière, pas la première.** Les blocs
      d'étape ne portent aucun attribut qui les distingue : avec l'étape 1
      toujours dépliée, `.first()` désigne sa bascule à elle, et celle de
      l'étape 2 n'était jamais cliquée — mesuré, c'est ce qui faisait échouer ce
      test, sur un produit qui rendait correctement.
    */
    await page.getByRole("button", { name: /Étape 2/ }).first().click();
    await page.waitForTimeout(500);
    const manual = page.getByRole("button", { name: "Écrite à la main" }).last();
    await manual.scrollIntoViewIfNeeded();
    expect(await reachable(manual), "la bascule de l'étape 2 est atteignable").toBe(true);
    await manual.click();
    await page.waitForTimeout(700);

    const locked = page.locator("[data-subject-locked]").first();
    await locked.scrollIntoViewIfNeeded();
    expect(await reachable(locked), "l'objet de l'étape 1 est atteignable").toBe(true);
    const text = await locked.innerText();
    expect(text).toContain("Objet du fil {societe}");
    expect(text).toContain("regroupent par objet");
    /*
      L'objet lui-même ne prend pas de « Re: ». L'assertion porte sur l'objet et
      non sur tout le bloc : la phrase d'explication cite « Re: » pour dire
      qu'il n'en est pas ajouté, et un `not.toContain("Re:")` global tombait sur
      sa propre justification.
    */
    expect(text).not.toContain("Re: Objet du fil");

    // Et il n'y a **aucun** second champ Objet à remplir sur cette étape.
    const fields = await page.locator('input[data-field="subject"]').count();
    expect(fields, "un seul champ Objet dans tout l'écran, celui de l'étape 1").toBe(1);

    expect(session.errors).toEqual([]);
  }, 90_000);
});
