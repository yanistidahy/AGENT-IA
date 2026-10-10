import { describe, expect, it } from "vitest";
import { CONTACT_COLUMNS, mapHeaders, parseGrid } from "../../domain/csv";
import { DERIVED_HEADERS, IMPORT_HEADERS } from "../../domain/contact-export";
import type { ContactExportExtra } from "../contact-export";
import type { ContactRecord } from "../contacts";
import { contactsToCsv } from "../csv-export";

const contact: ContactRecord = {
  id: "c1",
  firstName: "Marie",
  lastName: "Durand",
  title: "DAF",
  website: "",
  instagram: "@maison_durand",
  alexNote: "",
  contactGroup: "autre",
  groupSetBy: "none",
  dmAt: null,
  attempts: 0,
  unanswered: 0,
  lastChannel: null,
  lastOutcome: "",
  companySize: "",
  companyIndustry: "",
  ageDays: 0,
  dep: "Finance",
  email: "marie@acme.fr",
  phone: "06 12 34 56 78",
  linkedin: "",
  lifecycle: "Client",
  source: "Recommandation",
  owner: "Yanis",
  tag: "",
  lostReason: "",
  status: "",
  statusSetAt: null,
  lastActivityAt: null,
  notes: "Premier appel\nÀ relancer en mars",
  createdAt: new Date("2026-01-05T10:00:00Z"),
  lastContact: new Date("2026-02-11T09:00:00Z"),
  nextReminder: null,
  companyId: "co1",
  company: { id: "co1", name: "ACME;SA" },
  deals: [],
  activityCount: 3,
  followUp: "waiting",
  idleDays: 9,
  emailCount: 0,
  lastEmailAt: null,
};

const EXTRA: ContactExportExtra = {
  campaign: "",
  lastStep: 0,
  totalSteps: 0,
  replied: false,
  hot: false,
};

const context = (extra: Partial<ContactExportExtra> = {}) => ({
  origin: "https://crm.auraflowai.fr",
  extras: new Map([["c1", { ...EXTRA, ...extra }]]),
});

const gridOf = (extra: Partial<ContactExportExtra> = {}) =>
  parseGrid(contactsToCsv([contact], context(extra)));

const valueOf = (column: string, extra: Partial<ContactExportExtra> = {}) => {
  const grid = gridOf(extra);
  return grid[1]?.[(grid[0] ?? []).indexOf(column)];
};

describe("contactsToCsv", () => {
  it("écrit des en-têtes de saisie que l'import sait relire", () => {
    const header = parseGrid(contactsToCsv([contact], context()))[0] ?? [];
    const mapping = mapHeaders(header.slice(0, IMPORT_HEADERS.length));

    // Les quinze premières colonnes font l'aller-retour : un export réimporté
    // écrit toujours les mêmes champs, et aucune n'est perdue au retour.
    expect(mapping.ignored).toEqual([]);
    expect([...Object.keys(mapping.columns)].sort()).toEqual([...CONTACT_COLUMNS].sort());
  });

  it("les colonnes dérivées sont déclarées comme ignorées, jamais mêlées aux autres", () => {
    const header = parseGrid(contactsToCsv([contact], context()))[0] ?? [];
    const mapping = mapHeaders(header);

    // La promesse se déplace plutôt que de disparaître : ce que l'import ne lit
    // pas est exactement le second bloc, ni plus ni moins.
    expect([...mapping.ignored].sort()).toEqual([...DERIVED_HEADERS].sort());
  });

  it("aucun libellé dérivé ne se fait relire comme une colonne de saisie", () => {
    // Le piège qui a décidé des libellés : `statut` et `etape` sont tous deux
    // des alias de `lifecycle`. Une colonne « Statut » aurait été relue comme un
    // cycle de vie, et un réimport aurait écrit un statut de relance dedans.
    for (const label of DERIVED_HEADERS) {
      expect(mapHeaders([label, label]).ignored, label).toEqual([label, label]);
    }
  });

  it("fait l'aller-retour sur une société contenant le séparateur", () => {
    expect(valueOf("Société")).toBe("ACME;SA");
  });

  it("fait l'aller-retour sur des notes multilignes", () => {
    expect(valueOf("Notes")).toBe("Premier appel\nÀ relancer en mars");
  });

  it("écrit les dates en JJ/MM/AAAA et les dates absentes en cellule vide", () => {
    // Le format qu'Excel français lit comme une date : en ISO, il affiche du
    // texte, donc on ne peut ni trier ni filtrer par mois. L'import accepte les
    // deux depuis le jalon 3, le réimport n'en souffre pas.
    expect(valueOf("Dernier contact")).toBe("11/02/2026");
    expect(valueOf("Prochaine relance")).toBe("");
  });

  it("porte le statut affiché, pas un libellé recomposé", () => {
    // `followUp: waiting` sur un cycle non terminal : le même libellé que la
    // colonne Statut de /contacts.
    expect(valueOf("Statut de relance")).toBe("En attente");
  });

  it("dit les moyens de contact disponibles, et nomme l'absence", () => {
    expect(valueOf("Moyens de contact disponibles")).toBe("Email · Téléphone · Instagram");
  });

  it("rend une seule valeur par colonne dérivée", () => {
    const grid = gridOf({ campaign: "SAV septembre", lastStep: 2, totalSteps: 3, replied: true, hot: true });
    const header = grid[0] ?? [];
    const row = grid[1] ?? [];

    expect(row).toHaveLength(header.length);
    expect(row[header.indexOf("Campagne en cours")]).toBe("SAV septembre");
    expect(row[header.indexOf("Étape de séquence")]).toBe("2 sur 3");
    expect(row[header.indexOf("A répondu")]).toBe("oui");
    expect(row[header.indexOf("Prospect chaud")]).toBe("oui");
    expect(row[header.indexOf("Lien vers la fiche")]).toBe(
      "https://crm.auraflowai.fr/contacts?fiche=c1",
    );
  });

  it("une étape jamais envoyée se dit, plutôt que de s'écrire « 0 »", () => {
    expect(valueOf("Étape de séquence", { campaign: "X", totalSteps: 3 })).toBe(
      "pas encore écrit (0 sur 3)",
    );
  });

  it("exporte une société nommée comme une formule en texte", () => {
    const hostile: ContactRecord = {
      ...contact,
      company: { id: "co2", name: '=HYPERLINK("http://mal.test";"Facture")' },
    };
    const grid = parseGrid(contactsToCsv([hostile], context()));
    const value = grid[1]?.[(grid[0] ?? []).indexOf("Société")] ?? "";

    expect(value.startsWith("=")).toBe(false);
    expect(value).toBe('\'=HYPERLINK("http://mal.test";"Facture")');
  });
});
