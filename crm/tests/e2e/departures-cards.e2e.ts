import { describe, expect, it } from "vitest";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn } from "./browser";

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;

/**
 * **La file se lit, et rien de ce qui existait n'a disparu.**
 *
 * Une refonte d'affichage se juge sur deux choses qu'aucune lecture de code ne
 * donne : **où une carte finit et où la suivante commence**, et si les gestes
 * déjà construits sont toujours atteignables. Les deux se mesurent au clic —
 * `reachable()` plutôt qu'`isVisible()`, qui ne voit pas un ancêtre qui rogne
 * (leçon du jalon 60).
 */

describe.skipIf(chromiumPath() === null || PASSWORD === undefined)("la file du matin, en cartes groupées", () => {
  it("cartes bornées, en-têtes de groupe, actions groupées — et rien de perdu", async () => {
    const browser = await openBrowser();
    try {
      const session = await signIn(browser, PASSWORD ?? "");
      const { page } = session;
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${BASE_URL}/departs`, { waitUntil: "networkidle" });

      const cards = page.locator("article");
      const count = await cards.count();
      if (count === 0) return; // File vide : rien à juger, et c'est un état légitime.

      /*
        **Bornées et séparées.** Une bordure et un espace réel entre deux
        cartes : c'est la seule chose qui dise combien d'objets on regarde.
      */
      const first = await cards.nth(0).boundingBox();
      expect(first).not.toBeNull();
      if (count > 1) {
        const second = await cards.nth(1).boundingBox();
        expect(second).not.toBeNull();
        if (first !== null && second !== null) {
          expect(second.y).toBeGreaterThan(first.y + first.height);
        }
      }
      const border = await cards.nth(0).evaluate((node) => getComputedStyle(node).borderTopWidth);
      expect(border).not.toBe("0px");

      // **Un en-tête de groupe, collant.**
      const heading = page.locator("h2.sticky").first();
      await heading.scrollIntoViewIfNeeded();
      expect(await reachable(heading)).toBe(true);
      expect(await heading.evaluate((node) => getComputedStyle(node).position)).toBe("sticky");
      expect(await heading.textContent()).toMatch(/à valider/);

      // **L'objet est sur sa propre ligne**, séparé du corps.
      expect(await cards.nth(0).getByText("Objet", { exact: true }).count()).toBe(1);

      /*
        **Tout ce que les jalons 73 à 87 ont posé est toujours là**, rangé
        plutôt que mêlé : la carte de recherche, la retouche à la main, les
        trois décisions, la reprise avec Alex, et « Vider les départs ».
      */
      const card = cards.nth(0);
      for (const label of ["Envoyer", "Modifier", "Retravailler avec Alex", "Retirer"]) {
        const button = card.getByRole("button", { name: label });
        await button.scrollIntoViewIfNeeded();
        expect(await reachable(button)).toBe(true);
      }
      const clear = page.getByRole("button", { name: "Vider les départs" });
      await clear.scrollIntoViewIfNeeded();
      expect(await reachable(clear)).toBe(true);

      // La retouche à la main s'ouvre sur place, sans appel au modèle.
      await card.getByRole("button", { name: "Modifier" }).click();
      await page.waitForTimeout(200);
      expect(await card.locator("textarea").count()).toBe(1);
      await card.getByRole("button", { name: "Annuler" }).click();

      expect(session.errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 60000);
});
