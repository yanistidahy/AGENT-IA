import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Le tableau des inscrits, **au clic**.
 *
 * Ce qu'aucune lecture de code n'aurait vu, et que ce fichier mesure : qu'une
 * puce existe et soit atteignable, qu'un en-tête trie réellement la colonne
 * qu'il nomme, et que les retirés à la main se distinguent à l'œil du reste.
 *
 * L'assertion qui compte est `reachable()`, jamais `isVisible()` : le second
 * ignore un ancêtre qui rogne, et aurait déclaré vert le défaut du jalon 60.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const TAG = "E2eRoster";
/** 8 inscrits : 6 écrits (dont 2 ouverts), 2 retirés depuis la file. */
const TOTAL = 8;
const REMOVED = 2;
const WRITTEN = TOTAL - REMOVED;

describe.skipIf(skip)("le tableau des inscrits se filtre, se trie et sépare les retraits", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";

  beforeAll(async () => {
    const mailbox = await prisma.mailbox.findFirst();
    const campaign = await prisma.campaign.create({
      data: { name: `${TAG} campagne`, mailboxId: mailbox?.id ?? "", selection: "" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: {
        name: `${TAG} séquence`,
        active: true,
        campaignId: campaign.id,
        steps: { create: [{ position: 0, delayDays: 0, brief: "consigne" }] },
      },
    });

    for (let i = 0; i < TOTAL; i += 1) {
      const contact = await prisma.contact.create({
        data: {
          firstName: `P${String(i).padStart(2, "0")}`,
          lastName: TAG,
          email: `e2e-roster-${i}@exemple.test`,
          lifecycle: "Lead",
          owner: "Yanis",
        },
      });
      const removed = i >= WRITTEN;
      const sentAt = new Date(2026, 0, 1 + i, 9, 0, 0);
      await prisma.sequenceEnrollment.create({
        data: {
          sequenceId: sequence.id,
          contactId: contact.id,
          status: removed ? "stopped" : "active",
          stopReason: removed ? "Retiré de la séquence à la main" : "",
          lastStep: removed ? 0 : 1,
          lastSentAt: removed ? null : sentAt,
        },
      });
      if (removed) continue;
      await prisma.emailSend.create({
        data: {
          contactId: contact.id,
          toAddress: contact.email ?? "",
          subject: "objet",
          body: "corps",
          messageId: `<e2e-roster-${i}@aura.test>`,
          sentAt,
          sequenceId: sequence.id,
          sequenceName: `${TAG} séquence`,
          sequenceStep: 1,
          tracked: true,
          firstOpenAt: i < 2 ? new Date(sentAt.getTime() + 3_600_000) : null,
          openCount: i < 2 ? 1 : 0,
          mailboxId: mailbox?.id,
        },
      });
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD as string);
  }, 90_000);

  afterAll(async () => {
    const sequence = await prisma.emailSequence.findFirst({ where: { name: `${TAG} séquence` } });
    if (sequence !== null) {
      await prisma.emailSend.deleteMany({ where: { sequenceId: sequence.id } });
      await prisma.sequenceEnrollment.deleteMany({ where: { sequenceId: sequence.id } });
      await prisma.emailSequenceStep.deleteMany({ where: { sequenceId: sequence.id } });
      await prisma.emailSequence.delete({ where: { id: sequence.id } });
    }
    await prisma.campaign.deleteMany({ where: { name: `${TAG} campagne` } });
    await prisma.contact.deleteMany({ where: { lastName: TAG } });
    await browser?.close();
  });

  it("la carte dit l'écart entre ce qu'elle compte et le tableau", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "domcontentloaded" });
    const note = page.getByText(new RegExp(`sur ${TOTAL} inscrits · ${REMOVED} jamais écrits`));
    expect(await reachable(note)).toBe(true);
  }, 60_000);

  it("« A reçu un premier message » est atteignable et rend le bon compte", async () => {
    const { page } = session;
    const chip = page.getByRole("button", { name: `A reçu un premier message (${WRITTEN})` });
    expect(await reachable(chip)).toBe(true);
    await chip.click();
    // Les lignes du tableau : autant que la puce annonce.
    await page.waitForFunction(
      (expected) => document.querySelectorAll("table tbody tr").length === expected,
      WRITTEN,
      { timeout: 15_000 },
    );
  }, 60_000);

  it("les en-têtes trient vraiment", async () => {
    const { page } = session;
    await page.getByRole("button", { name: "Tous (8)" }).click();

    const first = async () =>
      (await page.locator("table tbody tr").first().locator("td").first().innerText()).trim();

    const header = page.getByRole("button", { name: "Dernier message", exact: false });
    expect(await reachable(header)).toBe(true);
    const newest = await first();
    await header.click();
    const oldest = await first();
    expect(oldest).not.toBe(newest);

    // Et une autre colonne trie elle aussi, dans les deux sens : un en-tête
    // n'est pas un décor qui ne pilote qu'une seule colonne. (Les noms suivent
    // ici l'ordre des dates, d'où la comparaison entre les deux sens plutôt
    // qu'avec le tri précédent, qui serait vraie sans rien prouver.)
    const contact = page.getByRole("button", { name: "Contact", exact: false });
    await contact.click();
    const az = await first();
    await contact.click();
    expect(await first()).not.toBe(az);
  }, 60_000);

  it("les retirés à la main se distinguent, et restent en fin", async () => {
    const { page } = session;
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      const klass = (await rows.nth(i).getAttribute("class")) ?? "";
      const greyed = klass.includes("bg-surface-2");
      // Les deux dernières lignes sont les retraits, et elles seules.
      expect(greyed).toBe(i >= count - REMOVED);
    }
  }, 60_000);

  it("la colonne Ouvert rend les ouvertures vérifiables", async () => {
    const { page } = session;
    const opened = page.locator("table tbody tr td:nth-child(6)", { hasText: "◔" });
    expect(await opened.count()).toBe(2);
  }, 60_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
