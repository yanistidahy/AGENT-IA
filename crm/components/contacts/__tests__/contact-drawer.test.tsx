import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CONTACT_COLUMNS, DEFAULT_COLUMNS, LOCKED_COLUMN } from "../contact-table-columns";
import { CONTACT_FILTER_COLUMNS } from "@/lib/api/contact-columns";
import { ContactDrawer } from "../contact-drawer";
import type { ContactRecord } from "@/lib/api/contacts";

/**
 * La fiche contact devait cesser d'être une colonne unique.
 *
 * Ce test porte sur ce qui se voit **sans défiler** et sur l'onglet d'arrivée :
 * ce sont les deux promesses du jalon, et les seules qu'un rendu statique
 * puisse établir.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/contacts",
}));

function contact(overrides: Partial<ContactRecord> = {}): ContactRecord {
  return {
    id: "c1",
    firstName: "Nadia",
    lastName: "Berger",
    title: "Directrice",
    dep: "Marketing",
    email: "nadia@nutrivia.fr",
    phone: "06 11 22 33 44",
    linkedin: "linkedin.com/in/nadia",
    website: "nutrivia.fr",
    lifecycle: "Prospect",
    source: "Salon",
    owner: "Yanis",
    tag: "À rappeler",
    lostReason: "",
    status: "Contacté — en attente",
    statusSetAt: new Date(2026, 7, 1),
    lastActivityAt: new Date(2026, 7, 5),
    notes: "",
    createdAt: new Date(2026, 0, 5),
    lastContact: new Date(2026, 7, 5),
    nextReminder: new Date(2026, 7, 20),
    companyId: "co1",
    company: { id: "co1", name: "Nutrivia" },
    deals: [],
    activityCount: 3,
    followUp: "planned",
    idleDays: 5,
    attempts: 3,
    unanswered: 1,
    lastChannel: "call",
    lastOutcome: "later",
    companySize: "20-50",
    companyIndustry: "Cosmétique",
    ageDays: 217,
    ...overrides,
  };
}

function render(record: ContactRecord): string {
  return renderToStaticMarkup(
    <ContactDrawer
      contact={record}
      linkableDeals={[]}
      sequences={[]}
      alerts={[]}
      owners={["Yanis"]}
      sources={["Salon"]}
      companies={[]}
      tags={[]}
      onClose={() => undefined}
      onChanged={() => undefined}
    />,
  );
}

describe("fiche contact — en-tête fixe", () => {
  it("montre le numéro et l'état sans défiler", () => {
    const html = render(contact());

    // Le bandeau vit hors du conteneur défilant du tiroir : il est rendu avant
    // lui dans le document, ce que cet ordre vérifie.
    const banner = html.indexOf('href="tel:0611223344"');
    const scroller = html.indexOf("overflow-y-auto");
    expect(banner).toBeGreaterThan(-1);
    expect(banner).toBeLessThan(scroller);

    expect(html).toContain("Consigner un échange");
    expect(html).toContain("Contacté — en attente");
    expect(html).toContain("Relance");
  });

  it("dit franchement qu'il n'y a pas de numéro plutôt que d'afficher un tiret", () => {
    const html = render(contact({ phone: "" }));
    expect(html).toContain("Pas de téléphone");
    expect(html).not.toContain('href="tel:');
  });

  it("signale l'absence de relance programmée", () => {
    const html = render(contact({ nextReminder: null }));
    expect(html).toContain("Aucune relance programmée");
  });
});

describe("fiche contact — onglet d'arrivée", () => {
  /**
   * Le choix se fait au premier rendu, pas dans un effet : `renderToStaticMarkup`
   * n'exécute aucun effet, donc ce test échouerait si l'onglet était décidé
   * après coup — ce qui était le cas dans la première version.
   */
  it("ouvre sur l'historique quand il y a quelque chose à lire", () => {
    const html = render(contact({ activityCount: 3 }));
    expect(html).toContain('id="contact-tab-historique" aria-selected="true"');
  });

  it("ouvre sur la fiche quand l'historique est vide", () => {
    const html = render(contact({ activityCount: 0 }));
    expect(html).toContain('id="contact-tab-fiche" aria-selected="true"');
  });

  it("garde les trois onglets, comptés", () => {
    const html = render(contact({ activityCount: 3 }));
    for (const label of ["Fiche", "Historique", "Suivi"]) {
      expect(html, label).toContain(`>${label}`);
    }
  });

  it("replie les champs rares derrière « Plus de détails »", () => {
    const html = render(contact({ activityCount: 0 }));
    expect(html).toContain("Plus de détails");
    // Repliés : le département n'est pas rendu tant qu'on n'a pas ouvert.
    expect(html).not.toContain("Département");
  });
});

describe("colonnes du tableau", () => {
  it("en montre six par défaut, dont le téléphone", () => {
    expect(DEFAULT_COLUMNS).toHaveLength(6);
    expect(DEFAULT_COLUMNS).toEqual([
      "contact",
      "company",
      "status",
      "nextReminder",
      "lastContact",
      "phone",
    ]);
  });

  it("garde des clés uniques — elles servent de mémoire au sélecteur", () => {
    const keys = CONTACT_COLUMNS.map((column) => column.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ne référence que des filtres qui existent", () => {
    for (const column of CONTACT_COLUMNS) {
      if (column.filterKey === null) continue;
      expect(
        CONTACT_FILTER_COLUMNS.some((spec) => spec.key === column.filterKey),
        column.key,
      ).toBe(true);
    }
  });

  it("ne laisse pas retirer le nom des gens", () => {
    expect(DEFAULT_COLUMNS).toContain(LOCKED_COLUMN);
    expect(CONTACT_COLUMNS.some((column) => column.key === LOCKED_COLUMN)).toBe(true);
  });

  it("laisse « Statut saisi » filtrable — c'est ce qui permet d'organiser les relances", () => {
    const status = CONTACT_COLUMNS.find((column) => column.key === "status");
    expect(status?.filterKey).toBe("status");
  });
});
