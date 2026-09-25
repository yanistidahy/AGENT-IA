import { describe, expect, it } from "vitest";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn } from "./browser";

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;

/**
 * **La voie se choisit avant tout le reste.**
 *
 * Le jalon 87 a livré le mode manuel, vérifié de bout en bout, et personne ne
 * l'a trouvé : la bascule vivait au fond d'un bloc replié de l'éditeur de
 * séquence, et l'écran de création n'en disait rien. Une lecture de code ne
 * pouvait pas voir cela — le composant était monté, correct, et inatteignable.
 *
 * Ce test clique donc, et il mesure ce qui avait été reproché : **la question
 * est-elle posée en premier, et le formulaire refuse-t-il d'avancer tant que
 * personne n'y a répondu.**
 */

describe.skipIf(chromiumPath() === null || PASSWORD === undefined)("la voie, choisie en premier", () => {
  it("deux voies avant tout champ, et pas de « Créer » tant que rien n'est choisi", async () => {
    const browser = await openBrowser();
    try {
      const session = await signIn(browser, PASSWORD ?? "");
      const { page } = session;
      await page.goto(`${BASE_URL}/campagnes`, { waitUntil: "networkidle" });

      const alex = page.getByRole("button", { name: /Automatique \(Alex\)/ }).first();
      const manual = page.getByRole("button", { name: /^Manuel/ }).first();
      await alex.scrollIntoViewIfNeeded();
      expect(await reachable(alex)).toBe(true);
      expect(await reachable(manual)).toBe(true);

      // Les deux voies disent ce qu'elles font, pas le nom d'un réglage.
      expect(await alex.textContent()).toMatch(/lit le site/);
      expect(await manual.textContent()).toMatch(/\{prenom\}/);

      /*
        **Absent, pas grisé** : un bouton inerte se cherche, un bouton absent ne
        pose pas la question (jalon 26). Et surtout, il ne peut pas créer une
        campagne dont personne n'a choisi la voie.
      */
      expect(await page.getByRole("button", { name: /^Créer$/ }).count()).toBe(0);

      // **Aucun éditeur d'étape avant le choix** — c'est la demande littérale.
      expect(await page.locator("textarea").count()).toBe(0);

      await manual.click();
      await page.waitForTimeout(200);
      expect(await page.getByRole("button", { name: /^Créer$/ }).count()).toBe(1);
      expect(await manual.getAttribute("aria-pressed")).toBe("true");
      expect(await alex.getAttribute("aria-pressed")).toBe("false");

      expect(session.errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 60000);
});
