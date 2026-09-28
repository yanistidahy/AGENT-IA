import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { templateFingerprint } from "../../lib/domain/departure-content";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Une carte vide et une carte périmée le disent, et se réécrivent au clic.**
 *
 * Le défaut mesuré au jalon 96 tenait à deux cartes qui **ne disaient rien** :
 * l'une portait l'étiquette OBJET sans objet et un corps réduit à la signature,
 * avec un bouton « Envoyer » actif ; l'autre affichait un avertissement
 * « phrase retirée » calculé sur le gabarit du jour, au-dessus d'un texte
 * composé avant la modification — deux affirmations contradictoires au même
 * endroit.
 *
 * Rien de cela ne se lit dans un diff, et rien ne se mesure sans cliquer.
 * L'assertion qui compte est **`reachable()`, jamais `isVisible()`** : celle-ci
 * ne voit ni un ancêtre qui rogne, ni un avertissement rendu à des écrans du
 * geste (leçon du jalon 60).
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const SLUG = "e2e-empty-96";
const TAG = "E2eEmpty96";
const SIGNATURE = "Yanis Tidahy\nFondateur, Aura Flow AI\n07 85 28 35 36";

let browser: Browser | null = null;
let session: Session | null = null;

async function wipe(): Promise<void> {
  await prisma.sequenceDeparture.deleteMany({
    where: { enrollment: { sequence: { campaign: { name: { startsWith: TAG } } } } },
  });
  await prisma.sequenceEnrollment.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: TAG } } } },
  });
  await prisma.emailStepVariant.deleteMany({
    where: { step: { sequence: { campaign: { name: { startsWith: TAG } } } } },
  });
  await prisma.emailSequenceStep.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: TAG } } } },
  });
  await prisma.emailSequence.deleteMany({ where: { campaign: { name: { startsWith: TAG } } } });
  await prisma.campaign.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.contact.deleteMany({ where: { lastName: TAG } });
  await prisma.mailbox.deleteMany({ where: { slug: SLUG } });
}

const STEP_BODY = "Bonjour {prenom},\n\nUne phrase écrite dans l'étape, après coup.";

async function seed(mailboxId: string): Promise<string> {
  const campaign = await prisma.campaign.create({
    data: { name: `${TAG} campagne`, mailboxId, mode: "manual" },
  });
  const sequence = await prisma.emailSequence.create({
    data: {
      name: `${TAG} campagne`,
      campaignId: campaign.id,
      active: true,
      autoMode: false,
      steps: {
        // Le texte de l'étape **existe** maintenant : c'est ce qui rend les deux
        // départs ci-dessous respectivement vide et périmé.
        create: [
          { position: 1, delayDays: 0, brief: "", mode: "manual", subject: "Objet de l'étape", body: STEP_BODY },
        ],
      },
    },
  });

  const contact = async (firstName: string) =>
    prisma.contact.create({
      data: {
        firstName,
        lastName: TAG,
        email: `${firstName.toLowerCase()}@e2e-empty-96.test`,
        lifecycle: "Prospect",
        owner: "Yanis",
        searchText: `${firstName.toLowerCase()} ${TAG.toLowerCase()}`,
        nameKey: `${TAG.toLowerCase()} ${firstName.toLowerCase()}`,
      },
    });

  const departure = async (firstName: string, subject: string, body: string, hash: string) => {
    const person = await contact(firstName);
    const enrollment = await prisma.sequenceEnrollment.create({
      data: { sequenceId: sequence.id, contactId: person.id, status: "active", lastStep: 0 },
    });
    await prisma.sequenceDeparture.create({
      data: {
        enrollmentId: enrollment.id,
        step: 1,
        round: 1,
        status: "pending",
        day: new Date().toISOString().slice(0, 10),
        subject,
        body,
        templateHash: hash,
      },
    });
  };

  // Vide : composé quand l'étape n'avait pas de texte, donc réduit à la signature.
  await departure("Vida", "", SIGNATURE, "");
  // Périmé : composé depuis un autre gabarit que celui d'aujourd'hui.
  await departure(
    "Perry",
    "Ancien objet",
    `Bonjour Perry,\n\nAncien texte.\n\n${SIGNATURE}`,
    templateFingerprint({ mode: "manual", subject: "Ancien objet", body: "Ancien texte.", variants: [] }),
  );

  return campaign.id;
}

describe.skipIf(skip)("une carte vide et une carte périmée le disent", () => {
  let campaignId = "";

  beforeAll(async () => {
    await wipe();
    const box = await prisma.mailbox.create({
      data: {
        slug: SLUG,
        label: "Recette vide 96",
        position: 96,
        active: true,
        smtpHost: "127.0.0.1",
        smtpPort: 9025,
        smtpEncryption: "starttls",
        smtpUser: `${SLUG}@aura.test`,
        smtpFrom: `${SLUG}@aura.test`,
        smtpFromName: "Recette vide 96",
        signName: "Yanis Tidahy",
        signTitle: "Fondateur, Aura Flow AI",
        signPhone: "07 85 28 35 36",
        imapHost: "",
        imapCopyEnabled: false,
      },
    });
    campaignId = await seed(box.id);
    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  });

  afterAll(async () => {
    await browser?.close();
    await wipe();
    await prisma.$disconnect();
  });

  it("« Ce départ est vide » se lit, et « Réécrire » ramène le texte de l'étape", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    await page.goto(`${BASE_URL}/departs?campagne=${campaignId}`, { waitUntil: "networkidle" });
    const card = page.locator("article").filter({ hasText: "Vida" }).first();
    const warning = card.locator("[data-empty]").first();
    await warning.scrollIntoViewIfNeeded();
    expect(await reachable(warning)).toBe(true);
    expect((await warning.textContent()) ?? "").toContain("Ce départ est vide : réécrivez-le");

    const rewrite = warning.getByRole("button", { name: "Réécrire ce départ" });
    expect(await reachable(rewrite)).toBe(true);
    await rewrite.click();

    // Le texte de l'étape est arrivé, et le départ n'est plus vide : c'est la
    // base qui le dit, pas seulement l'écran.
    // **Sur la carte, pas sur la page** : d'autres campagnes peuvent porter
    // leurs propres départs vides, et l'assertion doit parler de celle-ci.
    await card.locator("[data-empty]").first().waitFor({ state: "detached", timeout: 20_000 });
    const row = await prisma.sequenceDeparture.findFirstOrThrow({
      where: { enrollment: { contact: { firstName: "Vida", lastName: TAG } } },
      select: { subject: true, body: true, status: true },
    });
    expect(row.status).toBe("pending");
    expect(row.subject).toBe("Objet de l'étape");
    expect(row.body).toContain("écrite dans l'étape");
  }, 90_000);

  it("« Composé avant votre dernière modification » se lit, et se réécrit", async () => {
    const current = session;
    expect(current).not.toBeNull();
    if (current === null) return;
    const { page } = current;

    await page.goto(`${BASE_URL}/departs?campagne=${campaignId}`, { waitUntil: "networkidle" });
    const card = page.locator("article").filter({ hasText: "Perry" }).first();
    const warning = card.locator("[data-stale]").first();
    await warning.scrollIntoViewIfNeeded();
    expect(await reachable(warning)).toBe(true);
    expect((await warning.textContent()) ?? "").toContain(
      "Composé avant votre dernière modification de la séquence",
    );

    // **Un avertissement de carte décrit ce qui partira** : la phrase retirée se
    // taît sur un départ périmé, elle parlerait d'un autre texte.
    expect(await card.locator("[data-dropped]").count()).toBe(0);

    await warning.getByRole("button", { name: "Réécrire ce départ" }).click();
    await card.locator("[data-stale]").first().waitFor({ state: "detached", timeout: 20_000 });
    const row = await prisma.sequenceDeparture.findFirstOrThrow({
      where: { enrollment: { contact: { firstName: "Perry", lastName: TAG } } },
      select: { body: true, templateHash: true },
    });
    expect(row.body).toContain("écrite dans l'étape");
    expect(row.templateHash).not.toBe("");
    expect(current.errors).toEqual([]);
  }, 90_000);
});
