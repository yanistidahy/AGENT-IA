import { describe, expect, it } from "vitest";
import { externalLabel, externalUrl } from "../links";
import { fold, searchTerm, searchText } from "../text";
import { DO_NOT_CONTACT, isLost, LOST_LIFECYCLE, LOST_REASONS, optedOut } from "../lost";
import {
  applyFilterToParams,
  clearFilters,
  parseFilters,
  presetRange,
  VOID,
  type ColumnSpec,
} from "../column-filters";
import { cellKey, facetsFor, matchesFilter } from "../column-match";
import { proposedReminder, DEFAULT_REMINDER_DELAYS } from "../automation";

describe("adresses externes", () => {
  /** Le défaut signalé : une valeur sans schéma lue comme un chemin relatif. */
  it("préfixe https:// quand le schéma manque", () => {
    expect(externalUrl("linkedin.com/in/pascal-charpentier")).toBe(
      "https://linkedin.com/in/pascal-charpentier",
    );
    expect(externalUrl("zenithlabs.fr")).toBe("https://zenithlabs.fr");
  });

  it("laisse intacte une adresse déjà complète", () => {
    expect(externalUrl("https://linkedin.com/in/x")).toBe("https://linkedin.com/in/x");
    expect(externalUrl("http://exemple.fr")).toBe("http://exemple.fr");
  });

  it("ne fabrique pas de lien à partir de rien", () => {
    for (const value of ["", "   ", null, undefined]) {
      expect(externalUrl(value), String(value)).toBeNull();
    }
  });

  /** Un `href` en `javascript:` exécute du code au clic : jamais rendu cliquable. */
  it("refuse les schémas qui ne sont pas du web", () => {
    expect(externalUrl("javascript:alert(1)")).toBeNull();
    expect(externalUrl("mailto:x@y.fr")).toBeNull();
    expect(externalUrl("/contacts")).toBeNull();
  });

  it("affiche la valeur sans le schéma ajouté", () => {
    expect(externalLabel("https://linkedin.com/in/x/")).toBe("linkedin.com/in/x");
  });
});

describe("recherche insensible aux accents", () => {
  it("« zenith » trouve « Zénith »", () => {
    expect(fold("Zénith Labs")).toContain("zenith");
    expect(searchText(["Zénith", "Labs"])).toBe("zenith labs");
  });

  it("couvre l'alphabet latin, pas seulement le français", () => {
    expect(fold("Ångström")).toBe("angstrom");
  });

  it("sépare les champs, pour ne pas créer de faux voisinages", () => {
    // Sans l'espace, « riedu » se trouverait dans « mariedurand ».
    expect(searchText(["Marie", "Durand"])).toBe("marie durand");
  });

  it("écarte les champs vides", () => {
    expect(searchText(["Marie", "", null, undefined, "Durand"])).toBe("marie durand");
  });

  it("normalise aussi le terme cherché", () => {
    expect(searchTerm(" ZÉNITH ")).toBe("zenith");
    expect(searchTerm(undefined)).toBe("");
  });
});

describe("prospects perdus", () => {
  it("« Perdu » est un cycle de vie du domaine", () => {
    expect(isLost(LOST_LIFECYCLE)).toBe(true);
    expect(isLost("Prospect")).toBe(false);
  });

  it("reconnaît l'opposition au démarchage, quelle que soit la casse", () => {
    expect(optedOut({ lostReason: DO_NOT_CONTACT })).toBe(true);
    expect(optedOut({ lostReason: "  ne souhaite plus être contacté " })).toBe(true);
    expect(optedOut({ lostReason: "Budget" })).toBe(false);
    expect(optedOut({ lostReason: "" })).toBe(false);
  });

  /**
   * La règle demandée : aucune relance proposée à quelqu'un qui s'y oppose,
   * quel que soit son cycle de vie. Elle vit dans le domaine, pas dans l'écran.
   */
  it("aucune relance n'est proposée à une personne opposée au démarchage", () => {
    const base = {
      type: "call" as const,
      interactionDate: new Date("2026-08-08T10:00:00Z"),
      existingReminder: null,
      delays: DEFAULT_REMINDER_DELAYS,
    };
    expect(proposedReminder({ ...base, lostReason: DO_NOT_CONTACT })).toBeNull();
    expect(proposedReminder({ ...base, lostReason: "Budget" })).not.toBeNull();
    expect(proposedReminder(base)).not.toBeNull();
  });
});

const COLUMNS: readonly ColumnSpec[] = [
  { key: "lifecycle", label: "Cycle de vie", kind: "text" },
  { key: "nextReminder", label: "Prochaine relance", kind: "date" },
  { key: "amount", label: "Montant", kind: "number" },
];

describe("filtres de colonne — lecture de l'URL", () => {
  it("lit plusieurs valeurs d'une même colonne", () => {
    const state = parseFilters({ "f.lifecycle": ["Lead", "Prospect"] }, COLUMNS);
    expect(state.lifecycle).toEqual({ kind: "text", values: ["Lead", "Prospect"] });
  });

  it("lit un raccourci de date et un intervalle", () => {
    expect(parseFilters({ "f.nextReminder": "late" }, COLUMNS).nextReminder).toEqual({
      kind: "date",
      preset: "late",
      from: null,
      to: null,
    });
    expect(
      parseFilters({ "f.nextReminder": "2026-01-01..2026-02-01" }, COLUMNS).nextReminder,
    ).toEqual({ kind: "date", preset: null, from: "2026-01-01", to: "2026-02-01" });
  });

  it("lit un intervalle numérique, borne ouverte comprise", () => {
    expect(parseFilters({ "f.amount": "1000..5000" }, COLUMNS).amount).toEqual({
      kind: "number",
      min: 1000,
      max: 5000,
    });
    expect(parseFilters({ "f.amount": "..5000" }, COLUMNS).amount).toEqual({
      kind: "number",
      min: null,
      max: 5000,
    });
  });

  /** Une URL partagée dont un paramètre a été tronqué doit afficher, pas planter. */
  it("ignore ce qu'elle ne comprend pas", () => {
    expect(parseFilters({ "f.amount": "abc..def" }, COLUMNS)).toEqual({});
    expect(parseFilters({ "f.inconnue": "x" }, COLUMNS)).toEqual({});
  });

  it("fait l'aller-retour par l'URL sans rien perdre", () => {
    const written = applyFilterToParams(new URLSearchParams("q=zenith"), "lifecycle", {
      kind: "text",
      values: ["Lead", "Perdu"],
    });
    expect(written.get("q")).toBe("zenith");
    expect(written.getAll("f.lifecycle")).toEqual(["Lead", "Perdu"]);

    const reread = parseFilters({ "f.lifecycle": written.getAll("f.lifecycle") }, COLUMNS);
    expect(reread.lifecycle).toEqual({ kind: "text", values: ["Lead", "Perdu"] });
  });

  it("la réinitialisation ne touche qu'aux filtres de colonne", () => {
    const cleared = clearFilters(new URLSearchParams("q=zenith&f.lifecycle=Lead&sort=name"));
    expect(cleared.get("q")).toBe("zenith");
    expect(cleared.get("sort")).toBe("name");
    expect(cleared.getAll("f.lifecycle")).toEqual([]);
  });
});

const NOW = new Date("2026-08-12T15:00:00Z"); // un mercredi

describe("filtres de colonne — application", () => {
  it("retient une valeur cochée parmi plusieurs", () => {
    const filter = { kind: "text", values: ["Lead", "Prospect"] } as const;
    expect(matchesFilter(filter, "Lead", NOW)).toBe(true);
    expect(matchesFilter(filter, "Client", NOW)).toBe(false);
  });

  it("« (vide) » est une valeur qu'on peut cocher", () => {
    expect(cellKey("")).toBe(VOID);
    expect(cellKey(null)).toBe(VOID);
    expect(matchesFilter({ kind: "text", values: [VOID] }, "", NOW)).toBe(true);
  });

  /** « En retard » ne ramasse pas les fiches sans échéance : elles ne le sont de rien. */
  it("une date absente ne tombe dans aucun intervalle", () => {
    const late = { kind: "date", preset: "late", from: null, to: null } as const;
    expect(matchesFilter(late, null, NOW)).toBe(false);
    expect(matchesFilter({ kind: "date", preset: "empty", from: null, to: null }, null, NOW)).toBe(
      true,
    );
    expect(matchesFilter({ kind: "date", preset: "any", from: null, to: null }, null, NOW)).toBe(
      false,
    );
  });

  it("« cette semaine » part du lundi", () => {
    const range = presetRange("week", NOW);
    expect(range?.from?.getDay()).toBe(1);
    expect(range?.to?.getDay()).toBe(1);
  });

  it("les bornes hautes ne se recouvrent pas d'une journée", () => {
    const today = presetRange("today", NOW);
    expect(matchesFilter(
      { kind: "date", preset: "today", from: null, to: null },
      today?.to ?? NOW,
      NOW,
    )).toBe(false);
  });

  it("un intervalle numérique est inclusif aux deux bouts", () => {
    const filter = { kind: "number", min: 1000, max: 5000 } as const;
    expect(matchesFilter(filter, 1000, NOW)).toBe(true);
    expect(matchesFilter(filter, 5000, NOW)).toBe(true);
    expect(matchesFilter(filter, 5001, NOW)).toBe(false);
  });
});

interface Row {
  readonly lifecycle: string;
  readonly owner: string;
}

const ROWS: readonly Row[] = [
  { lifecycle: "Lead", owner: "Yanis" },
  { lifecycle: "Lead", owner: "Sacha" },
  { lifecycle: "Prospect", owner: "Yanis" },
  { lifecycle: "Perdu", owner: "" },
];

const FACET_COLUMNS = [
  { key: "lifecycle", label: "Cycle de vie", value: (row: Row) => row.lifecycle },
  { key: "owner", label: "Propriétaire", value: (row: Row) => row.owner },
];

describe("valeurs distinctes proposées par un menu", () => {
  it("compte chaque valeur", () => {
    const facets = facetsFor(ROWS, FACET_COLUMNS, {}, NOW);
    expect(facets.lifecycle).toEqual([
      { value: "Lead", count: 2 },
      { value: "Perdu", count: 1 },
      { value: "Prospect", count: 1 },
    ]);
  });

  /**
   * Le comportement qui distingue un vrai filtre de tableur d'une liste figée :
   * une colonne ne se compte pas elle-même, sinon on ne pourrait jamais ajouter
   * une seconde valeur à une sélection existante.
   */
  it("une colonne ne compte pas son propre filtre", () => {
    const state = { lifecycle: { kind: "text", values: ["Lead"] } } as const;
    const facets = facetsFor(ROWS, FACET_COLUMNS, state, NOW);

    // Le menu « Cycle de vie » montre toujours les quatre lignes…
    expect(facets.lifecycle?.length).toBe(3);
    // …mais « Propriétaire » ne montre que ceux des deux Leads.
    expect(facets.owner).toEqual([
      { value: "Sacha", count: 1 },
      { value: "Yanis", count: 1 },
    ]);
  });

  it("« (vide) » est classé en dernier", () => {
    const facets = facetsFor(ROWS, FACET_COLUMNS, {}, NOW);
    expect(facets.owner?.at(-1)?.value).toBe(VOID);
  });
});

describe("motifs de perte", () => {
  it("« Pas intéressé » est proposé, et n'est pas une opposition au démarchage", () => {
    expect(LOST_REASONS).toContain("Pas intéressé");
    expect(optedOut({ lostReason: "Pas intéressé" })).toBe(false);
  });

  /**
   * Le garde-fou qui compte : seule la formule exacte vaut opposition RGPD. Un
   * refus commercial, même catégorique, ne doit jamais la déclencher.
   */
  it("aucun autre motif ne vaut opposition", () => {
    for (const reason of LOST_REASONS) {
      expect(optedOut({ lostReason: reason }), reason).toBe(reason === DO_NOT_CONTACT);
    }
  });
});
