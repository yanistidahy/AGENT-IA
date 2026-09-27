import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Le menu « Aperçu pour », et le routage d'« Autre ».**
 *
 * Trois choses qu'aucune lecture de code n'établit, et que ce projet a déjà
 * payées : un menu dont le **contenu** est plafonné par une règle écrite trois
 * fichiers plus haut, un compteur rendu **hors du champ de vision**, et un
 * contrôle qui répond sans rien écrire (jalons 60, 61, 77, 79). L'assertion qui
 * compte est donc `reachable()`, **jamais `isVisible()`** — celle-ci ne voit pas
 * un ancêtre qui rogne.
 *
 * Le test sème ses propres fiches et les efface.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const TAG = "E2eRoutage";

describe.skipIf(skip)("le menu liste tout le groupe, et « Autre » se route", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";

  async function wipe(): Promise<void> {
    await prisma.sequenceEnrollment.deleteMany({
      where: { sequence: { name: { startsWith: TAG } } },
    });
    await prisma.emailSequence.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.contact.deleteMany({ where: { lastName: { startsWith: TAG } } });
    await prisma.campaign.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.company.deleteMany({ where: { name: { startsWith: TAG } } });
  }

  beforeAll(async () => {
    await wipe();
    const company = await prisma.company.create({ data: { name: `${TAG} Maison` } });
    const mailbox = await prisma.mailbox.findFirstOrThrow({ select: { id: true } });

    const campaign = await prisma.campaign.create({
      data: {
        name: `${TAG} campagne`,
        mailboxId: mailbox.id,
        mode: "manual",
        // Le défaut d'une campagne **existante** : c'est l'état à vérifier.
        otherRouting: "default",
        sequence: {
          create: {
            name: `${TAG} campagne`,
            active: true,
            steps: {
              create: {
                position: 1,
                delayDays: 0,
                brief: "",
                mode: "manual",
                subject: "Objet {marque}",
                body:
                  "Bonjour {prenom},\n\nEn regardant {societe}, j'ai vu votre gamme.\n\n" +
                  "Mais il y a une partie du trafic qui se perd.",
              },
            },
          },
        },
      },
      include: { sequence: true },
    });
    campaignId = campaign.id;
    const sequenceId = campaign.sequence?.id ?? "";

    // **Vingt fiches Direction classées**, plus une « Autre » et une jamais
    // classée : c'est exactement le portefeuille du rapport.
    for (let index = 1; index <= 20; index += 1) {
      const suffix = String(index).padStart(2, "0");
      const contact = await prisma.contact.create({
        data: {
          firstName: `Dir${suffix}`,
          lastName: `${TAG} Direction`,
          nameKey: `dir${suffix} e2eroutage direction`,
          title: "Fondatrice",
          lifecycle: "Prospect",
          email: `dir${index}@e2eroutage.test`,
          companyId: company.id,
          contactGroup: "direction",
          groupSetBy: "auto",
        },
      });
      await prisma.sequenceEnrollment.create({
        data: { sequenceId, contactId: contact.id, status: "active", lastStep: 0 },
      });
    }
    for (const [first, group, source] of [
      ["Olga", "autre", "auto"],
      ["Ines", "autre", "none"],
    ] as const) {
      const contact = await prisma.contact.create({
        data: {
          firstName: first,
          lastName: `${TAG} ${group}${source}`,
          nameKey: `${first.toLowerCase()} e2eroutage`,
          title: "Coordinatrice logistique",
          lifecycle: "Prospect",
          email: `${first.toLowerCase()}@e2eroutage.test`,
          companyId: company.id,
          contactGroup: group,
          groupSetBy: source,
        },
      });
      await prisma.sequenceEnrollment.create({
        data: { sequenceId, contactId: contact.id, status: "active", lastStep: 0 },
      });
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  });

  afterAll(async () => {
    await browser?.close();
    await wipe();
    await prisma.$disconnect();
  });

  it("« Aperçu pour » liste les 20 fiches du groupe, avec leur compte", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "networkidle" });

    /*
      Une étape manuelle **déjà écrite** reste repliée (jalon 80 : on vient voir
      la structure avant de la modifier). On l'ouvre donc comme un doigt le
      ferait, plutôt que de supposer l'écran ouvert.
    */
    const opener = page.getByRole("button", { name: "Ouvrir l'étape 1" }).first();
    await opener.scrollIntoViewIfNeeded();
    expect(await reachable(opener), "le bouton d'ouverture de l'étape est atteignable").toBe(true);
    await opener.click();

    const tab = page.locator('[data-variant-tab="direction"]').first();
    await tab.scrollIntoViewIfNeeded();
    expect(await reachable(tab), "l'onglet Direction est atteignable").toBe(true);
    await tab.click();

    const select = page.locator("select").filter({ has: page.locator("option") }).last();
    await select.waitFor({ state: "attached", timeout: 20_000 });
    await select.scrollIntoViewIfNeeded();
    expect(await reachable(select), "le menu d'aperçu est atteignable").toBe(true);

    /*
      **C'est le défaut signalé, mesuré.** La version d'avant rendait exactement
      une entrée ici : une `Map` par groupe plafonnait la liste à une fiche.
    */
    const options = await select.locator("option").count();
    expect(options, "les 20 fiches Direction sont dans le menu").toBe(20);

    const count = page.locator("[data-sample-count]").first();
    await count.scrollIntoViewIfNeeded();
    expect(await reachable(count), "le compteur est atteignable").toBe(true);
    expect((await count.textContent()) ?? "").toContain("20 contacts dans ce groupe");

    expect(session.errors).toEqual([]);
  }, 120_000);

  it("le routage d'« Autre » s'écrit en base, et les compteurs le disent", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "networkidle" });

    const heading = page.getByText("Les contacts Autre et non classés reçoivent").first();
    await heading.scrollIntoViewIfNeeded();
    expect(await reachable(heading), "le réglage de routage est atteignable").toBe(true);

    // Le défaut d'une campagne existante : « Message par défaut », et la ligne
    // de comptage le dit plutôt que de laisser deviner.
    const note = page.locator("[data-routing-note]").first();
    await note.scrollIntoViewIfNeeded();
    expect(await reachable(note)).toBe(true);
    expect((await note.textContent()) ?? "").toContain(
      "reçoivent le message par défaut de l'étape",
    );

    const button = page.locator('[data-routing="direction"]').first();
    await button.scrollIntoViewIfNeeded();
    expect(await reachable(button), "le choix Direction est atteignable").toBe(true);
    await button.click();

    // **La base fait foi** : un bouton qui répond sans écrire est exactement le
    // défaut qu'un test de rendu ne verrait pas.
    await expect
      .poll(
        async () => {
          const row = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { otherRouting: true },
          });
          return row?.otherRouting ?? "";
        },
        { timeout: 15_000 },
      )
      .toBe("direction");

    const after = page.locator("[data-routing-note]").first();
    await after.waitFor({ state: "attached", timeout: 20_000 });
    await expect
      .poll(async () => (await after.textContent()) ?? "", { timeout: 20_000 })
      .toContain("Autre 1 · Non classé 1 → reçoivent Direction");

    /*
      **Router n'est pas classer.** Le groupe des deux fiches n'a pas bougé : ce
      qui a changé, c'est le texte qu'elles recevront.
    */
    const groups = await prisma.contact.findMany({
      where: { lastName: { startsWith: TAG }, firstName: { in: ["Olga", "Ines"] } },
      select: { firstName: true, contactGroup: true, groupSetBy: true },
      orderBy: { firstName: "asc" },
    });
    expect(groups).toEqual([
      { firstName: "Ines", contactGroup: "autre", groupSetBy: "none" },
      { firstName: "Olga", contactGroup: "autre", groupSetBy: "auto" },
    ]);

    expect(session.errors).toEqual([]);
  }, 120_000);
});
