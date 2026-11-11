import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";
import { BOARD_SORTS, type BoardSort } from "@/lib/domain/campaigns-board";

/**
 * **Jalon 114 : le tri des campagnes, la colonne des invitations acceptées, la
 * phrase de pause, et le compteur sur un téléphone.**
 *
 * Quatre promesses qu'aucun test unitaire ne peut tenir, parce que chacune n'est
 * vraie que *dans un navigateur* :
 *
 * 1. **un en-tête cliqué trie vraiment**, et `aria-sort` suit. Un `sortBoard`
 *    juste derrière un en-tête inerte passerait tous les tests unitaires du
 *    monde ;
 * 2. **« Invitations acceptées » ouvre la liste de ses propres événements**, et
 *    le nombre affiché est la longueur de cette liste — l'invariant du jalon 109
 *    sur une colonne qui n'existait pas hier ;
 * 3. **la phrase de pause dit le compte venu du relevé**, pas un nombre déduit
 *    de ce que le journal a vu partir ;
 * 4. **le compteur est cliquable sans défiler à 390 px**, et reste à côté de
 *    l'entonnoir à 1440. C'est `reachable()` qui l'établit et non `isVisible()` :
 *    un bloc poussé sous la ligne de flottaison est « visible » pour Playwright
 *    et hors de portée du pouce.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] tri des campagnes ignoré : ni Chromium ni E2E_PASSWORD");
}

/**
 * La période de la recette : les quatre derniers mois, calculés à l'exécution.
 *
 * **Jamais de dates écrites en dur.** La base de recette sème ses faits par
 * rapport à maintenant ; une fenêtre fixe aurait la même maladie que la base
 * datée du 5 octobre qu'elle remplace — verte un mois, vide le suivant.
 */
const WINDOW = (() => {
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  return `periode=libre&du=${day(-120)}&au=${day(1)}`;
})();

/** Les colonnes numériques, c'est-à-dire toutes sauf le libellé. */
const NUMERIC: readonly BoardSort[] = BOARD_SORTS.filter((sort) => sort !== "campagne");

/** La valeur brute d'une colonne, ligne par ligne, dans l'ordre affiché. */
async function column(page: Page, sort: BoardSort): Promise<(number | null)[]> {
  const cells = page.locator(`[data-board-cell="${sort}"]`);
  const count = await cells.count();
  const out: (number | null)[] = [];
  for (let index = 0; index < count; index += 1) {
    const raw = await cells.nth(index).getAttribute("data-value");
    out.push(raw === null || raw === "" ? null : Number(raw));
  }
  return out;
}

/** `aria-sort` de l'en-tête d'une colonne. */
function ariaSortOf(page: Page, sort: BoardSort) {
  return page.locator(`th:has([data-board-sort="${sort}"])`).getAttribute("aria-sort");
}

describeBrowser("le tri du tableau des campagnes", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  /**
   * **Chaque colonne numérique, dans les deux sens.** Huit colonnes, deux clics
   * chacune : seize vérifications d'un ordre réel, et seize de `aria-sort`.
   */
  it("trie chaque colonne numérique dans les deux sens, et l'annonce", async () => {
    const { page } = session;
    // On part trié sur le libellé : aucune colonne numérique n'est active, donc
    // le premier clic doit bien produire « décroissant ».
    await page.goto(`${BASE_URL}/pilotage/campagnes?${WINDOW}&tri=campagne&sens=asc`, {
      waitUntil: "domcontentloaded",
    });
    expect(await reachable(page.locator("[data-campaign-board]"))).toBe(true);
    expect(await page.locator("[data-board-line]").count()).toBeGreaterThan(2);

    for (const sort of NUMERIC) {
      const header = page.locator(`[data-board-sort="${sort}"]`);
      await header.scrollIntoViewIfNeeded();
      expect(await reachable(header), `${sort} : en-tête hors de portée`).toBe(true);

      // --- premier clic : décroissant ------------------------------------
      await header.click();
      await page.waitForURL((url) => url.searchParams.get("tri") === sort, { timeout: 15_000 });
      expect(new URL(page.url()).searchParams.get("sens"), sort).toBe("desc");
      expect(await ariaSortOf(page, sort), `${sort} : aria-sort ne suit pas`).toBe("descending");

      const desc = await column(page, sort);
      expect(desc.length, `${sort} : aucune ligne`).toBeGreaterThan(2);
      assertOrdered(desc, "desc", sort);

      // --- second clic sur la même colonne : croissant -------------------
      const again = page.locator(`[data-board-sort="${sort}"]`);
      await again.scrollIntoViewIfNeeded();
      await again.click();
      await page.waitForURL((url) => url.searchParams.get("sens") === "asc", { timeout: 15_000 });
      expect(new URL(page.url()).searchParams.get("tri"), sort).toBe(sort);
      expect(await ariaSortOf(page, sort), `${sort} : aria-sort ne suit pas`).toBe("ascending");

      const asc = await column(page, sort);
      assertOrdered(asc, "asc", sort);

      // Les autres colonnes annoncent qu'elles sont triables et ne le sont pas.
      for (const other of NUMERIC) {
        if (other === sort) continue;
        expect(await ariaSortOf(page, other), `${other} pendant ${sort}`).toBe("none");
      }
    }
  }, 300_000);

  /**
   * **La colonne « Invitations acceptées » ouvre ses propres événements.**
   *
   * Et c'est bien `linkedin_invite_accepted` qu'on y trouve, pas des réponses :
   * une invitation acceptée n'est pas une réponse, et c'est tout le sens de la
   * colonne séparée.
   */
  it("ouvre derrière les invitations acceptées la liste de ces seuls événements", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/campagnes?${WINDOW}&tri=acceptees&sens=desc`, {
      waitUntil: "domcontentloaded",
    });

    /*
      **La campagne de la recette, pas la première ligne venue.** Les
      invitations acceptées des deux autres campagnes semées n'ont pas
      d'identifiant de campagne en base : elles le reçoivent à la lecture, par
      l'attribution du jalon 111. Les compter en base rendrait 0 alors que
      l'écran a raison. Celle-ci porte le sien, donc les deux comptes doivent
      coïncider — c'est ce que l'item 2 du test d'acceptation demande.
    */
    const cell = page.locator(
      '[data-board-line="lemlist:cam_recette_pause"] [data-board-cell="acceptees"]',
    );
    await cell.scrollIntoViewIfNeeded();
    const shown = Number(await cell.getAttribute("data-value"));
    expect(shown, "aucune invitation acceptée dans cette base").toBeGreaterThan(0);

    const link = cell.locator("a");
    expect(await reachable(link)).toBe(true);
    expect(Number((await link.innerText()).trim())).toBe(shown);
    await link.click();
    await page.waitForURL((url) => url.pathname.startsWith("/pilotage/liste"), { timeout: 15_000 });

    const url = new URL(page.url());
    expect(url.searchParams.get("metric")).toBe("invites_accepted");
    expect(url.searchParams.get("campagne")).not.toBeNull();

    // Le nombre affiché est la longueur de la liste, et chaque ligne est bien
    // une invitation acceptée.
    expect(Number(await page.locator("[data-list-count]").innerText())).toBe(shown);
    const rows = page.locator("[data-row]");
    expect(await rows.count()).toBe(shown);
    const types = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-type")),
    );
    expect(new Set(types)).toEqual(new Set(["linkedin_invite_accepted"]));

    /*
      **Et le chiffre est bien celui de la base**, pas seulement celui de sa
      propre liste. Comparer la colonne à la liste qu'elle ouvre prouve la
      cohérence de l'écran avec lui-même ; le compter en base prouve qu'il dit
      la vérité. Le `campagne` de l'URL donne la clé exacte à interroger.
    */
    const key = url.searchParams.get("campagne") ?? "";
    const counted = await prisma.outreachEvent.count({
      where: { type: "linkedin_invite_accepted", extCampaignId: key.replace(/^lemlist:/, "") },
    });
    expect(counted, `${key} en base`).toBe(shown);
  }, 120_000);

  /**
   * **Une campagne en pause dit combien de prospects attendent.**
   *
   * Le nombre vient du relevé (`nbLeads − nbLeadsLaunched`), pas du journal :
   * un événement ne parle que de ce qui est déjà parti, donc par construction il
   * ne peut rien dire de ce qui attend. La recette a semé 12 inscrits et
   * 9 lancés, et l'écran doit écrire 3.
   */
  it("écrit la phrase de pause avec le compte du relevé", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/pilotage/campagnes?${WINDOW}`, {
      waitUntil: "domcontentloaded",
    });

    const notice = page.locator('[data-board-paused="lemlist:cam_recette_pause"]');
    await notice.scrollIntoViewIfNeeded();
    expect(await reachable(notice), "la phrase de pause n'est pas à l'écran").toBe(true);
    expect(await notice.getAttribute("data-waiting")).toBe("3");
    expect((await notice.innerText()).trim()).toBe(
      "Campagne en pause : 3 prospects attendent d'être lancés",
    );

    // Et la puce d'état de cette ligne dit « en pause », relevée et non déduite.
    const line = page.locator('[data-board-line="lemlist:cam_recette_pause"]');
    const chip = line.locator("[data-board-state]");
    expect(await chip.getAttribute("data-board-state")).toBe("paused");
    expect(await chip.getAttribute("data-reported")).toBe("1");

    /*
      **Le relevé gagne sur la déduction.** « Recette large » porte des faits
      dans la période et serait donc « en cours » par le silence de trente
      jours ; lemlist la déclare `ended`, et c'est ce qui s'affiche. Sans cette
      priorité, stocker l'état relevé n'aurait servi à rien.
    */
    const ended = page.locator('[data-board-line="lemlist:cam_recette_large"] [data-board-state]');
    expect(await ended.getAttribute("data-board-state")).toBe("done");
    expect(await ended.getAttribute("data-reported")).toBe("1");

    // Une campagne du CRM n'a pas de relevé : son état reste une déduction, et
    // l'écran le dit au survol plutôt que de les afficher à l'identique.
    const deduced = page.locator('[data-board-line^="crm:"] [data-board-state]').first();
    if ((await deduced.count()) > 0) {
      expect(await deduced.getAttribute("data-reported")).toBe("0");
      expect((await deduced.getAttribute("title")) ?? "").toContain("Déduit");
    }
  }, 120_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});

describeBrowser("le compteur manuel selon la largeur", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  });

  afterAll(async () => {
    await browser?.close();
  });

  /**
   * **390 × 844, et le bouton atteignable au chargement.**
   *
   * La taille est celle d'un iPhone 14. Aucun défilement avant l'assertion :
   * c'est tout l'objet de l'item 4 du test d'acceptation, et `reachable()` le
   * mesure en interrogeant le document au centre du bouton — ce qu'un doigt y
   * toucherait.
   */
  it("met le compteur à portée du pouce sous 768 px, sans défiler", async () => {
    const { page } = session;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/pilotage?${WINDOW}`, { waitUntil: "domcontentloaded" });

    const button = page.locator('[data-manual-add="linkedin_dm"]');
    expect(await button.count(), "le bouton « +1 DM LinkedIn » n'existe pas").toBe(1);
    expect(await reachable(button), "le compteur demande de défiler").toBe(true);

    // Et il reste au-dessus des objectifs : c'est ce que « en haut » veut dire.
    const counterTop = await page
      .locator("[data-manual-counter]")
      .evaluate((node) => node.getBoundingClientRect().top);
    const objectivesTop = await page
      .locator("[data-objective]")
      .first()
      .evaluate((node) => node.getBoundingClientRect().top);
    expect(counterTop).toBeLessThan(objectivesTop);

    /*
      **Cliquable, pas seulement atteignable.** Le bloc demande d'abord qui
      envoie — sur un appareil qui n'a jamais répondu, et le serveur ne connaît
      pas `localStorage`, donc il faut attendre son montage avant de lire son
      état (la course trouvée une fois sur six au jalon 112). On répond, puis on
      clique, et c'est le compte du canal qui dit que le geste a porté.
    */
    await expect
      .poll(async () => (await page.locator("[data-manual-owner-pending]").count()) === 0, {
        timeout: 20_000,
      })
      .toBe(true);
    const ask = page.locator("[data-manual-owner-ask]");
    if ((await ask.count()) > 0) {
      const who = ask.locator("[data-manual-owner]").first();
      expect(await reachable(who), "le choix du propriétaire est hors de portée").toBe(true);
      await who.click();
      await expect.poll(async () => (await ask.count()) === 0, { timeout: 10_000 }).toBe(true);
    }

    // Et le bouton est toujours à portée après que le bloc a tranché : répondre
    // à la question ne doit pas repousser le geste sous la ligne de flottaison.
    expect(await reachable(button), "le compteur demande de défiler après le choix").toBe(true);

    const readout = page.locator('[data-manual-count="linkedin_dm"]');
    const before = Number((await readout.innerText()).trim());
    await button.click();
    await expect
      .poll(async () => Number((await readout.innerText()).trim()), { timeout: 20_000 })
      .toBe(before + 1);
  }, 120_000);

  /**
   * **1440 : la mise en page du bureau ne bouge pas.** Le compteur reste à
   * droite de l'entonnoir, et sous les objectifs — pas au-dessus.
   */
  it("laisse le compteur à côté de l'entonnoir à 1440", async () => {
    const { page } = session;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/pilotage?${WINDOW}`, { waitUntil: "domcontentloaded" });

    const counter = await page
      .locator("[data-manual-counter]")
      .evaluate((node) => node.getBoundingClientRect());
    const funnel = await page
      .locator("[data-funnel]")
      .evaluate((node) => node.getBoundingClientRect());
    const objectives = await page
      .locator("[data-objective]")
      .first()
      .evaluate((node) => node.getBoundingClientRect());

    // À droite de l'entonnoir, et sur la même bande : « à côté », pas « en
    // dessous ».
    expect(counter.left).toBeGreaterThan(funnel.left);
    expect(counter.top).toBeLessThan(funnel.bottom);
    // Et sous les objectifs, comme avant ce jalon.
    expect(counter.top).toBeGreaterThan(objectives.top);
  }, 120_000);

  it("n'a produit aucune erreur de console", () => {
    expect(session.errors).toEqual([]);
  });
});

/**
 * L'ordre d'une colonne, valeurs absentes en fin dans les deux sens.
 *
 * Un `null` veut dire « rien à convertir » : le ramener à zéro le rendrait
 * meilleur qu'un vrai zéro en croissant, et inverser le tri le ferait remonter
 * en tête — la règle du jalon 30.
 */
function assertOrdered(values: readonly (number | null)[], dir: "asc" | "desc", sort: string): void {
  const known = values.filter((value): value is number => value !== null);
  const firstNull = values.indexOf(null);
  if (firstNull !== -1) {
    expect(values.slice(firstNull).every((value) => value === null), `${sort} : un trou`).toBe(true);
  }
  for (let index = 1; index < known.length; index += 1) {
    const previous = known[index - 1] ?? 0;
    const current = known[index] ?? 0;
    if (dir === "desc") {
      expect(previous, `${sort} : ${previous} avant ${current} en décroissant`).toBeGreaterThanOrEqual(
        current,
      );
    } else {
      expect(previous, `${sort} : ${previous} avant ${current} en croissant`).toBeLessThanOrEqual(
        current,
      );
    }
  }
}
