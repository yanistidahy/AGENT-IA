import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Le choix d'objet d'une relance, au clic.**
 *
 * Trois choses ne se lisent pas dans un diff, et c'est la leçon du jalon 60 —
 * un contrôle peut rendre correctement et ne rien faire :
 *
 * 1. « Garder l'objet de l'étape 1 » est **coché avant tout clic**, et le champ
 *    Objet est alors verrouillé sur l'objet du fil ;
 * 2. « Objet personnalisé » **déverrouille le champ** et affiche la conséquence
 *    en une ligne — « ce message arrive dans une nouvelle conversation » ;
 * 3. revenir à « Garder » **reverrouille** le champ, et le choix est **écrit en
 *    base** dans les deux sens : un réglage à sens unique ne se corrige pas.
 *
 * L'assertion qui compte est **`reachable()`, jamais `isVisible()`** : celle-ci
 * ne voit pas un ancêtre qui rogne.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const P = "e2e104";
const SLUG = "e2e-subject-mode-104";
const THREAD_SUBJECT = "Démo pour {societe}";
const CUSTOM_SUBJECT = "Dernier message pour {societe}";

async function wipe(): Promise<void> {
  await prisma.sequenceDeparture.deleteMany({
    where: { enrollment: { sequence: { campaign: { name: { startsWith: P } } } } },
  });
  await prisma.sequenceEnrollment.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: P } } } },
  });
  await prisma.emailStepVariant.deleteMany({
    where: { step: { sequence: { campaign: { name: { startsWith: P } } } } },
  });
  await prisma.emailSequenceStep.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: P } } } },
  });
  await prisma.emailSequence.deleteMany({ where: { campaign: { name: { startsWith: P } } } });
  await prisma.campaign.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.contact.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.company.deleteMany({ where: { name: "Maison Lune 104" } });
  await prisma.mailbox.deleteMany({ where: { slug: SLUG } });
}

describe.skipIf(skip)("le choix d'objet d'une relance", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";
  let sequenceId = "";

  beforeAll(async () => {
    await wipe();
    const box = await prisma.mailbox.upsert({
      where: { slug: SLUG },
      update: {},
      create: {
        slug: SLUG,
        label: "E2E objet 104",
        signName: "Camille Rouvier",
        smtpFrom: `${SLUG}@e2e.test`,
      },
    });
    const company = await prisma.company.create({
      data: { name: "Maison Lune 104", nameKey: "maison lune 104", domain: `${P}.test` },
    });
    const campaign = await prisma.campaign.create({
      data: { name: `${P} campagne`, mailboxId: box.id, selection: "", mode: "manual" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: { name: `${P} campagne`, campaignId: campaign.id, active: true },
    });
    sequenceId = sequence.id;

    /*
      **Les deux étapes portent un corps**, donc aucune ne s'ouvre d'elle-même
      (jalon 88) : le dépli est un geste du test, et `.last()` désigne bien
      l'étape 2.
    */
    await prisma.emailSequenceStep.create({
      data: {
        sequenceId: sequence.id,
        position: 1,
        delayDays: 0,
        brief: "",
        mode: "manual",
        subject: THREAD_SUBJECT,
        body: "Bonjour {prenom},\n\nPremier message.",
      },
    });
    await prisma.emailSequenceStep.create({
      data: {
        sequenceId: sequence.id,
        position: 2,
        delayDays: 4,
        brief: "",
        mode: "manual",
        // `subjectMode` est laissé au défaut de la colonne : « Garder ».
        subject: "",
        body: "Bonjour {prenom},\n\nRelance.",
      },
    });

    await prisma.contact.create({
      data: {
        id: `${P}a`,
        firstName: "Nina",
        lastName: "Direction",
        email: `${P}a@${P}.test`,
        companyId: company.id,
        lifecycle: "Prospect",
        title: "Fondatrice",
        contactGroup: "direction",
        groupSetBy: "manual",
        nameKey: "direction nina",
      },
    });
    await prisma.sequenceEnrollment.create({
      data: { sequenceId: sequence.id, contactId: `${P}a`, status: "active", lastStep: 0 },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    await wipe();
    await prisma.$disconnect();
  });

  /** Ouvre la page de la campagne, l'étape 2 dépliée. */
  async function openFollowUp(): Promise<void> {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    if ((await page.locator("input[data-subject-mode]").count()) === 0) {
      await page.getByRole("button", { name: /Étape 2/ }).first().click();
      await page.waitForTimeout(900);
    }
    await page.locator('input[data-subject-mode="custom"]').waitFor({ timeout: 20_000 });
  }

  /** Le nombre de champs Objet éditables : 0 en mode « Garder » sur l'étape 2. */
  async function editableSubjects(): Promise<number> {
    return session.page.locator('input[data-field="subject"]').count();
  }

  it("« Garder » est le défaut, et le champ est verrouillé sur l'objet du fil", async () => {
    const { page } = session;
    await openFollowUp();

    const keep = page.locator('input[data-subject-mode="thread"]');
    await keep.scrollIntoViewIfNeeded();
    expect(await reachable(keep), "le choix « Garder » est atteignable").toBe(true);
    expect(await keep.isChecked(), "coché sans qu'on ait cliqué").toBe(true);

    // La conséquence ne s'affiche pas : ce mode n'en a aucune.
    expect(await page.locator("[data-custom-subject-warning]").count()).toBe(0);

    const locked = page.locator("[data-subject-locked]").last();
    await locked.scrollIntoViewIfNeeded();
    expect(await reachable(locked), "l'objet du fil est atteignable").toBe(true);
    expect(await locked.innerText()).toContain(THREAD_SUBJECT);

    // L'étape 2 est dépliée et son champ Objet n'existe pas : il est verrouillé.
    expect(await editableSubjects(), "aucun champ Objet éditable").toBe(0);

    expect(session.errors).toEqual([]);
  }, 90_000);

  it("« Objet personnalisé » déverrouille le champ et dit la conséquence", async () => {
    const { page } = session;
    const custom = page.locator('input[data-subject-mode="custom"]');
    await custom.scrollIntoViewIfNeeded();
    expect(await reachable(custom), "le choix « Objet personnalisé » est atteignable").toBe(true);
    await custom.click();
    await page.waitForTimeout(700);

    /*
      **La conséquence se lit avant d'écrire quoi que ce soit.** Un objet
      différent ouvre une nouvelle conversation : c'est la seule chose qu'on ne
      peut pas deviner de ce réglage.
    */
    const warning = page.locator("[data-custom-subject-warning]").first();
    await warning.scrollIntoViewIfNeeded();
    expect(await reachable(warning), "la conséquence est atteignable").toBe(true);
    expect(await warning.innerText()).toContain("nouvelle conversation");

    // Le champ verrouillé a cédé la place à un champ éditable, et aux puces.
    expect(await page.locator("[data-subject-locked]").count()).toBe(0);
    const field = page.locator('input[data-field="subject"]').last();
    await field.scrollIntoViewIfNeeded();
    expect(await reachable(field), "le champ Objet est atteignable").toBe(true);

    /*
      **Les puces écrivent dans le champ qui avait le focus** (jalon 101) : c'est
      ce qui rend les replis d'objet utilisables ici comme sur l'étape 1.
    */
    await field.fill("Dernier message pour ");
    await field.click();
    await page.waitForTimeout(200);
    const chip = page.getByRole("button", { name: "{societe}", exact: true }).last();
    await chip.scrollIntoViewIfNeeded();
    expect(await reachable(chip), "la puce {societe} est atteignable").toBe(true);
    await chip.click();
    await page.waitForTimeout(400);
    expect(await field.inputValue(), "la balise atterrit dans l'objet").toBe(CUSTOM_SUBJECT);

    // Et l'aperçu rend l'objet personnalisé sur un contact réel.
    const preview = page.locator("[data-variant-subject]").last();
    await preview.scrollIntoViewIfNeeded();
    expect(await reachable(preview)).toBe(true);
    expect(await preview.innerText()).toBe("Dernier message pour Maison Lune 104");

    // Enregistrer, et c'est la base qui le dit — pas seulement l'écran.
    const save = page.getByRole("button", { name: "Enregistrer" }).first();
    await save.scrollIntoViewIfNeeded();
    expect(await reachable(save)).toBe(true);
    await save.click();
    await page.waitForTimeout(4000);

    const step = await prisma.emailSequenceStep.findFirstOrThrow({
      where: { sequenceId, position: 2 },
      select: { subjectMode: true, subject: true },
    });
    expect(step.subjectMode).toBe("custom");
    expect(step.subject).toBe(CUSTOM_SUBJECT);

    expect(session.errors).toEqual([]);
  }, 120_000);

  it("revenir à « Garder » reverrouille le champ, et l'écrit en base", async () => {
    const { page } = session;
    await openFollowUp();

    // L'état enregistré est relu : « Objet personnalisé » est coché au chargement.
    const custom = page.locator('input[data-subject-mode="custom"]');
    expect(await custom.isChecked(), "le choix enregistré est relu").toBe(true);

    const keep = page.locator('input[data-subject-mode="thread"]');
    await keep.scrollIntoViewIfNeeded();
    expect(await reachable(keep)).toBe(true);
    await keep.click();
    await page.waitForTimeout(700);

    // Le champ se reverrouille sur l'objet du fil, et la conséquence disparaît.
    expect(await page.locator("[data-custom-subject-warning]").count()).toBe(0);
    const locked = page.locator("[data-subject-locked]").last();
    await locked.scrollIntoViewIfNeeded();
    expect(await reachable(locked)).toBe(true);
    expect(await locked.innerText()).toContain(THREAD_SUBJECT);
    expect(await editableSubjects()).toBe(0);

    const save = page.getByRole("button", { name: "Enregistrer" }).first();
    await save.scrollIntoViewIfNeeded();
    await save.click();
    await page.waitForTimeout(4000);

    /*
      **L'objet personnalisé reste stocké, et il est ignoré.** Le vider à la
      bascule perdrait un texte qu'on voudra peut-être reprendre ; c'est le
      décideur qui l'ignore, pas l'écriture qui l'efface.
    */
    const step = await prisma.emailSequenceStep.findFirstOrThrow({
      where: { sequenceId, position: 2 },
      select: { subjectMode: true, subject: true },
    });
    expect(step.subjectMode).toBe("thread");
    expect(step.subject).toBe(CUSTOM_SUBJECT);

    expect(session.errors).toEqual([]);
  }, 120_000);
});
