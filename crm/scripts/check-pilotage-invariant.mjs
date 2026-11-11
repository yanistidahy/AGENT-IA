/**
 * **L'invariant du jalon 109, vérifié sur les quatre onglets du pilotage.**
 *
 * Versionné, comme `scripts/mock-lemlist.ts` et pour la même raison : le jalon
 * 113 a écrit ce contrôle dans un fichier jetable, et il a fallu le réécrire au
 * jalon suivant. Un contrôle qui n'existe plus ne prouve plus rien.
 *
 * Usage, contre un serveur debout et une base peuplée :
 *   BASE_URL=http://127.0.0.1:3313 E2E_PASSWORD=… node scripts/check-pilotage-invariant.mjs
 * Rend 0 si tout concorde, 1 et le détail sinon.
 *
 * Pour chaque chiffre cliquable de chaque onglet : le nombre affiché doit être
 * la longueur de la liste qu'il ouvre. Le lien est lu **dans l'élément qui
 * porte le chiffre**, jamais par position dans le document — c'est la correction
 * du jalon 113, où apparier les barres aux liens dans l'ordre du DOM avait
 * produit 89 écarts imaginaires.
 */
import { chromium } from "playwright-core";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

function chromiumPath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root === undefined || !existsSync(root)) return "/opt/pw-browsers/chromium";
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith("chromium")) continue;
    for (const binary of ["chrome", "headless_shell"]) {
      const candidate = path.join(root, entry, "chrome-linux", binary);
      if (existsSync(candidate)) return candidate;
    }
  }
  return "/opt/pw-browsers/chromium";
}

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3313";
const PASSWORD = process.env.E2E_PASSWORD ?? "recette";

/**
 * Des paramètres ajoutés à chaque onglet, par exemple une période libre.
 *
 * Ajouté au jalon 114 : sans eux, le contrôle ne voit que « cette semaine », et
 * une base dont l'histoire est plus large n'est vérifiée qu'au septième. Le
 * passage se relance avec `PARAMS="periode=libre&du=…&au=…"`.
 */
const PARAMS = process.env.PARAMS ?? "";

/** L'URL d'un onglet, avec les paramètres communs ajoutés au bon séparateur. */
function urlOf(tab) {
  if (PARAMS === "") return `${BASE}${tab}`;
  return `${BASE}${tab}${tab.includes("?") ? "&" : "?"}${PARAMS}`;
}

const TABS = ["/pilotage", "/pilotage/temps", "/pilotage/segments", "/pilotage/campagnes"];

/*
  « Dans le temps » porte ses chiffres sur des `<text>` SVG **à côté** de
  l'ancre, pas dedans : les apparier par le texte du lien ne verrait rien. On
  lit donc `data-total` et `data-value`, et on balaie les trois granularités et
  les deux vues — c'est là que la cible et les séries par canal changent.
*/
const TIME_VIEWS = [];
for (const pas of ["jour", "semaine", "mois"]) {
  for (const vue of ["total", "canal"]) {
    for (const metric of ["messages", "replies"]) {
      TIME_VIEWS.push(`/pilotage/temps?pas=${pas}&vue=${vue}&metric=${metric}`);
    }
  }
}

const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
const page = await browser.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

const pairs = [];
for (const tab of TABS) {
  await page.goto(urlOf(tab), { waitUntil: "domcontentloaded" });

  // 1. Toute ancre vers la liste dont le texte est un entier pur.
  const plain = await page.$$eval('a[href*="/pilotage/liste"]', (nodes) =>
    nodes
      .map((node) => ({ href: node.getAttribute("href") ?? "", text: (node.textContent ?? "").trim() }))
      .filter((entry) => /^\d+$/.test(entry.text))
      .map((entry) => ({ href: entry.href, shown: Number(entry.text) })),
  );

  // 2. Les marches d'entonnoir : le nombre est dans `data-count`, et le lien
  //    est l'ancre de la marche. Les lire par attribut évite de dépendre de la
  //    mise en forme du libellé.
  const staged = await page.$$eval("[data-count]", (nodes) =>
    nodes
      .map((node) => {
        const link = node.matches("a") ? node : node.querySelector("a[href]") ?? node.closest("a[href]");
        const href = link?.getAttribute("href") ?? "";
        return { href, shown: Number(node.getAttribute("data-count")) };
      })
      .filter((entry) => entry.href.includes("/pilotage/liste") && Number.isFinite(entry.shown)),
  );

  for (const entry of [...plain, ...staged]) pairs.push({ tab, ...entry });
}

for (const url of TIME_VIEWS) {
  await page.goto(urlOf(url), { waitUntil: "domcontentloaded" });
  const marks = await page.$$eval("[data-total], [data-value]", (nodes) =>
    nodes
      .map((node) => {
        const raw = node.getAttribute("data-total") ?? node.getAttribute("data-value") ?? "";
        const link = node.matches("a") ? node : node.querySelector("a[href]") ?? node.closest("a[href]");
        return { href: link?.getAttribute("href") ?? "", shown: Number(raw) };
      })
      .filter((entry) => entry.href.includes("/pilotage/liste") && Number.isFinite(entry.shown)),
  );
  for (const entry of marks) pairs.push({ tab: url, ...entry });
}

// Déduplication : deux chiffres identiques derrière le même lien ne se
// vérifient qu'une fois.
const seen = new Set();
const unique = pairs.filter((entry) => {
  const key = `${entry.href}|${entry.shown}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const bad = [];
for (const entry of unique) {
  await page.goto(`${BASE}${entry.href}`, { waitUntil: "domcontentloaded" });
  const announced = Number(await page.locator("[data-list-count]").first().innerText());
  const rows = await page.locator("[data-row]").count();
  if (announced !== entry.shown || rows !== entry.shown) {
    bad.push({ ...entry, announced, rows });
  }
}

console.log(
  JSON.stringify(
    {
      chiffres_verifies: unique.length,
      par_onglet: [...TABS, ...TIME_VIEWS].map((tab) => ({
        tab,
        n: unique.filter((e) => e.tab === tab).length,
      })),
      ecarts: bad.length,
      detail: bad.slice(0, 10),
    },
    null,
    2,
  ),
);

await browser.close();
process.exit(bad.length === 0 ? 0 : 1);
