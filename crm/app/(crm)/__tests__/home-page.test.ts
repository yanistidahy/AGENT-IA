import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La page d'accueil doit lire la base, pas réciter un texte.
 *
 * Ce test existe à cause d'une régression réelle : la page avait été écrite au
 * jalon 1 avec la mention « Jalon 1 — Affaires de bout en bout » en dur, et elle
 * annonçait encore ce jalon trois jalons plus tard. Les compteurs, eux,
 * interrogeaient bien Prisma — mais rien ne le prouvait automatiquement.
 *
 * Le principe : on impose des comptes arbitraires au client Prisma, on rend la
 * page, et on vérifie que *ces* nombres apparaissent. Un jour où quelqu'un
 * figerait un chiffre ou un libellé, le test tombe.
 */

const counts = {
  stage: 6,
  company: 12,
  contact: 18,
  deal: 24,
  activity: 32,
  task: 16,
  sequence: 3,
};

/**
 * Le moteur d'alertes lit lui aussi la base. Il n'est pas l'objet du test :
 * les listes sont vides, ce qui produit « rien à traiter » et laisse les
 * compteurs seuls sous observation.
 */
const empty = () => Promise.resolve([]);

vi.mock("@/lib/db", () => ({
  prisma: {
    stage: { count: () => Promise.resolve(counts.stage), findMany: empty },
    company: { count: () => Promise.resolve(counts.company), findMany: empty },
    contact: { count: () => Promise.resolve(counts.contact), findMany: empty },
    deal: { count: () => Promise.resolve(counts.deal), findMany: empty },
    activity: { count: () => Promise.resolve(counts.activity), findMany: empty },
    task: { count: () => Promise.resolve(counts.task), findMany: empty },
    sequence: { count: () => Promise.resolve(counts.sequence), findMany: empty },
    settings: { findUnique: () => Promise.resolve(null) },
  },
}));

async function renderHome(): Promise<string> {
  const { default: HomePage } = await import("../page");
  return renderToStaticMarkup(await HomePage());
}

describe("page d'accueil", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("affiche les sept compteurs tels que la base les renvoie", async () => {
    const html = await renderHome();

    for (const [table, value] of Object.entries(counts)) {
      expect(html, `compteur ${table}`).toContain(`>${value}</dd>`);
    }
  });

  it("suit la base quand les comptes changent, au lieu de rester figée", async () => {
    const before = await renderHome();
    expect(before).toContain(">24</dd>"); // affaires

    counts.deal = 99;
    vi.resetModules();
    const after = await renderHome();

    expect(after).toContain(">99</dd>");
    expect(after).not.toContain(">24</dd>");
    counts.deal = 24;
  });

  it("nomme les sept tables attendues", async () => {
    const html = await renderHome();

    for (const label of [
      "étapes",
      "sociétés",
      "contacts",
      "affaires",
      "interactions",
      "tâches",
      "séquences",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("ne mentionne aucun numéro de jalon", async () => {
    const html = await renderHome();
    expect(html).not.toMatch(/jalon/i);
    expect(html).not.toMatch(/phase\s*\d/i);
  });

  /**
   * Les cartes sont comparées à `lib/navigation.ts`, pas à une liste écrite ici :
   * livrer un écran ne doit demander qu'une seule modification, et ce test le
   * vérifie au lieu d'être la seconde.
   */
  it("propose exactement les écrans déclarés comme livrés", async () => {
    const { shippedEntries } = await import("@/lib/navigation");
    const html = await renderHome();

    const rendered = [...html.matchAll(/href="(\/[a-z-]*)"/g)].map((match) => match[1]);
    const expected = shippedEntries().map((entry) => entry.href);

    expect(new Set(rendered)).toEqual(new Set(expected));
    expect(expected.length).toBeGreaterThan(0);
  });

  it("n'affiche pas de carte pour un écran non livré", async () => {
    const { NAV_GROUPS } = await import("@/lib/navigation");
    const html = await renderHome();

    const pending = NAV_GROUPS.flatMap((group) => group.entries).filter(
      (entry) => entry.href === null,
    );
    for (const entry of pending) {
      expect(html, `écran non livré : ${entry.label}`).not.toContain(entry.desc);
    }
  });

  it("dit franchement qu'une base vide est vide, sans le déguiser en panne", async () => {
    for (const key of Object.keys(counts)) {
      counts[key as keyof typeof counts] = 0;
    }
    vi.resetModules();
    const html = await renderHome();

    expect(html).toContain("Base de données connectée");
    expect(html).toMatch(/elle est vide/);
    expect(html).toMatch(/db:seed/);
  });
});
