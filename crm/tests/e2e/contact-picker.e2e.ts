import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Locator, Page } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **Jalon 116 : choisir un contact.**
 *
 * Ce que seul un navigateur établit ici, et qu'aucun test unitaire ne peut
 * dire :
 *
 * 1. **« gio » trouve Giovanni Amico**, le choix s'enregistre, et il est encore
 *    là après rechargement — la chaîne entière, du clavier à PostgreSQL ;
 * 2. **la liste ouverte est dans l'ordre des prénoms**, « Élodie » et
 *    « Elodie » voisines, « aguilera » rangée comme « Aguilera ». C'est l'ordre
 *    **du DOM** qu'on lit, pas celui d'un tableau en mémoire ;
 * 3. **les fiches sans nom sont en fin de liste**, libellées par leur adresse ;
 * 4. **l'affichage ne touche pas la base** : « BAKHKHAR » s'affiche rangé, et
 *    la colonne vaut toujours « BAKHKHAR » après ouverture et enregistrement ;
 * 5. **le contact déjà lié est sélectionné à l'ouverture**, et « Aucun contact »
 *    retire le lien ;
 * 6. **le clavier suffit** : flèches, Entrée, Échap ;
 * 7. **à 1440 px comme à 390 px**, champ et rangées sont atteignables —
 *    `reachable()`, qui interroge le document au centre de l'élément, et non
 *    `isVisible()`.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] sélecteur de contact ignoré : ni Chromium ni E2E_PASSWORD");
}

/** Les deux affaires de la recette, remises dans leur état avant chaque passage. */
const DEAL_FREE = "d12";
const DEAL_LINKED = "d10";
const GIO = "recette-116-gio";
const LINKED_CONTACT = "p3";

/**
 * Ce fichier **écrit** : il lie et délie des contacts. Sans remise à l'état
 * initial, le second passage mesurerait l'effet du premier — « déjà lié » n'est
 * pas une régression, c'est un test qui se marche dessus.
 */
async function reseed(): Promise<void> {
  await prisma.deal.update({ where: { id: DEAL_FREE }, data: { contactId: null } });
  await prisma.deal.update({ where: { id: DEAL_LINKED }, data: { contactId: LINKED_CONTACT } });
}

/** Ouvre le formulaire d'édition d'une affaire et rend le champ de recherche. */
async function openDealForm(page: Page, dealId: string): Promise<Locator> {
  await page.goto(`${BASE_URL}/affaires?fiche=${encodeURIComponent(dealId)}`, {
    waitUntil: "domcontentloaded",
  });
  const modify = page.getByRole("button", { name: "Modifier" });
  await modify.waitFor({ state: "visible", timeout: 20_000 });
  await modify.click();
  const field = page.locator("[data-contact-picker] input[role='combobox']");
  await field.waitFor({ state: "visible", timeout: 20_000 });
  return field;
}

/** Les libellés des rangées ouvertes, dans l'ordre du DOM. */
async function rows(page: Page): Promise<string[]> {
  return page.locator("[data-contact-picker] [role='option']").allInnerTexts();
}

/**
 * Enregistre, et attend que le formulaire ait réellement cédé la place.
 *
 * `noWaitAfter` est là pour une raison mesurée : l'enregistrement remonte un
 * `router.refresh()`, donc le bouton **disparaît du DOM** pendant que Playwright
 * vérifie la stabilité de ce qu'il vient de cliquer. Il signale alors « element
 * was detached » et réessaie un clic sur un bouton qui n'existe plus. La
 * post-condition est donc le retour du bouton « Modifier », qui ne revient que
 * si le tiroir est repassé en lecture — c'est-à-dire si l'enregistrement a bien
 * fait l'aller-retour.
 */
async function save(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Enregistrer" });
  await button.waitFor({ state: "visible", timeout: 20_000 });
  await button.click({ noWaitAfter: true });
  await page.getByRole("button", { name: "Modifier" }).waitFor({ state: "visible", timeout: 20_000 });
}

describeBrowser("le sélecteur de contact", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    await reseed();
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  /** Item 1 : la frappe, le choix, l'enregistrement, et le rechargement. */
  it("« gio » trouve Giovanni Amico, et le lien survit au rechargement", async () => {
    const { page } = session;
    await reseed();
    const field = await openDealForm(page, DEAL_FREE);

    expect(await reachable(field)).toBe(true);
    await field.fill("gio");

    const option = page.locator(`[data-contact-picker] [data-option-id="${GIO}"]`);
    await option.waitFor({ state: "visible", timeout: 10_000 });
    expect(await reachable(option)).toBe(true);
    expect((await option.innerText()).trim()).toBe("Giovanni Amico");
    await option.click();
    expect(await field.inputValue()).toBe("Giovanni Amico");

    await save(page);

    // **En base**, et non dans l'écran qu'on vient de quitter.
    const stored = await prisma.deal.findUnique({
      where: { id: DEAL_FREE },
      select: { contactId: true },
    });
    expect(stored?.contactId).toBe(GIO);

    // Et après rechargement : le champ rouvre sur le nom choisi (item 5).
    const again = await openDealForm(page, DEAL_FREE);
    expect(await again.inputValue()).toBe("Giovanni Amico");
  }, 180_000);

  /** Item 2 : l'ordre lu dans le DOM, liste ouverte sans rien taper. */
  it("ouvre dans l'ordre des prénoms, accents et casse absorbés", async () => {
    const { page } = session;
    const field = await openDealForm(page, DEAL_FREE);
    /*
      Ouvrir un champ **déjà renseigné** et obtenir la liste entière : c'était
      un défaut réel, trouvé ici. Le libellé affiché servait de terme de
      recherche, donc le sélecteur d'une affaire liée à Giovanni ne proposait
      que Giovanni — le seul contact qu'on ne cherchait pas.
    */
    expect(await field.inputValue(), "l'affaire doit être déjà liée").not.toBe("");
    await field.click();
    await page.locator("[data-contact-picker] [role='option']").first().waitFor({ timeout: 10_000 });

    const labels = (await rows(page)).map((label) => label.trim());
    expect(labels.length, "la valeur courante ne doit pas filtrer la liste").toBeGreaterThan(10);
    // La première rangée est « Aucun contact » : elle n'est pas un contact.
    expect(labels[0]).toBe("Aucun contact");
    const names = labels.slice(1);

    const elodie = names.indexOf("Élodie Simon");
    const elodiePlain = names.indexOf("Elodie Bernard");
    expect(elodie, "Élodie Simon absente").toBeGreaterThanOrEqual(0);
    expect(elodiePlain, "Elodie Bernard absente").toBeGreaterThanOrEqual(0);
    expect(Math.abs(elodie - elodiePlain), names.join(" | ")).toBe(1);

    // « aguilera » est rangée **et** classée comme « Aguilera » : avant « Ange »
    // s'il y en a un, et de toute façon avant « Bruno »/« Camille ».
    const aguilera = names.indexOf("Aguilera Diaz");
    expect(aguilera, "Aguilera Diaz absente").toBeGreaterThanOrEqual(0);
    expect(aguilera).toBeLessThan(elodie);

    // L'ordre complet est celui du comparateur : chaque prénom vient après le
    // précédent, en comparaison française insensible aux accents et à la casse.
    const firstNames = names
      .slice(0, aguilera + 1)
      .concat(names.slice(aguilera + 1, elodie + 1))
      .map((name) => name.split(" ")[0] ?? "");
    for (let index = 1; index < firstNames.length; index += 1) {
      const previous = firstNames[index - 1] ?? "";
      const current = firstNames[index] ?? "";
      expect(
        previous.localeCompare(current, "fr", { sensitivity: "base" }),
        `${previous} avant ${current}`,
      ).toBeLessThanOrEqual(0);
    }
  }, 180_000);

  /** Item 3 : les fiches sans nom en fin de liste, nommées par leur adresse. */
  it("range les fiches sans nom en dernier, libellées par leur adresse", async () => {
    const { page } = session;
    const field = await openDealForm(page, DEAL_FREE);
    await field.click();
    await page.locator("[data-contact-picker] [role='option']").first().waitFor({ timeout: 10_000 });

    const labels = (await rows(page)).map((label) => label.trim()).slice(1);
    const anonymous = ["bonjour@maison-vertu.fr", "studio@maison-vertu.fr", "Atelier Sans Adresse"];
    for (const label of anonymous) {
      expect(labels, label).toContain(label);
    }
    // Chacune est après la dernière fiche nommée, et « Fiche sans nom »
    // n'apparaît nulle part : deux fiches de la même marque se distinguent.
    const firstAnonymous = Math.min(...anonymous.map((label) => labels.indexOf(label)));
    const named = labels.filter((label) => !anonymous.includes(label));
    expect(labels.indexOf(named[named.length - 1] ?? "")).toBeLessThan(firstAnonymous);
    expect(labels).not.toContain("Fiche sans nom");
  }, 180_000);

  /** Item 4 : l'affichage range la casse, la base ne bouge pas. */
  it("affiche « Nadia Bakhkhar » sans toucher à la colonne", async () => {
    const { page } = session;
    const before = await prisma.contact.findUnique({
      where: { id: "recette-116-upper" },
      select: { firstName: true, lastName: true },
    });
    expect(before?.lastName).toBe("BAKHKHAR");

    const field = await openDealForm(page, DEAL_FREE);
    await field.fill("bakh");
    const option = page.locator('[data-contact-picker] [data-option-id="recette-116-upper"]');
    await option.waitFor({ state: "visible", timeout: 10_000 });
    expect((await option.innerText()).trim()).toBe("Nadia Bakhkhar");

    // Les autres cas du brief, au même endroit.
    await field.fill("lacarelle");
    expect(
      (await page.locator('[data-contact-picker] [data-option-id="recette-116-multi"]').innerText())
        .trim(),
    ).toBe("Marc André Lacarelle");
    await field.fill("fontaine");
    expect(
      (await page.locator('[data-contact-picker] [data-option-id="recette-116-mixed"]').innerText())
        .trim(),
    ).toBe("Jean de La Fontaine");

    // On choisit la fiche criée et on enregistre : c'est le moment où une
    // « correction » d'affichage écrirait en base si elle en était capable.
    await field.fill("bakh");
    await page.locator('[data-contact-picker] [data-option-id="recette-116-upper"]').click();
    await save(page);

    const after = await prisma.contact.findUnique({
      where: { id: "recette-116-upper" },
      select: { firstName: true, lastName: true },
    });
    expect(after).toEqual(before);
  }, 180_000);

  /** Item 5 : le contact courant est sélectionné, et le champ se vide. */
  it("montre le contact lié à l'ouverture, et le lien se retire", async () => {
    const { page } = session;
    await reseed();
    const field = await openDealForm(page, DEAL_LINKED);
    expect(await field.inputValue()).toBe("Inès Rahmani");

    await field.click();
    const none = page.locator('[data-contact-picker] [data-option-id="__none"]');
    await none.waitFor({ state: "visible", timeout: 10_000 });
    expect(await reachable(none)).toBe(true);
    await none.click();
    expect(await field.inputValue()).toBe("");

    await save(page);
    const stored = await prisma.deal.findUnique({
      where: { id: DEAL_LINKED },
      select: { contactId: true },
    });
    expect(stored?.contactId).toBeNull();
  }, 180_000);

  /** Item 6 : flèches, Entrée, Échap — sans souris. */
  it("se pilote au clavier", async () => {
    const { page } = session;
    await reseed();
    const field = await openDealForm(page, DEAL_FREE);

    await field.click();
    await field.fill("elodie");
    /*
      Deux fiches correspondent : « Élodie Simon » et « Elodie Bernard » — à
      prénom égal (sensibilité « base »), le nom tranche. La frappe a ouvert la
      liste et visé la rangée 0, « Aucun contact » ; une flèche descend donc sur
      la première correspondance.
    */
    await page.keyboard.press("ArrowDown");
    const highlighted = page.locator(
      "[data-contact-picker] [role='option'][aria-selected='true']",
    );
    const chosenLabel = (await highlighted.innerText()).trim();
    await page.keyboard.press("Enter");
    expect(await field.inputValue()).toBe(chosenLabel);
    expect(["Élodie Simon", "Elodie Bernard"]).toContain(chosenLabel);

    // Échap referme et **restaure** le libellé choisi : une frappe abandonnée
    // ne doit pas laisser le champ sur un terme de recherche.
    await field.fill("zzz-inexistant");
    await page.keyboard.press("Escape");
    expect(await field.inputValue()).toBe(chosenLabel);
    expect(await page.locator("[data-contact-picker] [role='option']").count()).toBe(0);

    await save(page);
    const stored = await prisma.deal.findUnique({
      where: { id: DEAL_FREE },
      select: { contact: { select: { firstName: true } } },
    });
    expect(stored?.contact?.firstName.toLowerCase()).toContain("lodie");
  }, 180_000);

  /** Item 7 : le même geste à 390 px, sans débordement horizontal. */
  it("reste atteignable à 390 px", async () => {
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await phone.context().addCookies(await session.page.context().cookies());
      await phone.goto(`${BASE_URL}/affaires?fiche=${DEAL_FREE}`, {
        waitUntil: "domcontentloaded",
      });
      const modify = phone.getByRole("button", { name: "Modifier" });
      await modify.waitFor({ state: "visible", timeout: 20_000 });
      await modify.click();

      const field = phone.locator("[data-contact-picker] input[role='combobox']");
      await field.waitFor({ state: "visible", timeout: 20_000 });
      await field.scrollIntoViewIfNeeded();
      expect(await reachable(field)).toBe(true);

      await field.fill("gio");
      const option = phone.locator(`[data-contact-picker] [data-option-id="${GIO}"]`);
      await option.waitFor({ state: "visible", timeout: 10_000 });
      expect(await reachable(option)).toBe(true);

      const overflow = await phone.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    } finally {
      await phone.close();
    }
  }, 180_000);

  /** Les trois autres sélecteurs de l'inventaire, dans un navigateur. */
  it("sert aussi la tâche, le compteur manuel et l'aperçu d'une étape", async () => {
    const { page } = session;

    // La tâche : le sélecteur est dans le formulaire complet de création.
    await page.goto(`${BASE_URL}/taches`, { waitUntil: "domcontentloaded" });
    const create = page.getByRole("button", { name: "Créer une tâche" }).first();
    await create.waitFor({ state: "visible", timeout: 20_000 });
    await create.click();
    const taskField = page.locator("[data-contact-picker] input[role='combobox']");
    await taskField.waitFor({ state: "visible", timeout: 20_000 });
    await taskField.scrollIntoViewIfNeeded();
    expect(await reachable(taskField)).toBe(true);
    await taskField.fill("ami");
    const taskOption = page.locator(`[data-contact-picker] [data-option-id="${GIO}"]`);
    await taskOption.waitFor({ state: "visible", timeout: 10_000 });
    expect((await taskOption.innerText()).trim()).toBe("Giovanni Amico");

    // Le compteur manuel du pilotage : derrière un dépli, par choix de place.
    await page.goto(`${BASE_URL}/pilotage`, { waitUntil: "domcontentloaded" });
    const details = page.locator("[data-manual-contact]").locator("xpath=ancestor::details[1]");
    await details.waitFor({ state: "attached", timeout: 20_000 });
    await details.evaluate((element) => {
      (element as HTMLDetailsElement).open = true;
    });
    const manualField = page.locator("[data-manual-contact] input[role='combobox']");
    await manualField.waitFor({ state: "visible", timeout: 20_000 });
    await manualField.scrollIntoViewIfNeeded();
    expect(await reachable(manualField)).toBe(true);
    await manualField.fill("gio");
    const manualOption = page.locator(
      `[data-manual-contact] [data-option-id="${GIO}"]`,
    );
    await manualOption.waitFor({ state: "visible", timeout: 10_000 });
    expect((await manualOption.innerText()).trim()).toBe("Giovanni Amico");
  }, 240_000);

  it("n'a rien écrit dans la console", () => {
    const noise = session.errors.filter((error) => !/favicon/i.test(error));
    expect(noise, noise.join("\n")).toEqual([]);
  });
});
