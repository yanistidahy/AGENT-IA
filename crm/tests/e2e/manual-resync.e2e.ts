import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Enregistrer met la file à jour, et le clic seul peut le prouver.**
 *
 * Le jalon 96 rendait « périmé » lisible ; il laissait la correction à un geste
 * de plus. Ce qui manquait est ce que l'on fait réellement : on modifie l'objet
 * et le message d'une étape, on enregistre, et on s'attend à ce que la file
 * porte le nouveau texte.
 *
 * Trois choses ne se lisent pas dans un diff, et c'est pour elles que ce
 * fichier existe :
 *
 * 1. l'enregistrement **réécrit** les départs en attente, y compris ceux sans
 *    empreinte — les plus vieux, donc les plus sûrement périmés ;
 * 2. une retouche à la main **survit**, et se remplace au clic ;
 * 3. « Retirer des départs » efface le brouillon **sans** désinscrire, et
 *    l'enregistrement suivant le ramène.
 *
 * L'assertion qui compte est **`reachable()`, jamais `isVisible()`** : celle-ci
 * ne voit ni un ancêtre qui rogne, ni un bandeau rendu à des écrans du geste
 * (leçon des jalons 60 et 91).
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const P = "e2e97";
const SLUG = "e2e-resync-97";
const OLD_BODY = "Bonjour {prenom},\n\nAncien texte, celui d'avant l'enregistrement.";
const NEW_LINE = "Une phrase écrite pendant la recette du jalon 97.";

async function wipe(): Promise<void> {
  await prisma.sequenceDeparture.deleteMany({
    where: { enrollment: { sequence: { campaign: { name: { startsWith: P } } } } },
  });
  await prisma.sequenceEnrollment.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: P } } } },
  });
  await prisma.emailStepVariant.deleteMany({
    where: { step: { sequence: { campaign: { name: { startsWith: P } } } } },
  });
  await prisma.emailSequenceStep.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: P } } } },
  });
  await prisma.emailSequence.deleteMany({ where: { campaign: { name: { startsWith: P } } } });
  await prisma.campaign.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.contact.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.company.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.mailbox.deleteMany({ where: { slug: SLUG } });
}

describe.skipIf(skip)("enregistrer remet la file à jour", () => {
  let browser: Browser;
  let session: Session;
  let campaignId = "";
  let sequenceId = "";

  beforeAll(async () => {
    await wipe();
    const mailbox = await prisma.mailbox.create({
      data: {
        slug: SLUG,
        label: "Recette 97",
        signName: "Yanis Tidahy",
        signTitle: "Fondateur, Aura Flow AI",
        smtpFrom: "recette97@aura.test",
      },
    });
    const company = await prisma.company.create({
      data: { name: `${P} Maison`, nameKey: `${P} maison`, domain: `${P}.test` },
    });
    const campaign = await prisma.campaign.create({
      data: { name: `${P} campagne`, mailboxId: mailbox.id, mode: "manual", selection: "" },
    });
    campaignId = campaign.id;
    const sequence = await prisma.emailSequence.create({
      data: { name: `${P} campagne`, campaignId, active: true },
    });
    sequenceId = sequence.id;
    await prisma.emailSequenceStep.create({
      data: {
        sequenceId,
        position: 1,
        delayDays: 0,
        brief: "",
        mode: "manual",
        subject: "Ancien objet",
        body: OLD_BODY,
      },
    });

    // Trois fiches, trois états : un départ **sans empreinte** (composé avant
    // le jalon 96), un départ **retouché à la main**, et un inscrit dû **sans
    // départ du tout**.
    const seed = async (suffix: string, first: string) =>
      prisma.contact.create({
        data: {
          id: `${P}${suffix}`,
          firstName: first,
          lastName: "Recette",
          email: `${P}${suffix}@${P}.test`,
          companyId: company.id,
          lifecycle: "Prospect",
          owner: "Yanis",
        },
      });

    const enroll = async (contactId: string) =>
      prisma.sequenceEnrollment.create({
        data: { sequenceId, contactId, status: "active", lastStep: 0 },
      });

    const vieux = await seed("a", "Vieux");
    const retouche = await seed("b", "Retouche");
    const nouveau = await seed("c", "Nouveau");

    const e1 = await enroll(vieux.id);
    const e2 = await enroll(retouche.id);
    await enroll(nouveau.id);

    const day = new Date().toISOString().slice(0, 10);
    await prisma.sequenceDeparture.create({
      data: {
        enrollmentId: e1.id,
        step: 1,
        round: 1,
        status: "pending",
        day,
        subject: "Ancien objet",
        body: "Bonjour Vieux,\n\nAncien texte, celui d'avant l'enregistrement.",
        // **Aucune empreinte** : c'est le cas que le jalon 96 laissait de côté.
        templateHash: "",
      },
    });
    await prisma.sequenceDeparture.create({
      data: {
        enrollmentId: e2.id,
        step: 1,
        round: 1,
        status: "pending",
        day,
        subject: "Mon objet à moi",
        body: "Bonjour Retouche,\n\nUn texte que j'ai corrigé à la main.",
        templateHash: "",
        // Le geste lui-même, pas une déduction du texte.
        editedAt: new Date(),
      },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await wipe();
    await prisma.$disconnect();
  });

  it("enregistrer réécrit les départs en attente, même sans empreinte, sans rien facturer", async () => {
    const { page } = session;

    // **Le compteur d'usage est la preuve.** Une étape écrite à la main est une
    // substitution de balises : l'enregistrement ne doit appeler le modèle pour
    // personne.
    const billedBefore = await prisma.apiUsage.count();

    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // L'étape est repliée par défaut (jalon 80).
    await page.getByRole("button", { name: /Étape 1/ }).first().click();
    await page.waitForTimeout(500);

    const subject = page.getByPlaceholder(/Une démonstration préparée pour/).first();
    await subject.scrollIntoViewIfNeeded();
    expect(await reachable(subject)).toBe(true);
    await subject.fill("Nouvel objet du jalon 97");

    const body = page.getByPlaceholder(/Bonjour \{prenom\},/).first();
    await body.fill(`Bonjour {prenom},\n\n${NEW_LINE}`);
    await page.waitForTimeout(400);

    const save = page.getByRole("button", { name: "Enregistrer" }).first();
    await save.scrollIntoViewIfNeeded();
    expect(await reachable(save)).toBe(true);
    await save.click();
    await page.waitForTimeout(4000);

    // Le rapport se lit à l'écran, et il compte les trois gestes séparément.
    const notice = page.getByText(/mis à jour/).first();
    await notice.scrollIntoViewIfNeeded();
    expect(await reachable(notice)).toBe(true);
    const text = await notice.innerText();
    expect(text).toContain("1 départ mis à jour");
    expect(text).toContain("1 créé");
    expect(text).toContain("conservé (retouché à la main)");

    // Et c'est la base qui le dit, pas seulement l'écran.
    const vieux = await prisma.sequenceDeparture.findFirstOrThrow({
      where: { enrollment: { contactId: `${P}a` } },
      select: { subject: true, body: true, templateHash: true, status: true },
    });
    expect(vieux.status).toBe("pending");
    expect(vieux.subject).toBe("Nouvel objet du jalon 97");
    expect(vieux.body).toContain(NEW_LINE);
    // L'empreinte est posée : le départ cesse d'être « on ne sait pas ».
    expect(vieux.templateHash).not.toBe("");

    // La retouche à la main est **intacte**.
    const retouche = await prisma.sequenceDeparture.findFirstOrThrow({
      where: { enrollment: { contactId: `${P}b` } },
      select: { subject: true, editedAt: true },
    });
    expect(retouche.subject).toBe("Mon objet à moi");
    expect(retouche.editedAt).not.toBeNull();

    // L'inscrit dû sans départ en a un, avec le texte du jour.
    const nouveau = await prisma.sequenceDeparture.findFirstOrThrow({
      where: { enrollment: { contactId: `${P}c` } },
      select: { body: true },
    });
    expect(nouveau.body).toContain(NEW_LINE);

    // **Zéro appel au modèle**, prouvé par le compteur.
    expect(await prisma.apiUsage.count()).toBe(billedBefore);
    expect(session.errors).toEqual([]);
  }, 120_000);

  it("une retouche à la main est signalée, et se remplace au clic", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/departs?campagne=${campaignId}`, { waitUntil: "networkidle" });

    const card = page.locator("article").filter({ hasText: "Retouche" }).first();
    const banner = card.locator("[data-edited]").first();
    await banner.scrollIntoViewIfNeeded();
    expect(await reachable(banner)).toBe(true);
    expect((await banner.textContent()) ?? "").toContain("Retouché à la main");
    expect((await banner.textContent()) ?? "").toContain("la séquence a changé depuis");

    const replace = banner.getByRole("button", { name: "Remplacer par le texte de la séquence" });
    expect(await reachable(replace)).toBe(true);
    await replace.click();
    await card.locator("[data-edited]").first().waitFor({ state: "detached", timeout: 20_000 });

    const row = await prisma.sequenceDeparture.findFirstOrThrow({
      where: { enrollment: { contactId: `${P}b` } },
      select: { subject: true, body: true, editedAt: true },
    });
    expect(row.subject).toBe("Nouvel objet du jalon 97");
    expect(row.body).toContain(NEW_LINE);
    // Le texte n'est plus celui qu'on avait retouché : la marque part avec lui.
    expect(row.editedAt).toBeNull();
    expect(session.errors).toEqual([]);
  }, 120_000);

  it("« Retirer des départs » laisse le contact inscrit, et l'enregistrement le ramène", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/departs?campagne=${campaignId}`, { waitUntil: "networkidle" });

    const card = page.locator("article").filter({ hasText: "Vieux" }).first();
    const drop = card.getByRole("button", { name: "Retirer des départs" });
    await drop.scrollIntoViewIfNeeded();
    expect(await reachable(drop)).toBe(true);
    await drop.click();
    await card.waitFor({ state: "detached", timeout: 20_000 });

    // Le brouillon est parti, l'inscription n'a pas bougé.
    expect(
      await prisma.sequenceDeparture.count({ where: { enrollment: { contactId: `${P}a` } } }),
    ).toBe(0);
    const enrollment = await prisma.sequenceEnrollment.findFirstOrThrow({
      where: { contactId: `${P}a`, sequenceId },
      select: { status: true, lastStep: true },
    });
    expect(enrollment.status).toBe("active");
    expect(enrollment.lastStep).toBe(0);

    // Et le prochain enregistrement le ramène, avec le texte du jour.
    await page.goto(`${BASE_URL}/campagnes/${campaignId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const save = page.getByRole("button", { name: "Enregistrer" }).first();
    await save.scrollIntoViewIfNeeded();
    await save.click();
    await page.waitForTimeout(4000);

    const back = await prisma.sequenceDeparture.findFirstOrThrow({
      where: { enrollment: { contactId: `${P}a` } },
      select: { subject: true, body: true },
    });
    expect(back.subject).toBe("Nouvel objet du jalon 97");
    expect(back.body).toContain(NEW_LINE);
    expect(session.errors).toEqual([]);
  }, 120_000);

  it("« Retirer de la campagne » demande confirmation, et dit ce qu'elle fait", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/departs?campagne=${campaignId}`, { waitUntil: "networkidle" });

    const card = page.locator("article").filter({ hasText: "Nouveau" }).first();
    const remove = card.getByRole("button", { name: "Retirer de la campagne" }).first();
    await remove.scrollIntoViewIfNeeded();
    expect(await reachable(remove)).toBe(true);
    await remove.click();
    await page.waitForTimeout(400);

    // **La confirmation dit ce que le geste fait**, et elle ne se contente pas
    // d'un libellé : arrêter une inscription n'est pas ranger une file.
    const ask = card.getByText(/Arrêter l'inscription/).first();
    await ask.scrollIntoViewIfNeeded();
    expect(await reachable(ask)).toBe(true);
    const asked = await ask.innerText();
    expect(asked).toContain("Ses envois passés et son historique restent");

    // Tant qu'on n'a pas confirmé, rien n'est écrit.
    const before = await prisma.sequenceEnrollment.findFirstOrThrow({
      where: { contactId: `${P}c`, sequenceId },
      select: { status: true },
    });
    expect(before.status).toBe("active");

    await card.getByRole("button", { name: "Retirer de la campagne" }).last().click();
    await card.waitFor({ state: "detached", timeout: 20_000 });

    const after = await prisma.sequenceEnrollment.findFirstOrThrow({
      where: { contactId: `${P}c`, sequenceId },
      select: { status: true, stopReason: true },
    });
    expect(after.status).toBe("stopped");
    expect(after.stopReason).not.toBe("");
    expect(session.errors).toEqual([]);
  }, 120_000);
});
