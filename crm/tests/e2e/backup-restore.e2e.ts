import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **La sauvegarde, prise et rendue au clic.**
 *
 * Le chemin réel passe par deux gestes dans `/reglages` : télécharger, puis
 * choisir le fichier et confirmer. Aucun test unitaire ne le couvre — et c'est
 * précisément ce chemin qui, au jalon 109, a été mesuré en train de laisser
 * chaque envoi sans contact.
 *
 * Le test **restaure le fichier qu'il vient de prendre** : la base finit donc
 * exactement dans l'état où elle était, ce qui le rend rejouable et sans effet
 * sur les fichiers qui tournent après lui.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] sauvegarde ignorée : ni Chromium ni E2E_PASSWORD");
}

interface Backup {
  readonly [key: string]: unknown;
}

describeBrowser("la sauvegarde et la restauration, au clic", () => {
  let browser: Browser;
  let session: Session;
  let file = "";

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("télécharge un fichier qui porte l'histoire de prospection", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });

    const link = page.getByRole("link", { name: /Télécharger la sauvegarde/ });
    await link.scrollIntoViewIfNeeded();
    expect(await reachable(link)).toBe(true);

    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    file = path.join(tmpdir(), `e2e-backup-${Date.now()}.json`);
    await download.saveAs(file);

    const payload = JSON.parse(readFileSync(file, "utf8")) as Backup;
    // Les tables dont l'absence a motivé ce jalon.
    for (const key of [
      "emailSends",
      "emailReplies",
      "emailLinkClicks",
      "campaigns",
      "enrollments",
      "departures",
      "outreachEvents",
    ]) {
      expect(payload[key], `le fichier ne porte pas « ${key} »`).toBeDefined();
    }

    /*
      **Aucun secret dans le fichier.** Les mots de passe d'envoi vivent dans
      les variables du service, jamais en base : le vérifier ici, sur le
      fichier réellement téléchargé, est la seule preuve qui vaille.
    */
    const raw = readFileSync(file, "utf8");
    expect(raw).not.toMatch(/"(password|secret|passwd|apiKey)"\s*:/i);
    expect(raw).not.toContain(password);
  }, 120_000);

  /**
   * Le panneau dit **ce qu'une restauration ne rend pas**, avant de cliquer.
   * Une promesse de sauvegarde qu'on ne peut pas lire n'en est pas une.
   */
  it("affiche ce qu'une restauration ne rend pas", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });

    const details = page.locator("[data-not-backed-up]");
    await details.scrollIntoViewIfNeeded();
    expect(await reachable(details)).toBe(true);

    await details.locator("summary").click();
    const text = await details.innerText();
    expect(text).toContain("Logo des emails");
    expect(text).toContain("Conversations du conseil");
  }, 120_000);

  /**
   * Le tour complet : on restaure le fichier qu'on vient de prendre, et on
   * vérifie que le compte rendu nomme le journal des envois. Avant le jalon
   * 110, il n'y avait rien à nommer — la table n'était pas dans le fichier.
   */
  it("restaure au clic, et rend les envois avec leur contact", async () => {
    const { page } = session;
    expect(file, "le téléchargement doit avoir eu lieu").not.toBe("");

    await page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });
    const chooser = page.locator('input[type="file"][accept*="json"]');
    await chooser.setInputFiles(file);

    const restore = page.getByRole("button", { name: "Restaurer" });
    await restore.scrollIntoViewIfNeeded();
    expect(await reachable(restore)).toBe(true);
    await restore.click();

    const confirm = page.getByRole("button", { name: /Confirmer/ });
    await confirm.scrollIntoViewIfNeeded();
    expect(await reachable(confirm)).toBe(true);
    await confirm.click();

    await expect
      .poll(async () => (await page.locator("body").innerText()).includes("Restauration terminée"), {
        timeout: 60_000,
      })
      .toBe(true);

    const report = await page.locator("body").innerText();
    expect(report).toMatch(/\d+ envois/);
    expect(report).toMatch(/\d+ événements/);
    // Rien d'écarté : le fichier vient d'être pris sur cette base même.
    expect(report).not.toContain("Lignes non replacées");
  }, 120_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});
