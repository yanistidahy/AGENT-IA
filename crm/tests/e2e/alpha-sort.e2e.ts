import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, signIn, type Session } from "./browser";

/**
 * Le tri alphabétique, mesuré à l'écran.
 *
 * Le cas qui décide est « Édition » : en ordre d'octets — la collation
 * `C.UTF-8` de cette base — il tombe **après « Zèbre »**, et « ELIXIR » passe
 * **avant « Eden »**. Un test qui ne trierait que des noms sans accent serait
 * vert sur le défaut qu'il doit attraper.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

/** Volontairement semés dans le désordre, et par ordre de création inverse. */
const MARQUES = ["Zèbre E2E", "ELIXIR E2E", "Édition E2E", "Eden E2E", "Åby E2E"];

describe.skipIf(skip)("les listes de référence s'ouvrent alphabétiques", () => {
  let browser: Browser;
  let session: Session;
  const ids: string[] = [];

  beforeAll(async () => {
    for (const name of MARQUES) {
      const company = await prisma.company.create({
        data: { name, searchText: name.toLowerCase(), nameKey: null },
      });
      ids.push(company.id);
    }
    // Les clés sont écrites comme la migration les écrit — c'est le chemin des
    // fiches déjà en base, celui qui compte pour une installation existante.
    for (const id of ids) {
      const row = await prisma.company.findUniqueOrThrow({ where: { id } });
      const { companyNameKey } = await import("../../lib/api/name-keys");
      await prisma.company.update({
        where: { id },
        data: { nameKey: companyNameKey(row.name) },
      });
    }

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
  });

  it("/societes range « Édition » entre « Eden » et « Effet », pas après Z", async () => {
    await session.page.goto(`${BASE_URL}/societes`, { waitUntil: "domcontentloaded" });
    await session.page.waitForTimeout(800);

    const body = await session.page.innerText("body");
    const lus = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => MARQUES.includes(line));
    const vus = lus.filter((line, index) => lus[index - 1] !== line);

    expect(vus).toEqual(["Åby E2E", "Eden E2E", "Édition E2E", "ELIXIR E2E", "Zèbre E2E"]);
  });

  it("le tri par date reste accessible et change l'ordre", async () => {
    // Changer le défaut n'est pas retirer le choix : la vue triée par date
    // doit continuer de s'ouvrir, et de trier autrement.
    // `asc` = ordre de création, et les fiches ont été semées dans le désordre
    // alphabétique exprès : `desc` aurait ici coïncidé avec l'ordre alphabétique,
    // et le test aurait été vert sans rien démontrer.
    await session.page.goto(`${BASE_URL}/societes?sort=createdAt&dir=asc`, {
      waitUntil: "domcontentloaded",
    });
    await session.page.waitForTimeout(800);

    const body = await session.page.innerText("body");
    const lus = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => MARQUES.includes(line));
    const vus = lus.filter((line, index) => lus[index - 1] !== line);

    expect(vus.length).toBeGreaterThan(0);
    expect(vus).toEqual(["Zèbre E2E", "ELIXIR E2E", "Édition E2E", "Eden E2E", "Åby E2E"]);
  });

  it("rien n'a été écrit dans la console", () => {
    expect(session.errors).toEqual([]);
  });
});
