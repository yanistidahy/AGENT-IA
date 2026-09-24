import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * « Vider les départs », au clic.
 *
 * Ce qui compte ici n'est pas que la file se vide — le service le prouve — mais
 * que **la confirmation dise le compte et ce qui ne bouge pas** avant le
 * premier clic. Une file vidée sans un mot sur les envois passés, c'est le
 * geste qu'on n'ose plus refaire.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const P = "e2e87c";

describe.skipIf(skip)("vider la file des départs", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";
  let sequenceId = "";
  let mailboxId = "";

  beforeAll(async () => {
    const mailbox = await prisma.mailbox.upsert({
      where: { slug: "e2e-clear" },
      update: {},
      create: {
        slug: "e2e-clear",
        label: "E2E Vider",
        signName: "Camille Rouvier",
        smtpFrom: "camille@e2e.test",
      },
    });
    mailboxId = mailbox.id;

    const campaign = await prisma.campaign.create({
      data: { name: "E2E — vider la file", mailboxId, selection: "" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: { name: "E2E — vider la file", campaignId, active: true },
    });
    sequenceId = sequence.id;
    await prisma.emailSequenceStep.create({
      data: { sequenceId, position: 1, delayDays: 0, brief: "Premier message." },
    });

    for (const [suffix, first] of [
      ["a", "Anna"],
      ["b", "Bruno"],
    ] as const) {
      await prisma.contact.create({
        data: {
          id: `${P}${suffix}`,
          firstName: first,
          lastName: "Test",
          email: `${P}${suffix}@e2e.test`,
          lifecycle: "Prospect",
        },
      });
      const enrollment = await prisma.sequenceEnrollment.create({
        data: { sequenceId, contactId: `${P}${suffix}` },
      });
      await prisma.sequenceDeparture.create({
        data: {
          enrollmentId: enrollment.id,
          step: 1,
          subject: `Brouillon pour ${first}`,
          body: "Bonjour,\n\nUn texte.",
          day: new Date().toISOString().slice(0, 10),
        },
      });
      // Un envoi passé : c'est lui qui ne doit pas bouger.
      await prisma.emailSend.create({
        data: {
          contactId: `${P}${suffix}`,
          toAddress: `${P}${suffix}@e2e.test`,
          subject: `Message déjà parti pour ${first}`,
          campaignId,
          campaignName: "E2E — vider la file",
          sequenceId,
        },
      });
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
    await session.page.goto(`${BASE_URL}/departs?campagne=${campaignId}`, {
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
    await prisma.emailSend.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.contact.deleteMany({ where: { id: { startsWith: P } } });
    await prisma.mailbox.deleteMany({ where: { id: mailboxId } });
  });

  it("la confirmation nomme le compte et ce qui ne bouge pas", async () => {
    const { page } = session;
    const button = page.getByRole("button", { name: "Vider les départs" });
    expect(await reachable(button)).toBe(true);
    await button.click();
    await page.waitForTimeout(400);

    const warning = page.getByText(/départs en attente de cette campagne/).first();
    expect(await reachable(warning)).toBe(true);
    expect(await warning.innerText()).toContain("2");

    const promise = page.getByText(/Les messages déjà\s+envoyés restent/).first();
    expect(await reachable(promise)).toBe(true);

    // Regarder n'efface rien.
    expect(await prisma.sequenceDeparture.count({ where: { enrollment: { sequenceId } } })).toBe(2);
    expect(session.errors).toEqual([]);
  }, 60_000);

  it("confirmer vide la file, et laisse les envois et les fiches", async () => {
    const { page } = session;
    await page.getByRole("button", { name: "Vider la file" }).click();
    await page.waitForTimeout(1500);

    expect(await prisma.sequenceDeparture.count({ where: { enrollment: { sequenceId } } })).toBe(0);
    expect(await prisma.emailSend.count({ where: { campaignId } })).toBe(2);
    expect(await prisma.contact.count({ where: { id: { startsWith: P } } })).toBe(2);
    // Les inscriptions restent : on a vidé une file, pas une campagne.
    expect(await prisma.sequenceEnrollment.count({ where: { sequenceId } })).toBe(2);

    const notice = page.getByText(/retirés de la file/).first();
    expect(await reachable(notice)).toBe(true);
    expect(session.errors).toEqual([]);
  }, 60_000);
});
