import { chromium, type Browser, type Locator, type Page } from "playwright-core";

/**
 * Le socle des tests de navigateur.
 *
 * ## Pourquoi ils existent
 *
 * La suite Vitest n'a pas de DOM : elle vérifie des services, des fonctions
 * pures et du rendu serveur. Deux fois de suite, un contrôle a été livré qui
 * **rendait correctement et ne faisait rien** — la puce « Ajoutés » du jalon 59,
 * rognée par un conteneur `overflow-hidden`, et le rafraîchissement de la file
 * des départs du jalon 56. Aucun test ne pouvait les attraper, parce que rien
 * n'ouvrait la page dans un navigateur.
 *
 * Ces tests-là ne remplacent pas la suite : ils couvrent la seule chose qu'elle
 * ne sait pas voir, **un geste réel sur un écran réel**.
 *
 * ## `playwright-core`, pas `playwright`
 *
 * Le paquet `playwright` télécharge un navigateur à l'installation ;
 * `playwright-core` non. La chaîne de déploiement exécute `npm ci` : elle ne
 * doit pas se mettre à télécharger cent mégaoctets de Chromium pour construire
 * une application Next. Le binaire est celui de l'environnement, désigné par
 * `PLAYWRIGHT_BROWSERS_PATH` ou `E2E_CHROMIUM`.
 *
 * ## Absent, on saute — jamais on n'échoue
 *
 * Sans navigateur, `describeBrowser` **ignore** la suite en le disant. Un test
 * rouge sur une machine sans Chromium apprendrait aux gens à ignorer le rouge.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** Le chemin du binaire Chromium, ou `null` si l'environnement n'en a pas. */
export function chromiumPath(): string | null {
  const explicit = process.env.E2E_CHROMIUM;
  if (explicit !== undefined && existsSync(explicit)) return explicit;

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root === undefined || !existsSync(root)) return null;

  // Les dossiers portent leur révision (`chromium-1194`) : on ne peut pas
  // écrire le chemin en dur sans qu'il devienne faux à la mise à jour suivante.
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith("chromium")) continue;
    for (const binary of ["chrome", "headless_shell"]) {
      const candidate = path.join(root, entry, "chrome-linux", binary);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3399";

export async function openBrowser(): Promise<Browser> {
  const executablePath = chromiumPath();
  if (executablePath === null) throw new Error("aucun Chromium disponible");
  return chromium.launch({ executablePath });
}

export interface Session {
  readonly page: Page;
  /** Toute erreur de console et toute exception non rattrapée de la page. */
  readonly errors: string[];
}

/**
 * Une page connectée à l'espace de travail.
 *
 * Le mot de passe passe par la route de connexion réelle : poser le cookie à la
 * main sauterait le middleware, c'est-à-dire précisément la couche dont les
 * jalons 9 et 52 ont montré qu'elle décide de ce qu'on voit.
 */
export async function signIn(browser: Browser, password: string): Promise<Session> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`exception : ${error.message}`));

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  return { page, errors };
}

/**
 * **L'assertion qui manquait.**
 *
 * `isVisible()` de Playwright ne regarde que l'élément : ni `display`, ni
 * `visibility`, ni une boîte nulle — mais **pas** un ancêtre qui le rogne. Un
 * panneau posé en `absolute` sous un bouton, à l'intérieur d'un conteneur
 * `overflow-hidden`, est donc « visible » pour Playwright et invisible pour un
 * humain. C'est exactement le défaut du jalon 59, et un test écrit avec
 * `isVisible()` l'aurait déclaré vert.
 *
 * On interroge donc le document au centre de l'élément : ce que le navigateur
 * y trouve est ce qu'un doigt y toucherait. Un contenu rogné n'est pas
 * atteignable, et l'appel rend alors ce qui se trouve derrière.
 */
export async function reachable(locator: Locator): Promise<boolean> {
  const handle = await locator.elementHandle();
  if (handle === null) return false;
  return handle.evaluate((element) => {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return false;
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
    const found = document.elementFromPoint(x, y);
    return found !== null && (element === found || element.contains(found));
  });
}
