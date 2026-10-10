import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser } from "playwright-core";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **L'export de contacts, cliqué puis relu.**
 *
 * Deux choses qu'aucun test unitaire ne peut voir, et c'est pour elles que ce
 * fichier existe :
 *
 * 1. **le bouton est atteignable** — `reachable()`, jamais `isVisible()` : la
 *    seconde ne voit pas un ancêtre qui rogne, et c'est exactement le défaut du
 *    jalon 60 ;
 * 2. **le fichier téléchargé est celui de l'écran** — le compte affiché en tête
 *    de `/contacts` et le nombre de lignes du CSV sont lus au même instant, avec
 *    le même filtre. C'est l'invariant du jalon 108, et il ne se vérifie qu'en
 *    comparant l'écran au fichier.
 */

const password = process.env.E2E_PASSWORD ?? "";
const available = chromiumPath() !== null && password !== "";
const describeBrowser = available ? describe : describe.skip;

if (!available) {
  console.warn("[e2e] export de contacts ignoré : ni Chromium ni E2E_PASSWORD");
}

interface Downloaded {
  readonly header: readonly string[];
  readonly rows: readonly Record<string, string>[];
  readonly raw: Buffer;
}

/** Découpage CSV point-virgule, guillemets compris — comme Excel le lit. */
function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ";") {
      row.push(cell);
      cell = "";
    } else if (char === "\r") continue;
    else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

describeBrowser("l'export des contacts, au clic", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    browser = await openBrowser();
    session = await signIn(browser, password);
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Clique « Exporter », attend le téléchargement, et relit le fichier. */
  async function download(query: string): Promise<Downloaded> {
    const { page } = session;
    await page.goto(`${BASE_URL}/contacts${query}`, { waitUntil: "domcontentloaded" });

    const button = page.getByRole("link", { name: /Exporter/i });
    await button.waitFor({ state: "attached", timeout: 15_000 });
    // L'assertion qui compte : atteignable, pas « visible ».
    expect(await reachable(button), "le bouton Exporter est atteignable").toBe(true);

    const [event] = await Promise.all([page.waitForEvent("download"), button.click()]);
    const file = path.join(tmpdir(), `e2e-export-${Date.now()}.csv`);
    await event.saveAs(file);

    const raw = readFileSync(file);
    const grid = parse(raw.toString("utf8").replace(/^﻿/, ""));
    const header = grid[0] ?? [];
    return {
      header,
      rows: grid.slice(1).map((row) => Object.fromEntries(header.map((key, at) => [key, row[at] ?? ""]))),
      raw,
    };
  }

  /** Le compte que l'écran affiche en tête de la liste. */
  async function shownCount(): Promise<number> {
    const text = (await session.page.locator("header p").first().innerText()) ?? "";
    return Number(/(\d+)\s+contacts/.exec(text)?.[1] ?? "-1");
  }

  it("exporte exactement les lignes affichées, sans filtre", async () => {
    const file = await download("?lifecycle=all");
    const shown = await shownCount();

    expect(shown).toBeGreaterThan(0);
    expect(file.rows).toHaveLength(shown);
    expect(session.errors).toEqual([]);
  }, 90_000);

  it("sous « Jamais contacté », le fichier est la liste de l'écran", async () => {
    const file = await download("?followUp=never&lifecycle=all");
    const shown = await shownCount();

    expect(file.rows).toHaveLength(shown);
    // Aucune de ces fiches n'a répondu : c'est le sens de la puce.
    for (const row of file.rows) {
      expect(row["A répondu"], row["Email"]).toBe("non");
      expect(row["Statut de relance"], row["Email"]).toBe("Jamais contacté");
    }
    expect(session.errors).toEqual([]);
  }, 90_000);

  it("le fichier s'ouvre dans Excel français : BOM, point-virgule, accents", async () => {
    const file = await download("?lifecycle=all");

    expect(file.raw.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(file.header).toContain("Étape de séquence");
    expect(file.header).toContain("Moyens de contact disponibles");
    // Une valeur par colonne, sur chaque ligne.
    for (const row of file.rows) expect(Object.keys(row)).toHaveLength(file.header.length);
    // Les accents traversent le téléchargement sans être abîmés.
    expect(file.rows.some((row) => (row["Société"] ?? "").includes("Épicé"))).toBe(true);
  }, 90_000);

  it("une société nommée comme une formule est exportée en texte", async () => {
    const file = await download("?lifecycle=all");
    const hostile = file.rows.find((row) => (row["Société"] ?? "").includes("HYPERLINK"));

    expect(hostile, "la fiche à société hostile est dans l'export").toBeDefined();
    expect((hostile?.["Société"] ?? "").startsWith("=")).toBe(false);
    expect((hostile?.["Société"] ?? "").startsWith("'=")).toBe(true);
  }, 90_000);

  it("le lien de la fiche ouvre bien la fiche, sur l'origine servie", async () => {
    const file = await download("?lifecycle=all");
    const link = file.rows[0]?.["Lien vers la fiche"] ?? "";

    // Le défaut mesuré du jalon 108 : `nextUrl.origin` rendait 0.0.0.0.
    expect(link).not.toContain("0.0.0.0");
    expect(link.startsWith(BASE_URL)).toBe(true);

    // Et le lien ouvre la bonne fiche : le tiroir porte le nom de la ligne.
    const first = file.rows[0];
    const name = `${first?.["Prénom"] ?? ""} ${first?.["Nom"] ?? ""}`.trim();

    await session.page.goto(link, { waitUntil: "domcontentloaded" });
    const title = session.page.locator('aside[role="dialog"] h2').first();
    await title.waitFor({ state: "visible", timeout: 15_000 });
    expect(await reachable(title), "le tiroir de la fiche est atteignable").toBe(true);
    expect(await title.innerText()).toContain(name);
    expect(session.errors).toEqual([]);
  }, 90_000);
});
