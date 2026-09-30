import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **L'objet du fil, groupe par groupe, au clic.**
 *
 * Le défaut du jalon 101 était invisible à la suite unitaire : l'éditeur d'une
 * relance lisait le seul objet **par défaut** de l'étape 1, et annonçait
 * « l'étape 1 ne porte pas encore d'objet » au-dessus d'un groupe qui en avait
 * un — un objet vide à la composition, donc un départ refusé à l'envoi par le
 * contrôle de vide du jalon 96.
 *
 * Trois choses ne se lisent pas dans un diff :
 *
 * 1. l'éditeur d'une relance montre l'objet **du groupe édité**, et il change
 *    avec l'onglet ;
 * 2. un groupe sans variante d'étape 1 hérite du **défaut** de l'étape 1 ;
 * 3. « Écrire l'objet dans l'étape 1 » ouvre l'étape 1 **sur le même groupe**,
 *    curseur dans le champ Objet.
 *
 * L'assertion qui compte est **`reachable()`, jamais `isVisible()`** : celle-ci
 * ne voit pas un ancêtre qui rogne (leçon du jalon 60).
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const P = "e2e103";
const SLUG = "e2e-thread-103";
const DIR_SUBJECT = "Démo pour {societe}";

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
  await prisma.company.deleteMany({ where: { name: "Maison Lune 103" } });
  await prisma.mailbox.deleteMany({ where: { slug: SLUG } });
}

describe.skipIf(skip)("l'objet du fil suit le groupe", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";

  beforeAll(async () => {
    await wipe();
    const box = await prisma.mailbox.upsert({
      where: { slug: SLUG },
      update: {},
      create: {
        slug: SLUG,
        label: "E2E fil 103",
        signName: "Camille Rouvier",
        smtpFrom: `${SLUG}@e2e.test`,
      },
    });
    const company = await prisma.company.create({
      data: { name: "Maison Lune 103", nameKey: "maison lune 103", domain: `${P}.test` },
    });
    const campaign = await prisma.campaign.create({
      data: { name: `${P} campagne`, mailboxId: box.id, selection: "", mode: "manual" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: { name: `${P} campagne`, campaignId: campaign.id, active: true },
    });

    /*
      **L'objet par défaut de l'étape 1 est vide, et son corps aussi** : cette
      campagne n'écrit que des variantes. C'est la forme exacte du défaut
      signalé — l'objet vit sur la variante Direction, nulle part ailleurs.
    */
    const step1 = await prisma.emailSequenceStep.create({
      data: {
        sequenceId: sequence.id,
        position: 1,
        delayDays: 0,
        brief: "",
        mode: "manual",
        subject: "",
        body: "",
      },
    });
    await prisma.emailStepVariant.create({
      data: {
        stepId: step1.id,
        group: "direction",
        subject: DIR_SUBJECT,
        body: "Bonjour {prenom},\n\nPremier message, version Direction.",
      },
    });

    const step2 = await prisma.emailSequenceStep.create({
      data: {
        sequenceId: sequence.id,
        position: 2,
        delayDays: 4,
        brief: "",
        mode: "manual",
        subject: "",
        body: "",
      },
    });
    await prisma.emailStepVariant.create({
      data: {
        stepId: step2.id,
        group: "direction",
        subject: "",
        body: "Bonjour {prenom},\n\nRelance, version Direction.",
      },
    });
    // Le groupe Commercial porte une relance mais **aucune variante d'étape 1**.
    await prisma.emailStepVariant.create({
      data: {
        stepId: step2.id,
        group: "commercial",
        subject: "",
        body: "Bonjour {prenom},\n\nRelance, version Commercial.",
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

  /**
   * Ouvre la page de la campagne, l'étape 2 dépliée.
   *
   * **Le dépli n'est pas cliqué à l'aveugle** : une étape manuelle au corps vide
   * s'ouvre d'elle-même (jalon 88), et cliquer sa bascule la refermerait — c'est
   * la leçon du jalon 101, où `.first()` visait l'étape 1 restée ouverte. On
   * mesure donc l'état avant d'agir.
   */
  async function openFollowUp(): Promise<void> {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    if ((await page.locator("[data-subject-locked]").count()) === 0) {
      await page.getByRole("button", { name: /Étape 2/ }).first().click();
      await page.waitForTimeout(800);
    }
    await page.locator("[data-subject-locked]").last().waitFor({ timeout: 20_000 });
  }

  it("la relance montre l'objet de la variante d'étape 1 du même groupe", async () => {
    const { page } = session;
    await openFollowUp();

    // L'onglet « Direction » de l'étape 2 : le dernier bloc rendu est le sien.
    const tab = page.getByRole("button", { name: "Direction", exact: true }).last();
    await tab.scrollIntoViewIfNeeded();
    expect(await reachable(tab), "l'onglet Direction est atteignable").toBe(true);
    await tab.click();
    await page.waitForTimeout(600);

    const locked = page.locator("[data-subject-locked]").last();
    await locked.scrollIntoViewIfNeeded();
    expect(await reachable(locked), "l'objet du fil est atteignable").toBe(true);
    const shown = await locked.innerText();
    expect(shown, "l'objet du groupe, pas « pas encore d'objet »").toContain(DIR_SUBJECT);
    expect(shown).not.toContain("ne porte pas encore d'objet");
    // Le lien de secours n'a rien à proposer : le fil porte un objet.
    expect(await page.locator("[data-write-first-subject]").count()).toBe(0);

    /*
      **L'aperçu par groupe montre le même objet, rendu sur un contact réel.**
      L'éditeur montre le gabarit, l'aperçu ce que Nina recevra : les deux
      viennent de `threadTemplate`, donc ils ne peuvent pas se contredire.
    */
    const preview = page.locator("[data-variant-subject]").last();
    await preview.scrollIntoViewIfNeeded();
    expect(await reachable(preview), "l'aperçu de l'objet est atteignable").toBe(true);
    expect(await preview.innerText()).toBe("Démo pour Maison Lune 103");

    expect(session.errors).toEqual([]);
  }, 90_000);

  it("un groupe sans variante d'étape 1 retombe sur le défaut de l'étape 1", async () => {
    const { page } = session;
    // On reste sur l'étape 2, et on change d'onglet : le champ doit suivre.
    const tab = page.getByRole("button", { name: "Commercial", exact: true }).last();
    await tab.scrollIntoViewIfNeeded();
    expect(await reachable(tab)).toBe(true);
    await tab.click();
    await page.waitForTimeout(600);

    const locked = page.locator("[data-subject-locked]").last();
    const shown = await locked.innerText();
    /*
      Le défaut de l'étape 1 est vide dans cette campagne : le champ le dit, et
      **porte son geste**. C'est le second point du jalon — un manque nommé sans
      son geste fait chercher où agir.
    */
    expect(shown).toContain("ne porte pas encore d'objet");
    expect(shown).not.toContain(DIR_SUBJECT);

    const link = page.locator("[data-write-first-subject]").first();
    await link.scrollIntoViewIfNeeded();
    expect(await reachable(link), "« Écrire l'objet dans l'étape 1 » est atteignable").toBe(true);
    expect((await link.innerText()).trim()).toBe("Écrire l'objet dans l'étape 1");

    expect(session.errors).toEqual([]);
  }, 90_000);

  it("le lien ouvre l'étape 1 sur le même groupe, curseur dans l'objet", async () => {
    const { page } = session;
    await page.locator("[data-write-first-subject]").first().click();
    await page.waitForTimeout(900);

    // L'étape 1 est dépliée : son éditeur est monté, donc un champ Objet existe.
    const field = page.locator('input[data-field="subject"]').first();
    await field.scrollIntoViewIfNeeded();
    expect(await reachable(field), "le champ Objet de l'étape 1 est atteignable").toBe(true);

    // **Le même groupe** : l'étape 1 est ouverte sur l'onglet Commercial.
    const scope = await page.locator("[data-variant-scope]").first().getAttribute("data-variant-scope");
    expect(scope, "l'étape 1 s'ouvre sur le groupe d'où l'on vient").toBe("commercial");

    // **Le curseur y est** : c'est ce qui distingue un lien utile d'un lien qui
    // déplie et laisse chercher.
    const focused = await page.evaluate(
      () => document.activeElement?.getAttribute("data-field") ?? "",
    );
    expect(focused, "le champ Objet a le focus").toBe("subject");

    expect(session.errors).toEqual([]);
  }, 90_000);
});
