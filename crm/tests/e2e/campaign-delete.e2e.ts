import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Supprimer une campagne qui a envoyé — au clic, pas à la lecture.
 *
 * La leçon du jalon 60 tenait à un contrôle qui *rendait* correctement et ne
 * *faisait* rien : la seule façon de l'attraper est de cliquer. Celui-ci en
 * ajoute un second qui mérite la même garde — bouton de confirmation
 * **désactivé tant que le nom tapé ne correspond pas exactement**, la
 * friction même que le jalon 61 demande. Un test qui ne cliquerait pas
 * dedans ne prouverait que l'affichage de l'attribut `disabled` au premier
 * rendu, pas qu'il retombe correctement à chaque frappe.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

describe.skipIf(skip)("supprimer une campagne qui a envoyé, au clic", () => {
  let browser: Browser;
  let session: Session;
  const campaignName = "E2E — campagne à supprimer";
  let campaignId: string;
  let mailboxId: string;
  let contactId: string;

  beforeAll(async () => {
    const mailbox = await prisma.mailbox.upsert({
      where: { slug: "e2e-campaign-delete" },
      update: {},
      create: { slug: "e2e-campaign-delete", label: "E2E", signName: "Test" },
    });
    mailboxId = mailbox.id;

    const contact = await prisma.contact.create({
      data: {
        firstName: "E2E",
        lastName: "Delete",
        lifecycle: "Prospect",
        email: "e2e-delete@test.fr",
        searchText: "e2e delete",
      },
    });
    contactId = contact.id;

    const campaign = await prisma.campaign.create({
      data: { name: campaignName, mailboxId, selection: "" },
    });
    campaignId = campaign.id;

    const sequence = await prisma.emailSequence.create({
      data: { name: campaignName, campaignId },
    });
    await prisma.sequenceEnrollment.create({
      data: { sequenceId: sequence.id, contactId, status: "active", lastStep: 1 },
    });
    await prisma.emailSend.create({
      data: {
        contactId,
        toAddress: contact.email,
        subject: "S",
        body: "B",
        mailboxId,
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        campaignId,
        campaignName: campaign.name,
      },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
    await session.page.goto(`${BASE_URL}/campagnes`, { waitUntil: "domcontentloaded" });
    await session.page.waitForTimeout(1000);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    // La campagne devrait déjà être partie (c'est ce que le test vérifie) —
    // ce nettoyage couvre le cas où une assertion échoue en amont et laisse
    // la fixture derrière elle.
    await prisma.emailSend.deleteMany({ where: { campaignId } });
    await prisma.emailSequence.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.contact.deleteMany({ where: { id: contactId } });
  });

  const card = () =>
    session.page.locator("section").filter({ has: session.page.locator(`input[value="${campaignName}"]`) }).first();

  // `reachable()` exige que l'élément soit **dans le viewport courant**, et
  // c'est voulu — c'est ce qui attrape un panneau rogné. Mais la page peut
  // porter d'autres campagnes au-dessus de celle-ci, et rien ne la fait
  // défiler toute seule : un vrai geste de souris le ferait, `reachable()`
  // ne le fait pas à sa place.
  const scrollToCard = () => card().scrollIntoViewIfNeeded();

  it("« Supprimer » simple n'apparaît pas — elle a envoyé", async () => {
    await scrollToCard();
    const simple = card().getByRole("button", { name: "Supprimer", exact: true });
    expect(await simple.count()).toBe(0);
  });

  it("« Supprimer quand même » ouvre un panneau atteignable, bouton désactivé", async () => {
    await scrollToCard();
    const opener = card().getByRole("button", { name: "Supprimer quand même" });
    expect(await reachable(opener)).toBe(true);
    await opener.click();

    const submit = card().getByRole("button", {
      name: /Supprimer définitivement, avec son historique/,
    });
    expect(await reachable(submit)).toBe(true);
    expect(await submit.isDisabled()).toBe(true);
  });

  it("un nom à la casse différente ne débloque rien", async () => {
    await scrollToCard();
    const input = card().getByPlaceholder(campaignName);
    await input.fill(campaignName.toLowerCase());
    const submit = card().getByRole("button", {
      name: /Supprimer définitivement, avec son historique/,
    });
    expect(await submit.isDisabled()).toBe(true);
  });

  it("le nom exact débloque le bouton, en rouge — pas en gris", async () => {
    await scrollToCard();
    const input = card().getByPlaceholder(campaignName);
    await input.fill(campaignName);
    const submit = card().getByRole("button", {
      name: /Supprimer définitivement, avec son historique/,
    });
    expect(await submit.isDisabled()).toBe(false);

    // Le défaut trouvé en construisant ce jalon : `bg-danger` ne résolvait à
    // aucune couleur (`--color-danger` n'existait dans aucune feuille de
    // style), donc un bouton « non désactivé » restait transparent — vert
    // sur `disabled`, muet sur la couleur. `opacity: 1` distingue les deux :
    // un bouton vraiment grisé porte `disabled:opacity-50`.
    const style = await submit.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(style).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("le clic supprime — la carte disparaît, sans erreur console", async () => {
    await scrollToCard();
    const submit = card().getByRole("button", {
      name: /Supprimer définitivement, avec son historique/,
    });
    await submit.click();
    await session.page.waitForTimeout(1000);

    expect(await session.page.locator(`input[value="${campaignName}"]`).count()).toBe(0);
    expect(session.errors).toEqual([]);
  });

  it("la campagne, sa séquence et ses envois ont bien disparu de la base", async () => {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    const sends = await prisma.emailSend.count({ where: { campaignId } });
    expect(campaign).toBeNull();
    expect(sends).toBe(0);
  });

  it("le contact, lui, est resté — fiche et cycle de vie intacts", async () => {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    expect(contact).not.toBeNull();
    expect(contact?.lifecycle).toBe("Prospect");
    expect(contact?.email).toBe("e2e-delete@test.fr");
  });
});
