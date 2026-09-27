import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Un envoi qui échoue le dit sur sa carte, et le départ reste.**
 *
 * Le défaut du jalon 91 n'était pas qu'un envoi soit refusé — trois refus
 * étaient légitimes — c'est qu'il l'était **en silence** : un bandeau rendu en
 * tête d'une page qui fait plusieurs hauteurs depuis le jalon 88, et une route
 * qui répondait 400 nu, donc un écran resté sur son état d'avant le clic. On
 * lisait « rien ne se passe », ce qui se confond exactement avec un bouton mort.
 *
 * Rien de cela ne se voit à la relecture d'un diff, et rien ne se mesure sans
 * cliquer : d'où ce test. L'assertion qui compte est **`reachable()`, jamais
 * `isVisible()`** — celle-ci ne voit pas un ancêtre qui rogne ni un verdict
 * rendu à des écrans du geste (leçon du jalon 60).
 *
 * Deux refus sont exercés, choisis parce qu'ils se reproduisent **sans dépendre
 * d'un serveur SMTP** : la boîte dont le mot de passe n'est pas posé sur le
 * service, et la campagne en pause. Le succès, lui, demande un puits SMTP et
 * n'est pas couvert ici — voir la note du jalon dans CLAUDE.md.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

/* Un slug dont la variable ne peut pas être posée par hasard. */
const SLUG = "e2e-send-91";
const ENV_NAME = "SMTP_PASSWORD_E2E_SEND_91";
const TAG = "E2eSend91";

let browser: Browser | null = null;
let session: Session | null = null;

async function wipe(): Promise<void> {
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

/** Une campagne manuelle, un inscrit, un départ prêt à être validé. */
async function seedCampaign(
  mailboxId: string,
  name: string,
  firstName: string,
  active: boolean,
): Promise<void> {
  const campaign = await prisma.campaign.create({ data: { name, mailboxId, mode: "manual" } });
  const sequence = await prisma.emailSequence.create({
    data: {
      name,
      campaignId: campaign.id,
      active,
      autoMode: false,
      steps: {
        create: [
          {
            // Position 1 et non 0 : `nextStep` cherche `lastStep + 1`, et une
            // étape en position 0 se lit « toutes les étapes ont été envoyées ».
            position: 1,
            delayDays: 0,
            brief: "",
            mode: "manual",
            subject: `Démonstration pour ${firstName}`,
            body: `Bonjour ${firstName},\n\nVoici une courte démonstration.\n\nBien à vous,`,
          },
        ],
      },
    },
  });
  const contact = await prisma.contact.create({
    data: {
      firstName,
      lastName: TAG,
      email: `${firstName.toLowerCase()}@e2e-send-91.test`,
      lifecycle: "Prospect",
      owner: "Yanis",
      searchText: `${firstName.toLowerCase()} ${TAG.toLowerCase()}`,
      nameKey: `${TAG.toLowerCase()} ${firstName.toLowerCase()}`,
    },
  });
  const enrollment = await prisma.sequenceEnrollment.create({
    data: { sequenceId: sequence.id, contactId: contact.id, status: "active", lastStep: 0 },
  });
  await prisma.sequenceDeparture.create({
    data: {
      enrollmentId: enrollment.id,
      step: 1,
      round: 1,
      status: "pending",
      day: new Date().toISOString().slice(0, 10),
      subject: `Démonstration pour ${firstName}`,
      body: `Bonjour ${firstName},\n\nVoici une courte démonstration.\n\nBien à vous,`,
    },
  });
}

describe.skipIf(skip)("un envoi refusé se voit sur sa carte", () => {
  beforeAll(async () => {
    await wipe();
    const box = await prisma.mailbox.create({
      data: {
        slug: SLUG,
        label: "Recette envoi 91",
        position: 91,
        active: true,
        smtpHost: "127.0.0.1",
        smtpPort: 9025,
        smtpEncryption: "starttls",
        smtpUser: `${SLUG}@aura.test`,
        smtpFrom: `${SLUG}@aura.test`,
        smtpFromName: "Recette envoi 91",
        signName: "Yanis Tidahy",
        signTitle: "Fondateur, Aura Flow AI",
        signPhone: "07 85 28 35 36",
        imapHost: "",
        imapCopyEnabled: false,
      },
    });
    await seedCampaign(box.id, `${TAG} active`, "Nadia", true);
    await seedCampaign(box.id, `${TAG} pause`, "Oscar", false);

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  });

  afterAll(async () => {
    await browser?.close();
    await wipe();
    await prisma.$disconnect();
  });

  /**
   * Le mot de passe n'est pas posé sur le service : le refus doit **nommer la
   * variable** — sans elle, on cherche dans l'application un réglage qui n'y
   * est pas — et le départ doit rester en file, faute de quoi un échec
   * ressemblerait à un envoi réussi.
   */
  it("mot de passe SMTP absent : la cause est nommée sur la carte, le départ reste", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    /*
      **Le refus voyage avec la file, jamais en 400 nu.** C'est la moitié du
      défaut : un 400 laissait l'écran sur son état d'avant le clic, donc une
      carte qui s'affichait comme si rien n'avait été tenté. On lit donc le
      statut de la réponse, pas seulement ce qui finit à l'écran.
    */
    const statuses: number[] = [];
    page.on("response", (response) => {
      if (response.request().method() === "POST" && response.url().endsWith("/api/departures")) {
        statuses.push(response.status());
      }
    });

    await page.goto(`${BASE_URL}/departs`, { waitUntil: "networkidle" });
    const card = page.locator("article").filter({ hasText: "Nadia" }).first();
    const send = card.getByRole("button", { name: "Envoyer" });
    await send.scrollIntoViewIfNeeded();
    expect(await reachable(send)).toBe(true);

    await send.click();
    const verdict = card.getByRole("status").filter({ hasText: "Rien n'est parti" }).first();
    await verdict.waitFor({ state: "attached", timeout: 20_000 });
    await verdict.scrollIntoViewIfNeeded();

    // **Atteignable, pas seulement rendu** : c'est tout le défaut du jalon.
    expect(await reachable(verdict)).toBe(true);
    const message = (await verdict.textContent()) ?? "";
    expect(message).toContain(ENV_NAME);
    expect(message).toMatch(/variables du service|Railway/);

    // La carte n'a pas quitté la file, et rien n'est marqué comme envoyé.
    expect(await card.count()).toBe(1);
    const rows = await prisma.sequenceDeparture.findMany({
      where: { enrollment: { contact: { firstName: "Nadia", lastName: TAG } } },
      select: { status: true },
    });
    expect(rows.map((row) => row.status)).toEqual(["pending"]);
    expect(statuses).toEqual([200]);
  }, 60_000);

  /** Une campagne en pause ne laisse rien partir, et le dit en la nommant. */
  it("campagne en pause : le refus nomme la campagne, rien n'est envoyé", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    await page.goto(`${BASE_URL}/departs`, { waitUntil: "networkidle" });
    const card = page.locator("article").filter({ hasText: "Oscar" }).first();
    const send = card.getByRole("button", { name: "Envoyer" });
    await send.scrollIntoViewIfNeeded();
    expect(await reachable(send)).toBe(true);

    await send.click();
    const verdict = card.getByRole("status").filter({ hasText: "Rien n'est parti" }).first();
    await verdict.waitFor({ state: "attached", timeout: 20_000 });
    await verdict.scrollIntoViewIfNeeded();
    expect(await reachable(verdict)).toBe(true);

    const message = (await verdict.textContent()) ?? "";
    expect(message).toContain("en pause");
    expect(message).toContain(`${TAG} pause`);

    const rows = await prisma.sequenceDeparture.findMany({
      where: { enrollment: { contact: { firstName: "Oscar", lastName: TAG } } },
      select: { status: true },
    });
    expect(rows.map((row) => row.status)).toEqual(["pending"]);
    expect(await prisma.emailSend.count({ where: { contact: { lastName: TAG } } })).toBe(0);

    expect(current.errors).toEqual([]);
  }, 60_000);
});
