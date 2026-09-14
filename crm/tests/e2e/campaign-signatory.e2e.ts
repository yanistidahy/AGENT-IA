import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Le signataire d'une campagne, vu depuis les deux écrans qui le choisissent.
 *
 * Le défaut signalé ne produisait ni erreur ni test rouge : le menu portait
 * bien la bonne boîte — donc la bonne signature, puisque depuis le jalon 54
 * l'une **est** l'autre — mais l'écran ne le disait pas, et une boîte sans
 * signature rendait `« Sans signataire · »`, un séparateur qui pend dans le
 * vide. C'est exactement la classe de défaut du jalon 60 : correct sous le
 * capot, muet à l'écran. Elle ne s'attrape qu'en lisant ce qui est rendu.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

describe.skipIf(skip)("le signataire d'une campagne, à l'écran", () => {
  let browser: Browser;
  let session: Session;
  const campaignName = "E2E — signataire";
  let campaignId = "";
  let namedId = "";
  let mutedId = "";

  beforeAll(async () => {
    // Deux boîtes : l'une signe, l'autre non. La seconde est le cas qui
    // rendait un séparateur nu — elle doit désormais s'annoncer.
    const named = await prisma.mailbox.upsert({
      where: { slug: "e2e-signatory-named" },
      update: {},
      create: {
        slug: "e2e-signatory-named",
        label: "E2E Signée",
        signName: "Camille Rouvier",
        signTitle: "Fondatrice, Aura Flow AI",
        signPhone: "06 01 02 03 04",
        smtpFrom: "camille@e2e.test",
      },
    });
    namedId = named.id;

    const muted = await prisma.mailbox.upsert({
      where: { slug: "e2e-signatory-muted" },
      update: {},
      create: { slug: "e2e-signatory-muted", label: "E2E Muette" },
    });
    mutedId = muted.id;

    const campaign = await prisma.campaign.create({
      data: { name: campaignName, mailboxId: mutedId, selection: "" },
    });
    campaignId = campaign.id;

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
    await session.page.goto(`${BASE_URL}/campagnes`, { waitUntil: "domcontentloaded" });
    await session.page.waitForTimeout(1000);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.mailbox.deleteMany({ where: { id: { in: [namedId, mutedId] } } });
  });

  const card = () =>
    session.page
      .locator("section")
      .filter({ has: session.page.locator(`input[value="${campaignName}"]`) })
      .first();

  it("la création nomme le signataire, pas seulement la boîte", async () => {
    const label = session.page.getByText("Boîte d'envoi et signataire", { exact: true });
    expect(await reachable(label)).toBe(true);
  });

  it("chaque entrée porte le nom et l'adresse de qui signera", async () => {
    const option = session.page
      .locator("select")
      .first()
      .locator(`option[value="${namedId}"]`);
    expect(await option.innerText()).toBe(
      "E2E Signée · Camille Rouvier (camille@e2e.test)",
    );
  });

  it("une boîte sans signature l'annonce, au lieu de laisser pendre un séparateur", async () => {
    const option = session.page
      .locator("select")
      .first()
      .locator(`option[value="${mutedId}"]`);
    const text = await option.innerText();
    expect(text).toBe("E2E Muette · signataire non renseigné");
    expect(text).not.toMatch(/·\s*$/);
  });

  it("la création montre les lignes qui partiront, et avertit quand il n'y en a pas", async () => {
    const select = session.page.locator("select").first();

    await select.selectOption(namedId);
    await session.page.waitForTimeout(300);
    const preview = session.page.getByText("Signature des messages").first();
    expect(await reachable(preview)).toBe(true);
    const block = await preview.locator("..").innerText();
    // Trois lignes depuis le jalon 67 : nom, titre, téléphone. L'adresse n'y
    // figure plus, elle est déjà l'expéditeur du message.
    expect(block).toContain("Camille Rouvier");
    expect(block).toContain("06 01 02 03 04");
    expect(block).not.toContain("camille@e2e.test");

    await select.selectOption(mutedId);
    await session.page.waitForTimeout(300);
    const warning = session.page.getByText(/ne porte aucun nom de signataire/).first();
    expect(await reachable(warning)).toBe(true);
  });

  it("l'écran d'édition dit la même chose, et suit le changement de boîte", async () => {
    await card().scrollIntoViewIfNeeded();
    expect(
      await card().getByText("Envoyée depuis et signée par").count(),
    ).toBeGreaterThan(0);

    // Les entrées y sont composées par la même fonction qu'à la création —
    // sinon c'est le second écran qu'on oublierait de corriger.
    expect(
      await card().locator(`option[value="${mutedId}"]`).innerText(),
    ).toBe("E2E Muette · signataire non renseigné");

    // La campagne part d'une boîte muette : l'avertissement doit être là.
    expect(await card().getByText(/ne porte aucun nom de signataire/).count()).toBe(1);

    const select = card().locator("select").first();
    await select.selectOption(namedId);
    await session.page.waitForTimeout(1500);

    const block = await card().innerText();
    expect(block).toContain("Camille Rouvier");
    expect(block).not.toContain("ne porte aucun nom de signataire");

    // Et le choix est bien écrit, pas seulement affiché.
    const saved = await prisma.campaign.findUnique({ where: { id: campaignId } });
    expect(saved?.mailboxId).toBe(namedId);
  });

  it("rien n'a été écrit dans la console", () => {
    expect(session.errors).toEqual([]);
  });
});
