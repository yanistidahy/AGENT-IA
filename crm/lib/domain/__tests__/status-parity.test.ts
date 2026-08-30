import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTACT_CHIPS,
  CONTACT_FILTERS,
  CONTACT_FILTER_LABELS,
  FOLLOW_UP_LABELS,
  followUpStatus,
  isChipFilter,
  appliedInSql,
  type ContactFilter,
} from "../follow-up";
import {
  compareByStatus,
  contactAttention,
  matchesContactFilter,
  resolveContactStatus,
  resolveDisplayStatus,
  type ContactStatusLike,
} from "../contact-status";
import { canonicalStatus, resolveStatus } from "../status";
import { contradictsTerminal, LOST_LIFECYCLE, TERMINAL_LIFECYCLES } from "../lost";
import { DEFAULT_PILOTAGE } from "../types";

/**
 * **Le test de parité du statut de relance.**
 *
 * Même discipline que `column-filters-parity.test.ts` et
 * `no-duplicate-thresholds.test.ts` : une règle qui vit à plusieurs endroits
 * finit par diverger, et la divergence ne se voit pas — elle se mesure.
 *
 * Ce qu'il fixe, contact par contact, sur une population qui couvre les cinq
 * statuts calculés **et** les statuts saisis :
 *
 * 1. la pastille (`resolveStatus`) et la puce (`matchesContactFilter`)
 *    désignent le même statut ;
 * 2. un contact appartient à **au plus une** puce de statut — `never`,
 *    `silent`, `due`, `planned`, `waiting` s'excluent deux à deux ;
 * 3. le statut saisi l'emporte partout, ou nulle part.
 *
 * Le défaut qu'il aurait attrapé : `matchesContactFilter` filtrait sur le seul
 * statut calculé pendant que la pastille affichait le statut saisi. Sur la base
 * de vérification, 66 fiches portaient « Jamais contacté » et la puce du même
 * nom en renvoyait 2.
 */
const now = new Date("2026-08-12T10:00:00Z");
const settings = DEFAULT_PILOTAGE;

function contact(overrides: Partial<ContactStatusLike> = {}): ContactStatusLike {
  return {
    status: "",
    // Non terminal par défaut ; les cas terminaux le surchargent explicitement.
    lifecycle: "Prospect",
    lastContact: null,
    nextReminder: null,
    activityCount: 0,
    ...overrides,
  };
}

const day = (iso: string) => new Date(`${iso}T09:00:00Z`);

/** Population de référence : les cinq calculs, croisés avec les statuts saisis. */
const POPULATION: ReadonlyArray<readonly [string, ContactStatusLike]> = [
  ["jamais touché", contact()],
  ["jamais touché + relance à venir", contact({ nextReminder: day("2026-09-01") })],
  ["relance dépassée", contact({ lastContact: day("2026-07-01"), activityCount: 1, nextReminder: day("2026-08-01") })],
  ["relance aujourd'hui", contact({ lastContact: day("2026-08-01"), activityCount: 1, nextReminder: day("2026-08-12") })],
  ["relance à venir", contact({ lastContact: day("2026-08-01"), activityCount: 1, nextReminder: day("2026-09-01") })],
  ["touché récemment", contact({ lastContact: day("2026-08-10"), activityCount: 1 })],
  ["silencieux", contact({ lastContact: day("2026-06-01"), activityCount: 1 })],
  ["interaction sans date de contact", contact({ activityCount: 1 })],

  // Les fiches corrigées depuis la feuille : statut saisi, et une histoire qui
  // dit autre chose. C'est exactement la population qui divergeait.
  ["saisi « Jamais contacté » mais touché", contact({ status: FOLLOW_UP_LABELS.never, lastContact: day("2026-07-15"), activityCount: 1 })],
  ["saisi « Jamais contacté » et relance due", contact({ status: FOLLOW_UP_LABELS.never, lastContact: day("2026-07-09"), activityCount: 1, nextReminder: day("2026-04-02") })],
  ["saisi « Sans nouvelles » mais touché hier", contact({ status: FOLLOW_UP_LABELS.silent, lastContact: day("2026-08-11"), activityCount: 1 })],
  ["saisi « À relancer » sans relance", contact({ status: FOLLOW_UP_LABELS.due, lastContact: day("2026-08-01"), activityCount: 1 })],
  ["saisi « Relance prévue »", contact({ status: FOLLOW_UP_LABELS.planned, nextReminder: day("2026-09-01") })],
  ["saisi « En attente »", contact({ status: FOLLOW_UP_LABELS.waiting, lastContact: day("2026-06-01"), activityCount: 1 })],

  // Libellés libres : connus de la saisie, sans équivalent calculable.
  ["saisi « Contacté — en attente »", contact({ status: "Contacté — en attente", lastContact: day("2026-07-01"), activityCount: 1 })],
  ["saisi « Intéressé »", contact({ status: "Intéressé", lastContact: day("2026-08-05"), activityCount: 2 })],
  ["saisi « RDV pris »", contact({ status: "RDV pris", lastContact: day("2026-08-05"), activityCount: 2 })],
  ["saisi libre inconnu", contact({ status: "À rappeler en septembre", activityCount: 1 })],

  // Cycles de vie terminaux : la relation ne court plus, donc aucun statut de
  // relance — même quand la fiche en porte un en base, ce qui est exactement
  // l'état contradictoire signalé (« Perdu » + « Contacté — en attente »).
  ["Perdu, sans statut saisi", contact({ lifecycle: LOST_LIFECYCLE, lastContact: day("2026-06-01"), activityCount: 1 })],
  ["Perdu + statut saisi contradictoire", contact({ lifecycle: LOST_LIFECYCLE, status: "Contacté — en attente", lastContact: day("2026-06-01"), activityCount: 1 })],
  ["Perdu + « Jamais contacté » saisi", contact({ lifecycle: LOST_LIFECYCLE, status: FOLLOW_UP_LABELS.never })],
  ["Perdu + relance encore posée", contact({ lifecycle: LOST_LIFECYCLE, nextReminder: day("2026-08-01"), lastContact: day("2026-07-01"), activityCount: 1 })],
  ["Ancien Client", contact({ lifecycle: "Ancien Client", lastContact: day("2026-05-01"), activityCount: 3 })],
];

/**
 * Les puces qui portent sur un statut, par opposition aux puces d'historique.
 *
 * Il n'y en a que deux — `never` et `silent`. Les trois autres statuts (`due`,
 * `planned`, `waiting`) n'ont pas de puce : `due` et `planned` sont couverts
 * par la puce de date « À relancer », et `waiting` est l'état par défaut, qu'il
 * n'y aurait aucun intérêt à filtrer. Un contact dans l'un de ces états
 * n'appartient donc à **aucune** puce de statut, et c'est correct.
 */
// `unidentified` rejoint la liste au jalon 50 : elle ne décrit **pas** un statut
// de relance mais un manque dans la fiche — le nom du décideur. Elle est donc
// orthogonale aux cinq états, et se croise librement avec eux : une marque sans
// nom peut être « jamais contactée » comme « sans nouvelles ».
const HISTORY_CHIPS = [
  "reminder",
  "stale-status",
  "contacted",
  "recent",
  "answered",
  "unidentified",
] as const;
const STATUS_CHIPS = CONTACT_FILTERS.filter(
  (filter) => !HISTORY_CHIPS.some((history) => history === filter),
);

describe("parité du statut de relance", () => {
  it("la pastille et les puces désignent le même statut, sur toute la population", () => {
    const disagreements: string[] = [];

    for (const [label, row] of POPULATION) {
      const shown = resolveContactStatus(row, settings, now);
      const selectedBy = STATUS_CHIPS.filter((chip) =>
        matchesContactFilter(row, chip, settings, now),
      );

      // Cycle terminal : la pastille porte le cycle de vie, et aucune puce de
      // statut de relance ne peut la revendiquer.
      if (shown.terminal) {
        if (shown.label !== row.lifecycle) {
          disagreements.push(`${label} : pastille terminale « ${shown.label} » ≠ ${row.lifecycle}`);
        }
        if (selectedBy.length !== 0) {
          disagreements.push(`${label} : cycle terminal revendiqué par [${selectedBy.join(", ")}]`);
        }
        continue;
      }

      // La clé a une puce → exactement celle-là retient le contact.
      const chipForKey = STATUS_CHIPS.find((chip) => chip === shown.key);

      if (chipForKey !== undefined) {
        if (selectedBy.length !== 1 || selectedBy[0] !== chipForKey) {
          disagreements.push(
            `${label} : pastille « ${shown.label} » (clé ${shown.key}) mais puces [${selectedBy.join(", ") || "aucune"}]`,
          );
        }
        continue;
      }

      // Pas de puce pour cette clé — ou libellé libre : aucune puce ne doit le
      // revendiquer. C'est ce qui interdit qu'une puce ratisse plus large que
      // son libellé ne le promet.
      if (selectedBy.length !== 0) {
        disagreements.push(
          `${label} : « ${shown.label} » (clé ${shown.key ?? "libre"}) revendiqué par [${selectedBy.join(", ")}]`,
        );
      }
    }

    expect(disagreements).toEqual([]);
  });

  it("aucun contact n'appartient à deux puces de statut", () => {
    for (const [label, row] of POPULATION) {
      const count = STATUS_CHIPS.filter((chip) =>
        matchesContactFilter(row, chip, settings, now),
      ).length;
      expect(count, `${label} appartient à ${count} puces`).toBeLessThanOrEqual(1);
    }
  });

  it("le statut saisi l'emporte sur le calcul, y compris quand il le contredit", () => {
    const row = contact({
      status: FOLLOW_UP_LABELS.never,
      lastContact: day("2026-07-15"),
      activityCount: 1,
    });

    // Le calcul dit autre chose…
    expect(followUpStatus(row, settings, now)).toBe("silent");
    // …et c'est bien la saisie qui gagne, à l'affichage comme au filtre.
    expect(resolveContactStatus(row, settings, now).label).toBe(FOLLOW_UP_LABELS.never);
    expect(matchesContactFilter(row, "never", settings, now)).toBe(true);
    expect(matchesContactFilter(row, "silent", settings, now)).toBe(false);
  });

  it("effacer le statut saisi rend la main au calcul", () => {
    const base = { lastContact: day("2026-06-01"), activityCount: 1 };
    expect(matchesContactFilter(contact({ ...base, status: FOLLOW_UP_LABELS.never }), "never", settings, now)).toBe(true);
    expect(matchesContactFilter(contact({ ...base, status: "" }), "silent", settings, now)).toBe(true);
  });

  it("« reminder » reste une puce de date, plus large que le statut « due »", () => {
    const future = contact({ lastContact: day("2026-08-01"), activityCount: 1, nextReminder: day("2026-09-01") });
    expect(matchesContactFilter(future, "reminder", settings, now)).toBe(true);
    expect(resolveContactStatus(future, settings, now).key).toBe("planned");
  });

  it("canonicalStatus ne reconnaît que le vocabulaire du domaine", () => {
    expect(canonicalStatus(FOLLOW_UP_LABELS.never)).toBe("never");
    expect(canonicalStatus("  Sans nouvelles  ")).toBe("silent");
    expect(canonicalStatus("Contacté — en attente")).toBeNull();
    expect(canonicalStatus("Intéressé")).toBeNull();
    expect(canonicalStatus("")).toBeNull();
  });

  it("resolveStatus rend une clé cohérente avec sa source", () => {
    expect(resolveStatus({ status: "", followUp: "due" })).toMatchObject({
      source: "computed",
      key: "due",
    });
    expect(resolveStatus({ status: FOLLOW_UP_LABELS.never, followUp: "silent" })).toMatchObject({
      source: "stored",
      key: "never",
    });
    expect(resolveStatus({ status: "Intéressé", followUp: "waiting" })).toMatchObject({
      source: "stored",
      key: null,
    });
  });
});

describe("le jeu de puces", () => {
  /**
   * La décision, écrite noir sur blanc.
   *
   * « Déjà contactés » est retirée : complément exact de « Jamais contacté »,
   * donc deux formulations d'une même frontière. Ce test existe pour qu'on ne
   * la réintroduise pas par distraction — et pour qu'en ajouter une soit un
   * geste délibéré, pas un effet de bord.
   *
   * **Deux puces ajoutées au jalon 48**, et elles ne retombent pas dans le
   * défaut de « Déjà contactés » : « DM envoyé » et « Pas encore de DM » sont
   * bien complémentaires l'une de l'autre, mais aucune des deux ne se déduit
   * d'une puce **déjà présente** — c'était ça, le reproche. Elles nomment les
   * deux moitiés d'une file de travail : ce qui est fait, ce qui reste à faire.
   */
  it("propose exactement les sept puces retenues", () => {
    expect(CONTACT_CHIPS.map((chip) => CONTACT_FILTER_LABELS[chip])).toEqual([
      "À relancer",
      "Sans nouvelles",
      "Jamais contacté",
      "Statut figé",
      "Contactés cette semaine",
      "Ont répondu",
      "À identifier",
    ]);
  });

  it("« À identifier » ne double aucune puce existante", () => {
    // Le reproche fait à « Déjà contactés » était d'être le complément exact
    // d'une autre puce. Celle-ci ne l'est d'aucune : elle porte sur le **nom
    // de la fiche**, pas sur son historique ni sur ses dates — une marque sans
    // décideur connu peut être jamais contactée, relancée, ou silencieuse.
    expect(CONTACT_CHIPS).toContain("unidentified");
    expect(STATUS_CHIPS).not.toContain("unidentified");
  });

  it("les états Instagram ne sont **pas** des puces de relance", () => {
    // Le jalon 48 en avait fait deux valeurs de `followUp` ; le jalon 49 les a
    // sorties, parce que « compte connu » et « DM envoyé » sont deux questions
    // indépendantes dont les croisements ne s'énumèrent pas. Elles vivent
    // maintenant dans deux paramètres à elles.
    expect(CONTACT_FILTERS).not.toContain("dm");
    expect(CONTACT_FILTERS).not.toContain("no-dm");
  });

  it("« Déjà contactés » reste une valeur valide, sans puce", () => {
    // La bande « contactés » de l'entonnoir pointe dessus : retirer la valeur
    // casserait un lien qui fonctionne. C'est la puce qu'on retire, pas la vue.
    expect(CONTACT_FILTERS).toContain("contacted");
    expect(isChipFilter("contacted")).toBe(false);
    expect(CONTACT_CHIPS).not.toContain("contacted");
  });

  it("chaque valeur sans puce reste nommable et donc affichable", () => {
    // Le filtre orphelin est rendu à l'écran tant qu'il est actif : il lui faut
    // un libellé, sinon la puce de rattrapage sortirait vide.
    for (const filter of CONTACT_FILTERS) {
      if (isChipFilter(filter)) continue;
      expect(CONTACT_FILTER_LABELS[filter], `${filter} sans libellé`).toBeTruthy();
    }
  });
});

describe("cycle de vie terminal", () => {
  it("supprime le statut de relance, quel que soit ce qui est saisi", () => {
    const lost = contact({
      lifecycle: LOST_LIFECYCLE,
      status: "Contacté — en attente",
      lastContact: day("2026-06-01"),
      activityCount: 1,
    });
    // Le calcul dirait « Sans nouvelles », la saisie dirait « en attente » :
    // le cycle de vie tranche, et il n'y a pas de statut du tout.
    expect(followUpStatus(lost, settings, now)).toBe("silent");

    // Ce qui s'affiche est le cycle de vie, marqué terminal — pas un statut de
    // relance, et pas une case vide : la colonne Statut reste lisible.
    const shown = resolveContactStatus(lost, settings, now);
    expect(shown.label).toBe(LOST_LIFECYCLE);
    expect(shown.terminal).toBe(true);
    expect(shown.key).toBeNull();
    expect(shown.attention).toBe(false);
  });

  it("rend son propre libellé pour chaque cycle terminal", () => {
    for (const lifecycle of TERMINAL_LIFECYCLES) {
      const shown = resolveContactStatus(contact({ lifecycle }), settings, now);
      expect(shown.label, `${lifecycle} doit s'afficher sous son nom`).toBe(lifecycle);
      expect(shown.terminal).toBe(true);
    }
  });

  it("n'est revendiqué par aucune puce de statut", () => {
    for (const lifecycle of TERMINAL_LIFECYCLES) {
      const row = contact({ lifecycle, status: FOLLOW_UP_LABELS.never });
      for (const chip of STATUS_CHIPS) {
        expect(matchesContactFilter(row, chip, settings, now), `${lifecycle} / ${chip}`).toBe(false);
      }
    }
  });

  it("n'entre pas dans « À relancer », même si une relance traîne en base", () => {
    // La valeur stockée n'est pas effacée : sans exclusion explicite, la puce de
    // date ressusciterait un contact perdu dans une liste de travail. Afficher
    // « Perdu » dans la colonne Statut ne doit rien rouvrir.
    const row = contact({ lifecycle: LOST_LIFECYCLE, nextReminder: day("2026-08-01") });
    expect(matchesContactFilter(row, "reminder", settings, now)).toBe(false);
    // La contradiction en base reste signalée : c'est ce que le rangement traite.
    expect(contradictsTerminal({ lifecycle: LOST_LIFECYCLE, status: "", nextReminder: day("2026-08-01") })).toBe(true);
  });

  it("n'appelle jamais l'attention, donc ne rougit aucune ligne", () => {
    for (const [label, row] of POPULATION) {
      if (!TERMINAL_LIFECYCLES.includes(row.lifecycle)) continue;
      const attention = contactAttention({
        status: row.status,
        followUp: followUpStatus(row, settings, now),
        lifecycle: row.lifecycle,
      });
      expect(attention, `${label} ne doit pas appeler l'attention`).toBe(false);
    }
  });

  it("part en fin de liste dans les deux sens du tri", () => {
    const active = POPULATION.filter(([, r]) => !TERMINAL_LIFECYCLES.includes(r.lifecycle)).map(([, r]) => r);
    const terminal = POPULATION.filter(([, r]) => TERMINAL_LIFECYCLES.includes(r.lifecycle)).map(([, r]) => r);
    // Mélangés à dessein : un tri qui ne déplace rien passerait sinon.
    const mixed = [terminal[0]!, active[0]!, terminal[1]!, active[1]!, terminal[2]!];

    for (const direction of [1, -1] as const) {
      const sorted = [...mixed].sort((a, b) => compareByStatus(a, b, direction, settings, now));
      const firstTerminal = sorted.findIndex((r) => TERMINAL_LIFECYCLES.includes(r.lifecycle));
      const lastActive = sorted.map((r) => !TERMINAL_LIFECYCLES.includes(r.lifecycle)).lastIndexOf(true);
      expect(firstTerminal, `sens ${direction} : une terminale précède une active`).toBeGreaterThan(lastActive);
    }
  });

  /**
   * **Les surfaces, simulées une par une.**
   *
   * Chaque entrée reproduit ce que fait réellement un écran pour obtenir le
   * libellé qu'il affiche. Le test n'inspecte pas du HTML — il n'y a pas de DOM
   * dans cette suite — mais il exerce le **chemin de décision** de chaque vue,
   * qui est l'endroit où la divergence se produit.
   *
   * Le défaut que ceci attrape, et qui était bien réel : `/clients` appelait
   * `resolveStatus()` sans cycle de vie. Rebrancher cette lecture brute — dans
   * n'importe laquelle de ces surfaces — fait tomber ce test.
   */
  const SURFACES: ReadonlyArray<
    readonly [string, (row: ContactStatusLike) => string | null]
  > = [
    // /contacts et /accueil et /clients : tous trois via ContactStatusTag, qui
    // délègue à resolveDisplayStatus avec le followUp déjà calculé.
    [
      "pastille (tableau, accueil, portefeuille, tiroir)",
      (row) =>
        resolveDisplayStatus({
          status: row.status,
          followUp: followUpStatus(row, settings, now),
          lifecycle: row.lifecycle,
        }).label,
    ],
    // Les outils du conseil : `statutDeRelance` rendu à l'agent.
    ["outils du conseil", (row) => resolveContactStatus(row, settings, now).label],
  ];

  it("toutes les surfaces affichent le cycle de vie, et aucune n'y voit du travail", () => {
    const problems: string[] = [];

    for (const [label, row] of POPULATION) {
      if (!TERMINAL_LIFECYCLES.includes(row.lifecycle)) continue;

      for (const [surface, render] of SURFACES) {
        const shown = render(row);
        // Ce que chaque surface doit montrer : le cycle de vie, ni un statut de
        // relance, ni rien du tout.
        if (shown !== row.lifecycle) {
          problems.push(`${label} → ${surface} affiche « ${shown ?? "rien"} » au lieu de « ${row.lifecycle} »`);
        }
      }

      // …et le style doit dire « close », pas « à traiter ».
      const resolved = resolveContactStatus(row, settings, now);
      if (!resolved.terminal) problems.push(`${label} : pastille non marquée terminale`);
      if (resolved.attention) problems.push(`${label} : marquée comme appelant l'attention`);
      if (resolved.key !== null) problems.push(`${label} : porte la clé ${resolved.key}`);
    }

    expect(problems).toEqual([]);
  });

  it("les surfaces s'accordent sur les fiches non terminales", () => {
    // Le pendant du test précédent : sans lui, supprimer tout affichage rendrait
    // les deux verts. Une règle qui se vérifie en n'affichant rien ne vérifie
    // rien.
    for (const [label, row] of POPULATION) {
      if (TERMINAL_LIFECYCLES.includes(row.lifecycle)) continue;

      const expected = resolveContactStatus(row, settings, now)?.label ?? null;
      expect(expected, `${label} : aucune surface ne devrait se taire ici`).not.toBeNull();

      const first = SURFACES[0];
      expect(first?.[1](row), `${label} : la pastille diverge`).toBe(expected);
    }
  });

  it("chaque cycle terminal est représenté dans la population", () => {
    // Sans cela, ajouter un cycle terminal demain le laisserait hors du test
    // ci-dessus — qui resterait vert en ne vérifiant rien à son sujet.
    for (const lifecycle of TERMINAL_LIFECYCLES) {
      const covered = POPULATION.some(([, row]) => row.lifecycle === lifecycle);
      expect(covered, `${lifecycle} n'est couvert par aucun cas`).toBe(true);
    }
  });

  it("contradictsTerminal ne signale que les fiches terminales incohérentes", () => {
    expect(contradictsTerminal({ lifecycle: LOST_LIFECYCLE, status: "Intéressé", nextReminder: null })).toBe(true);
    expect(contradictsTerminal({ lifecycle: LOST_LIFECYCLE, status: "", nextReminder: null })).toBe(false);
    expect(contradictsTerminal({ lifecycle: "Prospect", status: "Intéressé", nextReminder: day("2026-09-01") })).toBe(false);
  });
});

/**
 * **Un filtre tranché en SQL doit être déclaré comme tel.**
 *
 * `listContacts` applique les deux passes : la clause SQL ramène les lignes,
 * puis `applyDerived` les repasse au tamis de `matchesContactFilter`. Un filtre
 * qui vit en SQL sans figurer dans `SQL_ONLY_FILTERS` retombe sur la
 * comparaison de statut — qui ne vaut jamais « dm » — et **la liste ressort
 * vide sans qu'aucune erreur ne soit levée** : la puce a l'air de marcher, elle
 * ne renvoie rien.
 *
 * C'est exactement le défaut introduit puis corrigé au jalon 48, et ce test
 * existe pour qu'il ne revienne pas au prochain filtre d'historique.
 */
describe("les filtres décidés en SQL sont déclarés", () => {
  const HISTORY_FILTERS: readonly ContactFilter[] = [
    "stale-status",
    "contacted",
    "recent",
    "answered",
  ];

  it("chacun est reconnu par appliedInSql", () => {
    for (const filter of HISTORY_FILTERS) {
      expect(appliedInSql(filter), `${filter} doit être déclaré SQL`).toBe(true);
    }
  });

  it("et laisse donc passer les lignes que SQL a déjà retenues", () => {
    // Une fiche quelconque, non terminale : le second passage ne doit pas la
    // rejeter sous prétexte que son statut calculé ne s'appelle pas « dm ».
    const row = contact({ lastContact: day("2026-08-10"), activityCount: 1 });
    for (const filter of HISTORY_FILTERS) {
      expect(matchesContactFilter(row, filter, settings, now), filter).toBe(true);
    }
  });
});
