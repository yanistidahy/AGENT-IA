import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Les puces à menu de `/contacts`, exercées au clic.
 *
 * Ce fichier existe à cause d'un défaut précis : « Ajoutés » était rendue dans
 * le groupe segmenté `overflow-hidden` de la seconde rangée, donc invisible par
 * défaut **et**, une fois la rangée dépliée, son panneau était entièrement
 * rogné. Le bouton répondait — `aria-expanded` passait à `true` — et l'écran ne
 * montrait rien.
 *
 * Les assertions portent donc sur ce qui manquait :
 * la puce est **atteignable sans rien déplier**, le panneau ouvert est
 * **atteignable** (et pas seulement présent), et le choix **arrive dans l'URL**.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

describe.skipIf(skip)("les puces à menu de /contacts", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  const chip = (name: RegExp) => session.page.locator("button", { hasText: name }).first();

  it("« Ajoutés » se voit sans avoir à déplier quoi que ce soit", async () => {
    await session.page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded" });
    await session.page.waitForSelector("table, [data-empty]", { timeout: 15_000 });

    const added = chip(/^Ajoutés/);
    expect(await added.count()).toBe(1);
    // Le défaut du jalon 59 tenait ici : la puce existait dans le DOM et
    // n'était pas à l'écran.
    expect(await reachable(added)).toBe(true);
  });

  it("son menu s'ouvre et il est réellement à l'écran", async () => {
    const added = chip(/^Ajoutés/);
    await added.click();

    expect(await added.getAttribute("aria-expanded")).toBe("true");
    const menu = session.page.locator('[role="menu"]').first();
    // `isVisible()` ne suffit pas : c'est ce qu'il répondait sur le panneau
    // rogné. Voir `reachable` dans browser.ts.
    expect(await reachable(menu)).toBe(true);

    const entries = await session.page.locator('[role="menuitemradio"]').allTextContents();
    expect(entries.some((entry) => entry.includes("Ajoutés cette semaine"))).toBe(true);
  });

  it("un préréglage arrive dans l'URL et filtre la liste", async () => {
    await session.page.getByRole("menuitemradio", { name: "Ajoutés cette semaine" }).click();
    await session.page.waitForURL(/ajout=semaine/, { timeout: 15_000 });

    expect(new URL(session.page.url()).searchParams.get("ajout")).toBe("semaine");
    // La puce dit ce qu'elle cache : une fois active, elle porte son libellé.
    expect(await chip(/cette semaine/).count()).toBe(1);
  });

  it("la plage libre part au clic sur « Appliquer la plage »", async () => {
    await session.page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded" });
    await session.page.waitForSelector("table, [data-empty]", { timeout: 15_000 });

    await chip(/^Ajoutés/).click();
    await session.page.getByLabel("Ajoutés depuis le").fill("2026-03-01");
    await session.page.getByLabel("Ajoutés jusqu'au").fill("2026-03-31");

    const apply = session.page.getByRole("button", { name: "Appliquer la plage" });
    expect(await reachable(apply)).toBe(true);
    await apply.click();

    await session.page.waitForURL(/du=2026-03-01/, { timeout: 15_000 });
    const params = new URL(session.page.url()).searchParams;
    expect(params.get("du")).toBe("2026-03-01");
    expect(params.get("au")).toBe("2026-03-31");
    // Un préréglage et une plage ne cohabitent pas.
    expect(params.get("ajout")).toBeNull();
  });

  it("la puce Instagram s'ouvre elle aussi, et sur la même rangée", async () => {
    await session.page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded" });
    await session.page.waitForSelector("table, [data-empty]", { timeout: 15_000 });

    const instagram = chip(/^Instagram/);
    expect(await reachable(instagram)).toBe(true);
    await instagram.click();
    expect(await reachable(session.page.locator('[role="menu"]').first())).toBe(true);
  });

  it("rien n'a été écrit dans la console pendant le parcours", () => {
    expect(session.errors).toEqual([]);
  });
});
