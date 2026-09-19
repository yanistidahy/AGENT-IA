import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Les listes nommées, **au clic**.
 *
 * Tout le jalon tient dans des gestes : cocher des fiches au fil des filtres,
 * les ranger, en retirer une, supprimer la liste. Le service est vérifié par
 * ailleurs contre une vraie base ; ce qu'aucun de ces tests ne peut voir, c'est
 * qu'une case ne se coche pas, qu'une barre reste hors du champ ou qu'un menu
 * s'ouvre dans le vide — les deux contrôles morts des jalons 56 et 59.
 *
 * L'assertion qui compte est `reachable()`, jamais `isVisible()` : le second
 * ignore un ancêtre qui rogne, et aurait déclaré vert le défaut du jalon 60.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

describe.skipIf(skip)("une liste se constitue, se travaille et se supprime", () => {
  let browser: Browser;
  let session: Session;
  const contactIds: string[] = [];

  beforeAll(async () => {
    // Trois fiches à nous, reconnaissables : le test ne dépend d'aucun état
    // laissé par un jalon précédent.
    for (let i = 1; i <= 3; i += 1) {
      const contact = await prisma.contact.create({
        data: {
          firstName: `E2eListe${i}`,
          lastName: `Fiche${i}`,
          email: `e2e-liste-${i}@exemple.test`,
          lifecycle: "Lead",
          owner: "Yanis",
          nameKey: `fiche${i} e2eliste${i}`,
          searchText: `e2eliste${i} fiche${i}`,
        },
      });
      contactIds.push(contact.id);
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD as string);
  }, 60_000);

  afterAll(async () => {
    await prisma.contactList.deleteMany({ where: { name: { startsWith: "E2E liste" } } });
    await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
    await browser?.close();
  });

  it("se crée depuis /listes et s'ouvre sur sa propre page", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/listes`, { waitUntil: "domcontentloaded" });

    const field = page.getByPlaceholder("Nom de la liste…");
    expect(await reachable(field)).toBe(true);
    await field.fill("E2E liste salon");
    const create = page.getByRole("button", { name: "Nouvelle liste" });
    expect(await reachable(create)).toBe(true);
    await create.click();

    await page.waitForURL(/\/listes\/[a-z0-9]+/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "E2E liste salon" })).toBeTruthy();
    expect(await page.locator("h1").innerText()).toBe("E2E liste salon");
  }, 60_000);

  it("reçoit des fiches cochées depuis /contacts, et la barre est atteignable", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/contacts?q=e2eliste`, { waitUntil: "domcontentloaded" });

    // La case d'en-tête prend ce que le filtre affiche.
    const boxes = page.locator('table input[type="checkbox"]');
    await boxes.first().waitFor({ timeout: 15_000 });
    await boxes.nth(1).check();
    await boxes.nth(2).check();

    const bar = page.getByText(/sélectionné/).first();
    expect(await reachable(bar)).toBe(true);

    const addButton = page.getByRole("button", { name: "Ajouter à une liste" });
    expect(await reachable(addButton)).toBe(true);
    await addButton.click();

    // Le panneau doit s'ouvrir avant qu'on y cherche une liste.
    await page.getByText(/Ranger 2 fiches dans une liste/).waitFor({ timeout: 15_000 });
    const target = page.getByRole("button", { name: "E2E liste salon", exact: true });
    expect(await reachable(target)).toBe(true);
    await target.click();

    await page.getByText(/ajoutée/).first().waitFor({ timeout: 15_000 });

    const list = await prisma.contactList.findFirst({ where: { name: "E2E liste salon" } });
    expect(list).not.toBeNull();
    expect(await prisma.contactListMember.count({ where: { listId: list?.id } })).toBe(2);
  }, 60_000);

  it("retire une fiche sans toucher au CRM", async () => {
    const { page } = session;
    const list = await prisma.contactList.findFirst({ where: { name: "E2E liste salon" } });
    const before = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      orderBy: { id: "asc" },
    });

    await page.goto(`${BASE_URL}/listes/${list?.id}`, { waitUntil: "domcontentloaded" });
    const boxes = page.locator('table input[type="checkbox"]');
    await boxes.first().waitFor({ timeout: 15_000 });
    await boxes.nth(1).check();

    const remove = page.getByRole("button", { name: "Retirer de la liste" });
    expect(await reachable(remove)).toBe(true);
    await remove.click();

    const confirm = page.getByRole("button", { name: "Retirer", exact: true });
    expect(await reachable(confirm)).toBe(true);
    await confirm.click();

    await page.getByText(/Aucune fiche n'a été modifiée/).waitFor({ timeout: 15_000 });

    expect(await prisma.contactListMember.count({ where: { listId: list?.id } })).toBe(1);
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
    const list = await prisma.contactList.findFirst({ where: { name: "E2E liste salon" } });
    await page.goto(`${BASE_URL}/listes/${list?.id}`, { waitUntil: "domcontentloaded" });

    const open = page.getByRole("button", { name: "Supprimer la liste" });
    expect(await reachable(open)).toBe(true);
    await open.click();

    // La confirmation dit ce qui reste — c'est la question qu'on se pose.
    const warning = page.getByText(/reste(nt)? dans le CRM|ne contient aucune fiche/);
    expect(await reachable(warning)).toBe(true);

    const confirm = page.getByRole("button", { name: "Supprimer", exact: true });
    expect(await reachable(confirm)).toBe(true);
    await confirm.click();

    await page.waitForURL(/\/listes$/, { timeout: 15_000 });

    expect(await prisma.contactList.findFirst({ where: { name: "E2E liste salon" } })).toBeNull();
    expect(await prisma.contact.count({ where: { id: { in: contactIds } } })).toBe(3);
  }, 60_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
