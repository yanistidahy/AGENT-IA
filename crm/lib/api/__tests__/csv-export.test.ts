import { describe, expect, it } from "vitest";
import { CONTACT_COLUMNS, mapHeaders, parseGrid } from "../../domain/csv";
import type { ContactRecord } from "../contacts";
import { contactsToCsv } from "../csv-export";

const contact: ContactRecord = {
  id: "c1",
  firstName: "Marie",
  lastName: "Durand",
  title: "DAF",
  website: "",
  instagram: "",
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

describe("contactsToCsv", () => {
  it("écrit des en-têtes que l'import sait relire", () => {
    const header = parseGrid(contactsToCsv([contact]))[0] ?? [];
    const mapping = mapHeaders(header);

    // Aucune colonne exportée n'est perdue au retour : l'export est réimportable.
    expect(mapping.ignored).toEqual([]);
    expect([...Object.keys(mapping.columns)].sort()).toEqual([...CONTACT_COLUMNS].sort());
  });

  it("fait l'aller-retour sur une société contenant le séparateur", () => {
    const grid = parseGrid(contactsToCsv([contact]));
    const header = grid[0] ?? [];
    const row = grid[1] ?? [];
    const index = header.indexOf("Société");

    expect(row[index]).toBe("ACME;SA");
  });

  it("fait l'aller-retour sur des notes multilignes", () => {
    const grid = parseGrid(contactsToCsv([contact]));
    const index = (grid[0] ?? []).indexOf("Notes");

    expect(grid[1]?.[index]).toBe("Premier appel\nÀ relancer en mars");
  });

  it("écrit les dates en AAAA-MM-JJ et les dates absentes en cellule vide", () => {
    const grid = parseGrid(contactsToCsv([contact]));
    const header = grid[0] ?? [];

    expect(grid[1]?.[header.indexOf("Dernier contact")]).toBe("2026-02-11");
    expect(grid[1]?.[header.indexOf("Prochaine relance")]).toBe("");
  });
});
