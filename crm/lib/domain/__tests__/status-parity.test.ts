import { describe, expect, it } from "vitest";
import { CONTACT_FILTERS, FOLLOW_UP_LABELS, followUpStatus } from "../follow-up";
import { matchesContactFilter, resolveContactStatus, type ContactStatusLike } from "../contact-status";
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
  return { status: "", lastContact: null, nextReminder: null, activityCount: 0, ...overrides };
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
const HISTORY_CHIPS = ["reminder", "stale-status", "contacted", "recent", "answered"] as const;
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

      // Cycle terminal : aucune pastille de statut, donc aucune puce.
      if (shown === null) {
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
    expect(resolveContactStatus(row, settings, now)?.label).toBe(FOLLOW_UP_LABELS.never);
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
    expect(resolveContactStatus(future, settings, now)?.key).toBe("planned");
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
    expect(resolveContactStatus(lost, settings, now)).toBeNull();
  });

  it("n'est revendiqué par aucune puce de statut", () => {
    for (const lifecycle of TERMINAL_LIFECYCLES) {
      const row = contact({ lifecycle, status: FOLLOW_UP_LABELS.never });
      for (const chip of STATUS_CHIPS) {
        expect(matchesContactFilter(row, chip, settings, now), `${lifecycle} / ${chip}`).toBe(false);
      }
    }
  });

  it("reste dans la puce « À relancer » si une relance traîne — c'est ce que la correction nettoie", () => {
    // La puce `reminder` porte sur une date, pas sur un statut : elle est le
    // signal qu'il reste quelque chose à nettoyer, pas une contradiction.
    const row = contact({ lifecycle: LOST_LIFECYCLE, nextReminder: day("2026-08-01") });
    expect(matchesContactFilter(row, "reminder", settings, now)).toBe(true);
    expect(contradictsTerminal({ lifecycle: LOST_LIFECYCLE, status: "", nextReminder: day("2026-08-01") })).toBe(true);
  });

  it("contradictsTerminal ne signale que les fiches terminales incohérentes", () => {
    expect(contradictsTerminal({ lifecycle: LOST_LIFECYCLE, status: "Intéressé", nextReminder: null })).toBe(true);
    expect(contradictsTerminal({ lifecycle: LOST_LIFECYCLE, status: "", nextReminder: null })).toBe(false);
    expect(contradictsTerminal({ lifecycle: "Prospect", status: "Intéressé", nextReminder: day("2026-09-01") })).toBe(false);
  });
});
