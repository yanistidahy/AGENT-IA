import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * « Réinitialiser la campagne », au clic.
 *
 * Ce qui se vérifie ici ne se lit pas dans le code : **la confirmation
 * s'affiche-t-elle avant d'écrire**, et dit-elle ce qui va se passer chez le
 * destinataire. Un bouton qui écrirait sans la montrer serait correct au
 * service et faux à l'écran — c'est la classe de défaut des jalons 60 et 83.
 *
 * Le semis part de l'état où se trouve la production : des inscriptions
 * **closes** par la composition, et une personne qui a répondu (jalon 83).
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const P = "e2e86";

describe.skipIf(skip)("réinitialiser une campagne", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";
  let sequenceId = "";
  let mailboxId = "";

  beforeAll(async () => {
    const mailbox = await prisma.mailbox.upsert({
      where: { slug: "e2e-reset" },
      update: {},
      create: {
        slug: "e2e-reset",
        label: "E2E Reset",
        signName: "Camille Rouvier",
        smtpFrom: "camille@e2e.test",
      },
    });
    mailboxId = mailbox.id;

    const campaign = await prisma.campaign.create({
      data: { name: "E2E — réinitialisation", mailboxId, selection: "" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: { name: "E2E — réinitialisation", campaignId, active: true },
    });
    sequenceId = sequence.id;
    await prisma.emailSequenceStep.create({
      data: { sequenceId, position: 1, delayDays: 0, brief: "Premier message." },
    });

    const sent = new Date(Date.now() - 12 * 86_400_000);
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
      await prisma.sequenceEnrollment.create({
        data: {
          sequenceId,
          contactId: `${P}${suffix}`,
          status: "done",
          stopReason: "Toutes les étapes ont été envoyées.",
          lastStep: 1,
          lastSentAt: sent,
        },
      });
      await prisma.emailSend.create({
        data: {
          contactId: `${P}${suffix}`,
          toAddress: `${P}${suffix}@e2e.test`,
          subject: `Premier message pour ${first}`,
          campaignId,
          campaignName: "E2E — réinitialisation",
          sequenceId,
          sentAt: sent,
        },
      });
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
    await session.page.goto(`${BASE_URL}/campagnes/${campaignId}`, {
      waitUntil: "domcontentloaded",
    });
    await session.page.waitForTimeout(1200);
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    await prisma.sequenceDeparture.deleteMany({ where: { enrollment: { sequenceId } } });
    await prisma.sequenceEnrollment.deleteMany({ where: { sequenceId } });
    await prisma.emailSequenceStep.deleteMany({ where: { sequenceId } });
    await prisma.emailSequence.deleteMany({ where: { id: sequenceId } });
    await prisma.emailSend.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.activity.deleteMany({ where: { contactId: { startsWith: P } } });
    await prisma.contact.deleteMany({ where: { id: { startsWith: P } } });
    await prisma.mailbox.deleteMany({ where: { id: mailboxId } });
  });

  it("le bouton est atteignable, et regarder n'écrit rien", async () => {
    const button = session.page.getByRole("button", { name: "Réinitialiser la campagne" });
    expect(await reachable(button)).toBe(true);

    await button.click();
    await session.page.waitForTimeout(1200);

    const warning = session.page.getByText(/seront ramenées à l'étape 1/).first();
    expect(await reachable(warning)).toBe(true);
    const text = await warning.innerText();
    expect(text).toContain("un nouveau premier message");
    expect(text).toContain("second premier contact");

    // La confirmation dit aussi ce qui ne bouge pas.
    expect(
      await reachable(session.page.getByText(/Les envois passés ne sont pas effacés/).first()),
    ).toBe(true);

    // **Rien n'a été écrit** : les deux inscriptions sont toujours closes.
    expect(
      await prisma.sequenceEnrollment.count({ where: { sequenceId, status: "active" } }),
    ).toBe(0);

    expect(session.errors).toEqual([]);
  }, 60_000);

  it("confirmer ramène tout le monde à l'étape 1, sans toucher aux envois passés", async () => {
    const confirm = session.page.getByRole("button", {
      name: "Réinitialiser, et composer un nouveau premier message",
    });
    expect(await reachable(confirm)).toBe(true);
    await confirm.click();
    await session.page.waitForTimeout(2000);

    const rows = await prisma.sequenceEnrollment.findMany({
      where: { sequenceId },
      select: { status: true, lastStep: true, round: true, resetAt: true },
    });
    expect(rows.every((row) => row.status === "active")).toBe(true);
    expect(rows.every((row) => row.lastStep === 0)).toBe(true);
    expect(rows.every((row) => row.round === 2)).toBe(true);
    expect(rows.every((row) => row.resetAt !== null)).toBe(true);

    // Les envois passés sont des faits : ils restent.
    expect(await prisma.emailSend.count({ where: { campaignId } })).toBe(2);

    expect(session.errors).toEqual([]);
  }, 60_000);
});
