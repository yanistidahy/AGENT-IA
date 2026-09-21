import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Ajouter une étape à une campagne qui a tourné — **au clic**.
 *
 * Ce qui se joue ici ne se lit pas dans le code : que la phrase de
 * confirmation apparaisse **avant** toute écriture, qu'elle nomme celle qui
 * reste arrêtée, et qu'« Enregistrer sans relancer » soit un vrai choix. Un
 * bouton qui rouvrirait cinquante-deux inscriptions sans être lu serait le
 * défaut le plus cher du produit : il se verrait chez le destinataire.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const NAME = "E2E — relance après coup";
const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

describe.skipIf(skip)("ajouter une étape rouvre les inscriptions épuisées", () => {
  let browser: Browser;
  let session: Session;
  let campaignId: string;
  let sequenceId: string;

  beforeAll(async () => {
    const mailbox = await prisma.mailbox.upsert({
      where: { slug: "e2e-reopen" },
      update: {},
      create: { slug: "e2e-reopen", label: "E2E", signName: "Test", signTitle: "Rôle" },
    });
    const campaign = await prisma.campaign.create({
      data: { name: NAME, mailboxId: mailbox.id, selection: "" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: {
        name: NAME,
        campaignId,
        active: true,
        steps: { create: [{ position: 1, delayDays: 0, brief: "présenter" }] },
      },
    });
    sequenceId = sequence.id;

    // Trois terminées faute d'étape, et une qui a répondu.
    for (const [first, status, reason] of [
      ["E2eReouvre1", "done", "Toutes les étapes ont été envoyées"],
      ["E2eReouvre2", "done", "Toutes les étapes ont été envoyées"],
      ["E2eReouvre3", "done", "Toutes les étapes ont été envoyées"],
      ["Margaux", "stopped", "Le contact a répondu"],
    ] as const) {
      const contact = await prisma.contact.create({
        data: {
          firstName: first,
          lastName: first === "Margaux" ? "Keller" : "Test",
          email: `${first.toLowerCase()}@e2e-reopen.test`,
          lifecycle: "Prospect",
          nameKey: `test ${first.toLowerCase()}`,
          searchText: `e2ereouvre ${first.toLowerCase()}`,
        },
      });
      await prisma.sequenceEnrollment.create({
        data: {
          sequenceId,
          contactId: contact.id,
          status,
          stopReason: reason,
          lastStep: 1,
          lastSentAt: ago(10),
        },
      });
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD as string);
  }, 60_000);

  afterAll(async () => {
    await prisma.sequenceEnrollment.deleteMany({ where: { sequenceId } });
    await prisma.emailSequence.deleteMany({ where: { id: sequenceId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.contact.deleteMany({ where: { searchText: { contains: "e2ereouvre" } } });
    await prisma.mailbox.deleteMany({ where: { slug: "e2e-reopen" } });
    await browser?.close();
  });

  it("annonce qui sera relancé, et nomme celle qui reste arrêtée", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "domcontentloaded" });

    const add = page.getByRole("button", { name: /Ajouter une étape/ });
    await add.scrollIntoViewIfNeeded();
    expect(await reachable(add)).toBe(true);
    await add.click();

    // La consigne de la nouvelle étape, sans quoi elle n'écrirait rien.
    await page.getByRole("button", { name: "Ouvrir l'étape 2" }).click();
    await page.locator('input[placeholder^="ex. rappeler"]').last().fill("relancer sur la démo");

    const save = page.getByRole("button", { name: "Enregistrer", exact: true });
    await save.scrollIntoViewIfNeeded();
    await save.click();

    await page.getByText(/ont terminé cette campagne/).waitFor({ timeout: 15_000 });
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toContain("3 personnes ont terminé cette campagne.");
    expect(body).toContain("recevront l'étape 2 : 3 immédiatement");
    // La garde se voit fonctionner, plutôt que d'être promise.
    expect(body).toContain("Margaux Keller (le contact a répondu)");

    // **Rien n'est encore écrit** : la confirmation est une question.
    expect(await prisma.sequenceEnrollment.count({ where: { sequenceId, status: "active" } })).toBe(
      0,
    );
  }, 90_000);

  it("« Enregistrer et relancer » rouvre les trois, et elle seule reste arrêtée", async () => {
    const { page } = session;
    const confirm = page.getByRole("button", { name: "Enregistrer et relancer" });
    await confirm.scrollIntoViewIfNeeded();
    expect(await reachable(confirm)).toBe(true);
    await confirm.click();

    await page.getByText(/inscriptions rouvertes/).waitFor({ timeout: 15_000 });

    expect(await prisma.sequenceEnrollment.count({ where: { sequenceId, status: "active" } })).toBe(
      3,
    );
    const margaux = await prisma.sequenceEnrollment.findFirst({
      where: { sequenceId, contact: { firstName: "Margaux" } },
    });
    expect(margaux?.status).toBe("stopped");
    // Reprise là où elles en étaient : le premier message ne repart pas.
    const first = await prisma.sequenceEnrollment.findFirst({
      where: { sequenceId, contact: { firstName: "E2eReouvre1" } },
    });
    expect(first?.lastStep).toBe(1);
    expect(first?.lastSentAt).not.toBeNull();
  }, 90_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});

/**
 * **Et quand personne ne rouvre, l'écran le dit.**
 *
 * C'est le défaut qui a fait croire le jalon 81 mort en production : ajouter
 * une étape rendait la main sans un mot, et rien ne permettait de trancher
 * entre « la règle est trop étroite » et « la base ne porte pas ce qu'on
 * croit ». Seul un test qui clique peut voir qu'un écran se tait.
 */
describe.skipIf(skip)("une campagne où rien ne rouvre le dit", () => {
  let browser: Browser;
  let session: Session;
  let campaignId: string;
  let sequenceId: string;

  beforeAll(async () => {
    const mailbox = await prisma.mailbox.upsert({
      where: { slug: "e2e-muet" },
      update: {},
      create: { slug: "e2e-muet", label: "E2E muet", signName: "Test" },
    });
    const campaign = await prisma.campaign.create({
      data: { name: "E2E — rien à rouvrir", mailboxId: mailbox.id, selection: "" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: {
        name: "E2E — rien à rouvrir",
        campaignId,
        active: true,
        steps: { create: [{ position: 1, delayDays: 0, brief: "présenter" }] },
      },
    });
    sequenceId = sequence.id;

    const contact = await prisma.contact.create({
      data: {
        firstName: "E2eMuet",
        lastName: "Test",
        email: "e2emuet@exemple.test",
        lifecycle: "Prospect",
        nameKey: "test e2emuet",
        searchText: "e2emuet test",
      },
    });
    await prisma.sequenceEnrollment.create({
      data: {
        sequenceId,
        contactId: contact.id,
        status: "stopped",
        stopReason: "Le contact a répondu",
        lastStep: 1,
        lastSentAt: new Date(),
      },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD as string);
  }, 60_000);

  afterAll(async () => {
    await prisma.sequenceEnrollment.deleteMany({ where: { sequenceId } });
    await prisma.emailSequence.deleteMany({ where: { id: sequenceId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.contact.deleteMany({ where: { searchText: { contains: "e2emuet" } } });
    await prisma.mailbox.deleteMany({ where: { slug: "e2e-muet" } });
    await browser?.close();
  });

  it("montre les motifs tels qu'en base, au lieu d'enregistrer en silence", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "domcontentloaded" });

    const add = page.getByRole("button", { name: /Ajouter une étape/ });
    await add.scrollIntoViewIfNeeded();
    await add.click();
    await page.getByRole("button", { name: "Ouvrir l'étape 2" }).click();
    await page.locator('input[placeholder^="ex. rappeler"]').last().fill("relancer");

    const save = page.getByRole("button", { name: "Enregistrer", exact: true });
    await save.scrollIntoViewIfNeeded();
    await save.click();

    await page.getByText("Aucune inscription ne sera rouverte.").waitFor({ timeout: 15_000 });
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toContain("Motifs enregistrés : 1 × « Le contact a répondu »");

    // **Le bouton de relance n'existe pas ici** : il n'y a rien à relancer.
    expect(await page.getByRole("button", { name: "Enregistrer et relancer" }).count()).toBe(0);

    // Et rien n'a été enregistré dans le dos : l'étape attend le second clic.
    expect(await prisma.emailSequenceStep.count({ where: { sequenceId } })).toBe(1);
  }, 90_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
