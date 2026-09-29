import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Le plafond quotidien, vu depuis l'écran.**
 *
 * Trois choses ne se lisent pas dans un diff et ne se mesurent qu'en cliquant :
 * que le refus soit **atteignable** sur la carte cliquée (un verdict rendu en
 * tête d'une page haute de plusieurs écrans est un refus muet, jalon 91), que
 * la carte dise « reporté » plutôt que rien, et que le compteur du haut de la
 * file corresponde au journal des envois.
 *
 * L'assertion qui compte est **`reachable()`, jamais `isVisible()`** : celle-ci
 * ne voit pas un ancêtre qui rogne (leçon du jalon 60).
 *
 * Le plafond est posé à **1** : deux départs sur la même boîte, un envoi déjà
 * dans le journal, donc la boîte est pleine avant le premier clic. Aucun
 * serveur SMTP n'est nécessaire — c'est le plafond qui refuse, pas le
 * transport, et c'est précisément ce qu'on veut isoler.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const SLUG = "e2e-cap-100";
const TAG = "E2eCap100";

let browser: Browser | null = null;
let session: Session | null = null;
let previousCap = 50;

async function wipe(): Promise<void> {
  await prisma.emailSend.deleteMany({ where: { sequenceName: { startsWith: TAG } } });
  await prisma.sequenceDeparture.deleteMany({
    where: { enrollment: { sequence: { campaign: { name: { startsWith: TAG } } } } },
  });
  await prisma.sequenceEnrollment.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: TAG } } } },
  });
  await prisma.emailSequenceStep.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: TAG } } } },
  });
  await prisma.emailSequence.deleteMany({ where: { campaign: { name: { startsWith: TAG } } } });
  await prisma.campaign.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.contact.deleteMany({ where: { lastName: TAG } });
  await prisma.mailbox.deleteMany({ where: { slug: SLUG } });
}

/**
 * Un inscrit et son départ, à l'étape demandée.
 *
 * L'étape compte : c'est elle qui décide de l'ordre de priorité, une relance
 * passant devant un premier contact.
 */
async function seedDeparture(
  sequenceId: string,
  firstName: string,
  step: number,
): Promise<void> {
  const contact = await prisma.contact.create({
    data: {
      firstName,
      lastName: TAG,
      email: `${firstName.toLowerCase()}@e2e-cap-100.test`,
      lifecycle: "Prospect",
      owner: "Yanis",
      searchText: `${firstName.toLowerCase()} ${TAG.toLowerCase()}`,
      nameKey: `${TAG.toLowerCase()} ${firstName.toLowerCase()}`,
    },
  });
  const enrollment = await prisma.sequenceEnrollment.create({
    data: {
      sequenceId,
      contactId: contact.id,
      status: "active",
      // L'étape précédente est réputée envoyée : sans quoi `nextStep` demande
      // l'étape 1 et le départ d'étape 2 serait écarté avant le plafond.
      lastStep: step - 1,
      lastSentAt: step > 1 ? new Date(Date.now() - 30 * 24 * 3600 * 1000) : null,
    },
  });
  await prisma.sequenceDeparture.create({
    data: {
      enrollmentId: enrollment.id,
      step,
      round: 1,
      status: "pending",
      day: new Date().toISOString().slice(0, 10),
      subject: `Démonstration pour ${firstName}`,
      body: `Bonjour ${firstName},\n\nVoici une courte démonstration.\n\nBien à vous,`,
    },
  });
}

describe.skipIf(skip)("le plafond d'une boîte se lit et se refuse sur la carte", () => {
  beforeAll(async () => {
    await wipe();

    const settings = await prisma.settings.findUniqueOrThrow({
      where: { id: "singleton" },
      select: { dailyMailboxCap: true },
    });
    previousCap = settings.dailyMailboxCap;
    await prisma.settings.update({ where: { id: "singleton" }, data: { dailyMailboxCap: 1 } });

    const box = await prisma.mailbox.create({
      data: {
        slug: SLUG,
        label: "Recette plafond 100",
        position: 100,
        active: true,
        smtpHost: "127.0.0.1",
        smtpPort: 9025,
        smtpEncryption: "starttls",
        smtpUser: `${SLUG}@aura.test`,
        smtpFrom: `${SLUG}@aura.test`,
        smtpFromName: "Recette plafond 100",
        signName: "Yanis Tidahy",
        signTitle: "Fondateur, Aura Flow AI",
        signPhone: "07 85 28 35 36",
        imapHost: "",
        imapCopyEnabled: false,
      },
    });

    const campaign = await prisma.campaign.create({
      data: { name: `${TAG} campagne`, mailboxId: box.id, mode: "manual" },
    });
    const sequence = await prisma.emailSequence.create({
      data: {
        name: `${TAG} campagne`,
        campaignId: campaign.id,
        active: true,
        autoMode: false,
        steps: {
          create: [
            { position: 1, delayDays: 0, brief: "", mode: "manual", subject: "Un", body: "Un" },
            { position: 2, delayDays: 0, brief: "", mode: "manual", subject: "Deux", body: "Deux" },
          ],
        },
      },
    });

    // Premier contact d'abord dans l'ordre d'insertion : la priorité doit
    // néanmoins faire remonter la relance devant lui.
    await seedDeparture(sequence.id, "Premier", 1);
    await seedDeparture(sequence.id, "Relance", 2);

    // Un envoi déjà parti aujourd'hui de cette boîte : le plafond est atteint
    // avant le premier clic, et le compteur du haut doit le dire.
    await prisma.emailSend.create({
      data: {
        contactId: null,
        mailboxId: box.id,
        toAddress: "quelquun@e2e-cap-100.test",
        subject: `${TAG} envoi du jour`,
        sequenceName: `${TAG} campagne`,
        signatoryName: "Yanis Tidahy",
      },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  });

  afterAll(async () => {
    await browser?.close();
    await prisma.settings
      .update({ where: { id: "singleton" }, data: { dailyMailboxCap: previousCap } })
      .catch(() => undefined);
    await wipe();
    await prisma.$disconnect();
  });

  it("le compteur, le report et le refus se lisent sur l'écran", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    /*
      Le refus voyage **avec la file**, jamais en 400 nu : c'était la moitié du
      défaut du jalon 91, et un plafond refusé en silence serait le même écran.
    */
    const statuses: number[] = [];
    page.on("response", (response) => {
      if (response.request().method() === "POST" && response.url().endsWith("/api/departures")) {
        statuses.push(response.status());
      }
    });

    await page.goto(`${BASE_URL}/departs`, { waitUntil: "networkidle" });

    // 1 · le compteur par boîte, en tête, égal au journal.
    const counter = page.locator("[data-cap-usage]").first();
    await counter.scrollIntoViewIfNeeded();
    expect(await reachable(counter), "le compteur par boîte est atteignable").toBe(true);
    expect(await counter.innerText()).toContain(`${SLUG}@aura.test 1/1`);

    // 2 · la relance passe devant le premier contact, la capacité étant courte.
    const names = await page.locator("article h3, article h4").allInnerTexts();
    const relance = names.findIndex((entry) => entry.includes("Relance"));
    const premier = names.findIndex((entry) => entry.includes("Premier"));
    expect(relance, "les deux cartes sont là").toBeGreaterThanOrEqual(0);
    expect(premier).toBeGreaterThanOrEqual(0);
    expect(relance, "la relance passe devant le premier contact").toBeLessThan(premier);

    // 3 · les deux cartes disent qu'elles sont reportées, jamais échouées.
    const carried = page.locator("[data-carried]");
    expect(await carried.count(), "les deux départs sont reportés").toBe(2);
    const first = carried.first();
    await first.scrollIntoViewIfNeeded();
    expect(await reachable(first), "le report est atteignable").toBe(true);
    expect(await first.innerText()).toContain("Reporté : plafond de la boîte atteint");

    // 4 · le clic est refusé, nommément, sur la carte cliquée.
    const card = page.locator("article").filter({ hasText: "Relance" }).first();
    const send = card.getByRole("button", { name: "Envoyer" }).first();
    await send.scrollIntoViewIfNeeded();
    /*
      L'en-tête de groupe est collant (jalon 88) : amené pile en haut de la
      fenêtre, le bouton passe dessous. On remonte de la hauteur de cet en-tête
      avant de mesurer — ce qu'un lecteur fait sans y penser, et ce qui garde à
      `reachable()` son sens : « un doigt posé ici touche ce bouton ».
    */
    await page.mouse.wheel(0, -140);
    await page.waitForTimeout(200);
    expect(await reachable(send), "« Envoyer » est atteignable").toBe(true);
    await send.click();
    /*
      On **attend le verdict**, on ne dort pas un temps choisi au hasard : une
      attente fixe est verte ou rouge selon la charge de la machine, et un test
      qui tombe une fois sur dix apprend à ignorer le rouge.
    */
    await expect
      .poll(async () => await card.innerText(), { timeout: 30_000 })
      .toContain("Plafond atteint pour");

    expect(statuses, "la file voyage avec le verdict, jamais un 400 nu").toEqual([200]);
    const verdict = await card.innerText();
    expect(verdict).toContain(`Plafond atteint pour ${SLUG}@aura.test`);
    expect(verdict).toContain("1/1");
    expect(verdict).toContain("Ce départ partira demain");

    // 5 · rien n'est parti, et les deux départs restent en attente.
    const pending = await prisma.sequenceDeparture.count({
      where: {
        enrollment: { sequence: { campaign: { name: { startsWith: TAG } } } },
        status: "pending",
      },
    });
    expect(pending, "un départ refusé pour plafond reste en file").toBe(2);

    expect(current.errors).toEqual([]);
  }, 120_000);
});
