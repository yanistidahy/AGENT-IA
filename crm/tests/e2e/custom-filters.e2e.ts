import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Les filtres personnalisés, **au clic**, et sans quitter /contacts.
 *
 * Tout le jalon tient dans des gestes : créer un filtre depuis la barre, cocher
 * des fiches au fil de **deux filtres de colonne différents**, les y ranger,
 * poser la puce, en retirer une, supprimer le filtre. Ce qu'aucun test de
 * service ne peut voir, c'est qu'une case ne se coche pas, qu'un panneau reste
 * hors du champ, ou que le compte tombe quand on change de filtre en cours de
 * sélection.
 *
 * L'assertion qui compte est `reachable()`, jamais `isVisible()` : le second
 * ignore un ancêtre qui rogne, et aurait déclaré vert le défaut du jalon 60.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const NAME = "Salon Paris";
const OWNERS = ["E2eOwnerA", "E2eOwnerB"] as const;

describe.skipIf(skip)("un filtre personnalisé se crée, se remplit et se supprime", () => {
  let browser: Browser;
  let session: Session;
  const contactIds: string[] = [];

  beforeAll(async () => {
    // Quatre fiches à nous, deux par propriétaire : c'est ce qui permet de
    // cocher sous deux filtres de colonne distincts sans dépendre d'un état
    // laissé par un jalon précédent.
    for (let i = 1; i <= 4; i += 1) {
      const contact = await prisma.contact.create({
        data: {
          firstName: `E2eFiltre${i}`,
          lastName: `Fiche${i}`,
          email: `e2e-filtre-${i}@exemple.test`,
          lifecycle: "Lead",
          owner: OWNERS[i <= 2 ? 0 : 1] as string,
          nameKey: `fiche${i} e2efiltre${i}`,
          searchText: `e2efiltre${i} fiche${i}`,
        },
      });
      contactIds.push(contact.id);
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD as string);
  }, 60_000);

  afterAll(async () => {
    await prisma.customFilter.deleteMany({ where: { name: NAME } });
    await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
    await browser?.close();
  });

  it("se crée depuis /contacts, sans quitter l'écran", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded" });

    const control = page.getByRole("button", { name: /Filtres personnalisés/ });
    expect(await reachable(control)).toBe(true);
    await control.click();

    const field = page.getByPlaceholder("Nom du filtre…");
    expect(await reachable(field)).toBe(true);
    await field.fill(NAME);
    const create = page.getByRole("button", { name: "Créer un filtre" });
    expect(await reachable(create)).toBe(true);
    await create.click();

    await page.waitForFunction(
      (name) => document.body.innerText.includes(name),
      NAME,
      { timeout: 15_000 },
    );
    // L'URL n'a pas bougé : on n'a jamais quitté /contacts.
    expect(new URL(page.url()).pathname).toBe("/contacts");
    expect(await prisma.customFilter.findFirst({ where: { name: NAME } })).not.toBeNull();
  }, 60_000);

  it("reçoit des fiches cochées au fil de deux filtres de colonne", async () => {
    const { page } = session;

    const check = async (owner: string) => {
      await page.goto(
        `${BASE_URL}/contacts?q=e2efiltre&f.owner=${encodeURIComponent(owner)}`,
        { waitUntil: "domcontentloaded" },
      );
      const boxes = page.locator('table tbody input[type="checkbox"]');
      await boxes.first().waitFor({ timeout: 15_000 });
      const count = await boxes.count();
      for (let i = 0; i < count; i += 1) await boxes.nth(i).check();
      return count;
    };

    const first = await check(OWNERS[0]);
    expect(first).toBe(2);
    // **Le compte ne tombe pas** quand on change de filtre de colonne en cours
    // de sélection : c'est la promesse du jalon 55, et elle est mesurée ici.
    const second = await check(OWNERS[1]);
    expect(second).toBe(2);

    const bar = page.getByText(/sélectionné/).first();
    expect(await reachable(bar)).toBe(true);
    await page.waitForFunction(
      () => document.body.innerText.includes("4 sélectionnés"),
      undefined,
      { timeout: 15_000 },
    );

    const add = page.getByRole("button", { name: "Ajouter à un filtre" });
    expect(await reachable(add)).toBe(true);
    await add.click();

    await page.getByText(/Ranger 4 fiches dans un filtre/).waitFor({ timeout: 15_000 });
    const target = page.getByRole("button", { name: NAME, exact: true });
    expect(await reachable(target)).toBe(true);
    await target.click();

    await page.getByText(/ajoutée/).first().waitFor({ timeout: 15_000 });

    const filter = await prisma.customFilter.findFirst({ where: { name: NAME } });
    expect(await prisma.customFilterMember.count({ where: { filterId: filter?.id } })).toBe(4);
  }, 90_000);

  it("se pose comme une puce, et se croise avec le cycle de vie", async () => {
    const { page } = session;
    const filter = await prisma.customFilter.findFirst({ where: { name: NAME } });
    await page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded" });

    // La puce porte le nom et le compte, à côté des puces de cycle de vie.
    const chip = page.getByRole("button", { name: new RegExp(`^${NAME}\\s*4$`) });
    expect(await reachable(chip)).toBe(true);
    await chip.click();

    await page.waitForFunction(
      (id) => new URL(location.href).searchParams.get("filtre") === id,
      filter?.id ?? "",
      { timeout: 15_000 },
    );
    const rows = page.locator("table tbody tr");
    await rows.first().waitFor({ timeout: 15_000 });
    expect(await rows.count()).toBe(4);

    // Croisé avec un cycle de vie : les deux clauses se cumulent.
    await page.goto(`${BASE_URL}/contacts?filtre=${filter?.id}&lifecycle=Client`, {
      waitUntil: "domcontentloaded",
    });
    expect(await page.locator("table tbody tr").count()).toBe(0);
  }, 60_000);

  it("retire une fiche sans toucher au CRM", async () => {
    const { page } = session;
    const filter = await prisma.customFilter.findFirst({ where: { name: NAME } });
    const before = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      orderBy: { id: "asc" },
    });

    await page.goto(`${BASE_URL}/contacts?filtre=${filter?.id}`, {
      waitUntil: "domcontentloaded",
    });
    const boxes = page.locator('table tbody input[type="checkbox"]');
    await boxes.first().waitFor({ timeout: 15_000 });
    await boxes.first().check();

    const remove = page.getByRole("button", { name: "Retirer du filtre" });
    expect(await reachable(remove)).toBe(true);
    await remove.click();

    const confirm = page.getByRole("button", { name: "Retirer", exact: true });
    expect(await reachable(confirm)).toBe(true);
    await confirm.click();

    await page.getByText(/Aucune fiche n'a été modifiée/).waitFor({ timeout: 15_000 });

    expect(await prisma.customFilterMember.count({ where: { filterId: filter?.id } })).toBe(3);
    const after = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      orderBy: { id: "asc" },
    });
    // Champ pour champ : c'est la promesse, et elle se vérifie autrement qu'à
    // l'œil.
    expect(after).toEqual(before);
  }, 60_000);

  it("se supprime en laissant toutes les fiches dans le CRM", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded" });

    // La confirmation dit ce qui reste — c'est la question qu'on se pose.
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toMatch(/reste(nt)? dans le CRM|ne contient aucune fiche/);
      void dialog.accept();
    });

    await page.getByRole("button", { name: /Filtres personnalisés/ }).click();
    // L'étiquette porte le nom du filtre : « Supprimer » tout court désignerait
    // aussi bien une autre suppression de l'écran.
    const remove = page.getByRole("button", { name: `Supprimer le filtre ${NAME}` });
    expect(await reachable(remove)).toBe(true);
    await remove.click();

    await page.waitForFunction(
      (name) => !document.body.innerText.includes(name),
      NAME,
      { timeout: 15_000 },
    );

    expect(await prisma.customFilter.findFirst({ where: { name: NAME } })).toBeNull();
    expect(await prisma.contact.count({ where: { id: { in: contactIds } } })).toBe(4);
  }, 60_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
