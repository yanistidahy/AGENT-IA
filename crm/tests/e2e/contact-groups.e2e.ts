import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Les groupes de fonction, cliqués.**
 *
 * Trois choses qu'aucune lecture de code n'établit, et que ce projet a déjà
 * payées trois fois (jalons 60, 61, 79) : un contrôle rendu mais **rogné** par
 * un ancêtre, un compteur affiché **hors du champ de vision**, et un bouton qui
 * répond sans rien écrire. L'assertion qui compte est donc `reachable()`,
 * **jamais `isVisible()`** — celle-ci ne voit pas un ancêtre qui rogne.
 *
 * Le test sème ses propres fiches et les efface : il ne dépend d'aucun état
 * laissé par une recette précédente.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const TAG = "E2eGroupes";

describe.skipIf(skip)("les groupes de fonction se corrigent et se recalculent", () => {
  let browser: Browser;
  let session: Session;
  let neverId = "";

  async function wipe(): Promise<void> {
    await prisma.contact.deleteMany({ where: { lastName: { startsWith: TAG } } });
    await prisma.company.deleteMany({ where: { name: { startsWith: TAG } } });
  }

  beforeAll(async () => {
    await wipe();
    const company = await prisma.company.create({ data: { name: `${TAG} Maison` } });

    // Une fiche **jamais classée** : c'est le cas de toutes celles d'avant les
    // groupes, et celui que l'écran doit nommer « Non classé » plutôt qu'« Autre ».
    const never = await prisma.contact.create({
      data: {
        firstName: "Ines",
        lastName: `${TAG} Jamais`,
        title: "Responsable e-commerce",
        lifecycle: "Prospect",
        email: "ines@e2egroupes.test",
        companyId: company.id,
        contactGroup: "autre",
        groupSetBy: "none",
      },
    });
    neverId = never.id;

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  });

  afterAll(async () => {
    await browser?.close();
    await wipe();
    await prisma.$disconnect();
  });

  it("une fiche jamais classée se lit « Non classé », jamais « Autre »", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/contacts?fiche=${neverId}`, { waitUntil: "networkidle" });

    const heading = page.getByRole("heading", { name: "Groupe de fonction" });
    expect(await reachable(heading), "le bloc du groupe est atteignable").toBe(true);

    const label = page.getByText("Non classé", { exact: false }).first();
    expect(await reachable(label)).toBe(true);
    expect((await label.textContent()) ?? "").toContain("Non classé");

    expect(session.errors).toEqual([]);
  }, 90_000);

  it("la corriger à la main l'écrit en base, et la marque « défini à la main »", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/contacts?fiche=${neverId}`, { waitUntil: "networkidle" });

    const button = page.getByRole("button", { name: "Commercial", exact: true }).first();
    expect(await reachable(button), "le choix Commercial est atteignable").toBe(true);
    await button.click();

    // La base fait foi : un bouton qui répond sans écrire est exactement le
    // défaut qu'un test de rendu ne verrait pas.
    await expect
      .poll(
        async () => {
          const row = await prisma.contact.findUnique({
            where: { id: neverId },
            select: { contactGroup: true, groupSetBy: true },
          });
          return `${row?.contactGroup}/${row?.groupSetBy}`;
        },
        { timeout: 15_000 },
      )
      .toBe("commercial/manual");

    expect(session.errors).toEqual([]);
  }, 90_000);

  it("« Recalculer les groupes » classe les fiches et conserve la correction", async () => {
    const { page } = session;

    // Une seconde fiche, non classée, que le recalcul doit prendre en charge.
    const autoRow = await prisma.contact.create({
      data: {
        firstName: "Karim",
        lastName: `${TAG} Auto`,
        title: "Directeur général",
        lifecycle: "Prospect",
        email: "karim@e2egroupes.test",
        groupSetBy: "none",
      },
    });

    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "networkidle" });

    const button = page.getByRole("button", { name: "Recalculer les groupes" });
    // `/reglages` fait plusieurs hauteurs d'écran : on amène le bouton dans le
    // champ de vision comme le ferait un doigt, puis on vérifie qu'il est
    // réellement **atteignable** — ce qu'`isVisible()` ne dit pas.
    await button.scrollIntoViewIfNeeded();
    expect(await reachable(button), "le bouton de recalcul est atteignable").toBe(true);
    await button.click();

    const report = page.getByText(/corrections manuelles conservées/).first();
    await report.waitFor({ state: "attached", timeout: 20_000 });
    await report.scrollIntoViewIfNeeded();
    expect(await reachable(report)).toBe(true);
    expect((await report.textContent()) ?? "").toMatch(
      /\d+ contacts reclassés, \d+ corrections manuelles conservées/,
    );

    const recomputed = await prisma.contact.findUnique({
      where: { id: autoRow.id },
      select: { contactGroup: true, groupSetBy: true },
    });
    expect(recomputed).toEqual({ contactGroup: "direction", groupSetBy: "auto" });

    // **La correction à la main survit**, alors que la fonction dit « marketing ».
    const kept = await prisma.contact.findUnique({
      where: { id: neverId },
      select: { contactGroup: true, groupSetBy: true },
    });
    expect(kept).toEqual({ contactGroup: "commercial", groupSetBy: "manual" });

    expect(session.errors).toEqual([]);
  }, 120_000);
});
