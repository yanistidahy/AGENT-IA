import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, signIn, type Session } from "./browser";

/**
 * Rouvrir un départ avec « Retravailler avec Alex ».
 *
 * **Le panneau tombait tout entier sur un départ de campagne** : il rend la
 * carte de recherche depuis le jalon 74, et `departureDraft` ne l'a jamais
 * envoyée. `research.state` sur `undefined` faisait « Application error », et
 * rien n'échouait à la compilation — la charge utile traverse la frontière en
 * JSON, où le type n'existe plus. Un test qui lit le code ne peut pas voir
 * cela ; celui-ci clique, comme depuis le jalon 60.
 *
 * Le départ semé est **d'avant le jalon 84** : étape 2, aucun message
 * précédent enregistré, aucune recherche, aucune retouche. C'est l'état de la
 * production, pas celui qu'on sait produire (leçon du jalon 83).
 */
const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;
const NAME = "E2E retravail 85";

describe.skipIf(skip)("retravailler un départ de campagne", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";
  let mailboxId = "";

  beforeAll(async () => {
    await prisma.sequenceDeparture.deleteMany({ where: { enrollment: { sequence: { name: NAME } } } });
    await prisma.sequenceEnrollment.deleteMany({ where: { sequence: { name: NAME } } });
    await prisma.emailSequence.deleteMany({ where: { name: NAME } });
    await prisma.campaign.deleteMany({ where: { name: NAME } });
    await prisma.contact.deleteMany({ where: { searchText: { contains: "e2eretravail85" } } });

    const box = await prisma.mailbox.upsert({
      where: { slug: "e2eretravail85" },
      update: {},
      create: {
        slug: "e2eretravail85",
        label: "E2E retravail",
        signName: "Camille Rouvier",
        signTitle: "Fondatrice",
        smtpFrom: "camille@e2eretravail85.test",
      },
    });
    mailboxId = box.id;
    const campaign = await prisma.campaign.create({ data: { name: NAME, mailboxId, selection: "" } });
    campaignId = campaign.id;
    const seq = await prisma.emailSequence.create({
      data: {
        name: NAME,
        active: true,
        campaignId,
        steps: {
          create: [
            { position: 1, delayDays: 0, brief: "présenter" },
            { position: 2, delayDays: 4, brief: "relancer" },
          ],
        },
      },
    });
    const contact = await prisma.contact.create({
      data: {
        firstName: "E2eRetravail",
        lastName: "Quatrevingtcinq",
        email: "contact@e2eretravail85.test",
        lifecycle: "Prospect",
        nameKey: "quatrevingtcinq e2eretravail",
        searchText: "e2eretravail85",
      },
    });
    // Un départ « d'avant le jalon 84 » : étape 2, aucun message précédent
    // enregistré, aucune recherche, aucune retouche.
    const enr = await prisma.sequenceEnrollment.create({
      data: { sequenceId: seq.id, contactId: contact.id, status: "active", lastStep: 1, lastSentAt: new Date() },
    });
    await prisma.sequenceDeparture.create({
      data: {
        enrollmentId: enr.id,
        step: 2,
        day: new Date().toISOString().slice(0, 10),
        status: "pending",
        subject: "Une démonstration préparée pour Repro",
        body: "Bonjour,\n\nAncien brouillon.\n\nÀ bientôt,",
      },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await prisma.sequenceDeparture.deleteMany({ where: { enrollment: { sequence: { name: NAME } } } });
    await prisma.sequenceEnrollment.deleteMany({ where: { sequence: { name: NAME } } });
    await prisma.emailSequence.deleteMany({ where: { name: NAME } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.contact.deleteMany({ where: { searchText: { contains: "e2eretravail85" } } });
    await prisma.mailbox.deleteMany({ where: { id: mailboxId } });
  });

  it("un brouillon d'avant le jalon 84 ouvre le panneau sans faire tomber l'écran", async () => {
    await session.page.goto(`${BASE_URL}/departs?campagne=${campaignId}`, {
      waitUntil: "domcontentloaded",
    });
    await session.page.waitForTimeout(1000);
    await session.page.getByRole("button", { name: "Retravailler avec Alex" }).first().click();
    await session.page.waitForTimeout(4000);

    const body = await session.page.innerText("body");
    expect(body).not.toContain("Application error");
    // Le texte vient de la file, pas d'un nouvel appel au modèle (jalon 57).
    expect(body).toContain("Ancien brouillon.");
    expect(body).toContain("Enregistrer le brouillon");
    // Une exception non rattrapée remonte ici : c'est elle qui blanchissait
    // la page, et aucune assertion de contenu ne l'aurait attrapée seule.
    expect(session.errors).toEqual([]);
  });
});
