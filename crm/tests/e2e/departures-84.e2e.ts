import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * La file du matin : arrêter, tout réécrire, et voir ce qui est gelé.
 *
 * **Trois contrôles qui ne se lisent pas dans le code.** « Arrêter » n'existe
 * que pendant une composition, « Réécrire tous les départs » ouvre un panneau
 * posé sous son bouton, et la bande de pause est rendue par le serveur : les
 * trois sont exactement la famille de défauts du jalon 60, où un contrôle
 * rendu correctement ne faisait rien parce qu'un ancêtre le rognait. On mesure
 * donc l'atteignabilité (`reachable`), jamais `isVisible()`.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const NAME = "E2E file 84";

describe.skipIf(skip)("la file du matin, jalon 84", () => {
  let browser: Browser;
  let session: Session;
  let mailboxId = "";
  let campaignId = "";

  beforeAll(async () => {
    const box = await prisma.mailbox.upsert({
      where: { slug: "e2e-file84" },
      update: {},
      create: {
        slug: "e2e-file84",
        label: "E2E File 84",
        signName: "Camille Rouvier",
        signTitle: "Fondatrice, Aura Flow AI",
        smtpFrom: "camille@e2e.test",
      },
    });
    mailboxId = box.id;

    const campaign = await prisma.campaign.create({ data: { name: NAME, mailboxId, selection: "" } });
    campaignId = campaign.id;
    // **En pause** : c'est le quatrième point du jalon, et la file doit le dire.
    const sequence = await prisma.emailSequence.create({
      data: {
        name: NAME,
        active: false,
        campaignId,
        steps: { create: [{ position: 1, delayDays: 0, brief: "Angle SAV." }] },
      },
    });

    const contact = await prisma.contact.create({
      data: {
        firstName: "E2eFile",
        lastName: "Quatrevingtquatre",
        email: "contact@e2efile84.test",
        lifecycle: "Prospect",
        nameKey: "quatrevingtquatre e2efile",
        searchText: "e2efile84",
      },
    });
    const enrollment = await prisma.sequenceEnrollment.create({
      data: { sequenceId: sequence.id, contactId: contact.id, status: "active", lastStep: 0 },
    });
    await prisma.sequenceDeparture.create({
      data: {
        enrollmentId: enrollment.id,
        step: 1,
        day: new Date().toISOString().slice(0, 10),
        status: "pending",
        subject: "Une démonstration préparée pour E2E",
        body: "Bonjour,\n\nUn brouillon en attente.\n\nÀ bientôt,",
      },
    });

    // Une composition qui tourne : sans elle, « Arrêter » n'a aucune raison
    // d'exister, et un bouton inerte se lirait comme une panne.
    await prisma.compositionJob.create({
      data: { campaignId, total: 10, done: 3, estimateMicros: 210_000 },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await prisma.compositionJob.deleteMany({ where: { campaignId } });
    await prisma.sequenceDeparture.deleteMany({ where: { enrollment: { sequence: { name: NAME } } } });
    await prisma.sequenceEnrollment.deleteMany({ where: { sequence: { name: NAME } } });
    await prisma.emailSequence.deleteMany({ where: { name: NAME } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.contact.deleteMany({ where: { searchText: { contains: "e2efile84" } } });
    await prisma.mailbox.deleteMany({ where: { id: mailboxId } });
  });

  it("« Arrêter » est là pendant la composition, et dit ce qui a été écrit", async () => {
    await session.page.goto(`${BASE_URL}/departs`, { waitUntil: "domcontentloaded" });
    await session.page.waitForTimeout(800);

    const body = await session.page.innerText("body");
    expect(body).toContain("sur 10 préparé");

    const stop = session.page.getByRole("button", { name: "Arrêter" }).first();
    expect(await stop.count()).toBe(1);
    expect(await reachable(stop)).toBe(true);

    // Cible tactile : la règle du jalon 46 vaut aussi pour les contrôles neufs.
    const box = await stop.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
  });

  it("une campagne en pause est nommée sur la file", async () => {
    const body = await session.page.innerText("body");
    expect(body).toContain("en pause");
    expect(body).toContain(NAME);
    expect(body).toContain("rien ne sera composé ni envoyé");
  });

  it("« Réécrire tous les départs » annonce son coût avant de dépenser", async () => {
    const button = session.page.getByRole("button", { name: "Réécrire tous les départs" });
    expect(await reachable(button)).toBe(true);
    await button.click();
    await session.page.waitForTimeout(1500);

    const panel = await session.page.innerText("body");
    // Soit le plan chiffré, soit son empêchement nommé : jamais un silence.
    expect(panel).toMatch(/seront réécrits sur .* campagne|La file est vide|week-end/i);

    // Le plan ne dépense rien : aucun départ n'a bougé au simple affichage.
    const pending = await prisma.sequenceDeparture.count({
      where: { enrollment: { sequence: { name: NAME } }, status: "pending" },
    });
    expect(pending).toBe(1);
    expect(session.errors).toEqual([]);
  });
});
