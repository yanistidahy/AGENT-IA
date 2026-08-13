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
/**
 * `renderToStaticMarkup` ne monte pas de routeur : un composant client qui en
 * demande un lève « invariant expected app router to be mounted ». On le fournit
 * plutôt que d'appauvrir le composant — la file d'action a besoin de rafraîchir
 * la page après une écriture, c'est le comportement voulu.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

const empty = () => Promise.resolve([]);

/** Ancienneté de la dernière sauvegarde réussie, en heures. `null` = aucune. */
let backupAgeHours: number | null = null;
const aggregate = () => Promise.resolve({ _sum: { amount: null } });

vi.mock("@/lib/db", () => ({
  prisma: {
    stage: { count: () => Promise.resolve(counts.stage), findMany: empty },
    company: { count: () => Promise.resolve(counts.company), findMany: empty },
    contact: {
      count: () => Promise.resolve(counts.contact),
      findMany: empty,
      groupBy: empty,
    },
    deal: { count: () => Promise.resolve(counts.deal), findMany: empty, aggregate },
    activity: {
      count: () => Promise.resolve(counts.activity),
      findMany: empty,
      groupBy: empty,
    },
    task: { count: () => Promise.resolve(counts.task), findMany: empty },
    sequence: { count: () => Promise.resolve(counts.sequence), findMany: empty },
    settingsList: { findMany: empty },
    recommendation: { findMany: empty },
    // Le titre du bloc de recommandations porte le nom réglé de l'agent
    // d'arbitrage : la page lit donc l'identité du conseil.
    agent: { findMany: empty },
    agentPhoto: { findMany: empty },
    // Le bandeau de sauvegarde lit ce journal. `backupAgeHours` pilote son
    // état : `null` = jamais sauvegardé, donc bandeau visible.
    snapshotRun: {
      findFirst: () =>
        Promise.resolve(
          backupAgeHours === null
            ? null
            : { startedAt: new Date(Date.now() - backupAgeHours * 3_600_000) },
        ),
    },
    settings: { findUnique: () => Promise.resolve(null) },
    // L'anneau d'avancement lit les marques du jour et la taille figée de la
    // file. Sans ces deux mocks, `readQueueProgress` retombait sur son chemin
    // d'erreur et le test validait le repli au lieu du comportement.
    queueMark: { count: () => Promise.resolve(2), createMany: empty, deleteMany: empty },
    queueDay: {
      findUnique: () => Promise.resolve({ day: "", planned: 5, createdAt: new Date() }),
      create: empty,
      update: empty,
    },
  },
}));

async function renderHome(): Promise<string> {
  const { default: HomePage } = await import("../page");
  return renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({}) }));
}

describe("centre de pilotage", () => {
  /**
   * L'écran suit l'état de la base. Sans affaire, trois cartes de revenu à 0 €
   * n'apprennent rien : elles cèdent la place aux indicateurs de prospection, et
   * le bloc « Affaires en sommeil » disparaît au lieu d'afficher un vide.
   */
  it("sans affaire, montre la prospection et pas le revenu", async () => {
    const html = await renderHome();

    expect(html).toContain("Contactés cette semaine");
    expect(html).toContain("Taux de réponse");
    expect(html).toContain("Jamais contactés");
    expect(html).not.toContain("Affaires en sommeil");
    expect(html).not.toContain("en pipeline pondéré");
  });

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

  it("rend les blocs du centre de pilotage", async () => {
    const html = await renderHome();

    for (const block of [
      "À traiter maintenant",
      "Ma semaine",
      "dernière touche",
      "Relances à venir",
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
    // Les comptes sont **rendus** ensuite : ce mock est partagé par tout le
    // fichier, et le laisser à zéro faisait sortir la page par son retour
    // anticipé « base vide » dans chaque test écrit après celui-ci.
    const original = { ...counts };
    try {
      for (const key of Object.keys(counts)) {
        counts[key as keyof typeof counts] = 0;
      }
      vi.resetModules();
      const html = await renderHome();

      expect(html).toContain("Base de données connectée");
      expect(html).toMatch(/elle est vide/);
      expect(html).toMatch(/db:seed/);
    } finally {
      Object.assign(counts, original);
    }
  });
});

/**
 * Le bandeau de sauvegarde périmée.
 *
 * Il existe parce qu'une sauvegarde qui échoue en silence ne vaut rien : le
 * seul moment où l'on s'en aperçoit est celui où l'on en a besoin.
 */
describe("bandeau de sauvegarde", () => {
  it("alerte quand aucune sauvegarde n'a jamais réussi", async () => {
    backupAgeHours = null;
    vi.resetModules();
    const html = await renderHome();
    expect(html).toContain("Sauvegarde en retard");
    expect(html).toContain("aucune sauvegarde");
  });

  it("alerte au-delà de 48 h, en disant depuis quand", async () => {
    backupAgeHours = 72;
    vi.resetModules();
    const html = await renderHome();
    expect(html).toContain("Sauvegarde en retard");
    expect(html).toContain("il y a 3 jours");
  });

  it("se tait quand la sauvegarde de la nuit est passée", async () => {
    backupAgeHours = 10;
    vi.resetModules();
    const html = await renderHome();
    expect(html).not.toContain("Sauvegarde en retard");
    backupAgeHours = null;
  });
});

/**
 * Le tableau de bord refondu.
 *
 * Trois choses doivent tenir ensemble et venir de la base : l'entonnoir, qui est
 * l'ancre visuelle ; l'anneau, qui mesure la journée ; et les cartes, qui
 * doivent enseigner plutôt qu'afficher un tiret.
 */
describe("cockpit", () => {
  beforeEach(() => {
    backupAgeHours = 10;
    vi.resetModules();
  });

  it("dessine l'entonnoir avec les nombres de la base", async () => {
    const html = await renderHome();

    expect(html).toContain("Entonnoir de prospection");
    // `contact.count` renvoie 18, `deal.count` 24 : les bandes portent ces
    // valeurs, pas une illustration.
    expect(html).toContain("18 contacts");
    expect(html).toContain("24 affaires");
  });

  it("mène chaque bande vers sa vue filtrée", async () => {
    const html = await renderHome();

    for (const href of [
      "/contacts?lifecycle=all&amp;followUp=contacted",
      "/contacts?lifecycle=all&amp;followUp=recent",
      "/contacts?lifecycle=all&amp;followUp=answered",
      "/affaires?status=all",
    ]) {
      expect(html, href).toContain(href);
    }
  });

  it("montre l'anneau et son libellé accessible", async () => {
    const html = await renderHome();

    // L'apostrophe est échappée par le rendu : on cherche ce que le navigateur
    // recevra, pas ce que la source contient.
    expect(html).toContain("Traité aujourd&#x27;hui");
    // Deux marques posées aujourd'hui, aucune ligne restante dans ce jeu vide :
    // la file est terminée, et l'écran doit le dire au lieu de hausser les épaules.
    expect(html).toContain("élément(s) traité(s)");
  });

  it("explique une carte vide au lieu d'afficher un tiret muet", async () => {
    const html = await renderHome();

    expect(html).toContain("Taux de réponse");
    expect(html).toContain("renseignez le résultat de vos échanges");
  });

  it("annonce ce que demain apporte quand la file est vide", async () => {
    const html = await renderHome();
    expect(html).toContain("demain");
  });
});
