import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le centre de pilotage doit lire la base, pas réciter un texte.
 *
 * Ce test existe à cause d'une régression réelle : la page avait été écrite au
 * jalon 1 avec la mention « Jalon 1 — Affaires de bout en bout » en dur, et elle
 * annonçait encore ce jalon trois jalons plus tard. Les compteurs, eux,
 * interrogeaient bien Prisma — mais rien ne le prouvait automatiquement.
 *
 * Le principe : on impose des comptes arbitraires au client Prisma, on rend la
 * page, et on vérifie que *ces* nombres apparaissent. Le jour où quelqu'un
 * figerait un chiffre ou un libellé, le test tombe. Éprouvé en figeant
 * volontairement la page.
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
 * Les blocs du tableau de bord lisent eux aussi la base. Ils ne sont pas l'objet
 * de ce test : les collections sont vides, ce qui laisse les compteurs seuls
 * sous observation et exerce au passage tous les états « rien à afficher ».
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
    settingsList: { findMany: empty },
    settings: { findUnique: () => Promise.resolve(null) },
  },
}));

async function renderHome(): Promise<string> {
  const { default: HomePage } = await import("../page");
  return renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({}) }));
}

describe("centre de pilotage", () => {
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

  it("rend les cinq blocs du centre de pilotage", async () => {
    const html = await renderHome();

    for (const block of [
      "À traiter maintenant",
      "dernière touche",
      "Relances à venir",
      "Affaires en sommeil",
      "Activité récente",
    ]) {
      expect(html, `bloc « ${block} »`).toContain(block);
    }
  });

  /**
   * Le seuil affiché vient des réglages, pas d'une constante recopiée : c'est ce
   * qui garantit que changer `coldDays` change ce que l'écran signale.
   */
  it("annonce le seuil de fraîcheur issu des réglages", async () => {
    const { DEFAULT_PILOTAGE } = await import("@/lib/domain/types");
    const html = await renderHome();

    expect(html).toContain(`${DEFAULT_PILOTAGE.coldDays} jours sans contact`);
  });

  it("expose le lien de diagnostic", async () => {
    const html = await renderHome();
    expect(html).toContain('href="/api/health"');
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
