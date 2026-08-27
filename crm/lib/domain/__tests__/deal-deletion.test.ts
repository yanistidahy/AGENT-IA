import { describe, expect, it } from "vitest";
import {
  deletionVerdict,
  describeDeletion,
  describeRefusal,
  type DeletionFacts,
} from "../deal-deletion";

/** Une affaire créée il y a trente secondes : une visite d'étape, rien d'autre. */
const FRESH: DeletionFacts = {
  status: "open",
  realActivities: 0,
  notes: 0,
  stageVisits: 1,
  tasks: 0,
};

describe("ce qui se supprime", () => {
  it("un doublon tout neuf", () => {
    expect(deletionVerdict(FRESH).deletable).toBe(true);
  });

  it("une affaire née d'une qualification — sa note ne la retient pas", () => {
    // `qualifyContact` consigne une note « Créée à la qualification du
    // contact. ». La compter rendrait indélébile toute affaire ouverte sur le
    // mauvais contact, c'est-à-dire l'erreur même que la suppression répare.
    const verdict = deletionVerdict({ ...FRESH, notes: 1 });
    expect(verdict.deletable).toBe(true);
    expect(verdict.collateral).toContain("1 note(s) d'historique");
  });
});

describe("ce qui se refuse", () => {
  it("un échange consigné", () => {
    const facts = { ...FRESH, realActivities: 2 };
    const verdict = deletionVerdict(facts);
    expect(verdict.deletable).toBe(false);
    expect(verdict.blockers).toEqual(["activities"]);
    expect(describeRefusal(facts, verdict)).toContain("2 échange(s) consigné(s)");
  });

  it("un déplacement d'étape — mais pas la visite de création", () => {
    expect(deletionVerdict({ ...FRESH, stageVisits: 1 }).deletable).toBe(true);
    const moved = deletionVerdict({ ...FRESH, stageVisits: 2 });
    expect(moved.deletable).toBe(false);
    expect(moved.blockers).toEqual(["stage-moves"]);
  });

  it("compte les déplacements, pas les visites", () => {
    const facts = { ...FRESH, stageVisits: 4 };
    expect(describeRefusal(facts, deletionVerdict(facts))).toContain(
      "3 déplacement(s) d'étape",
    );
  });

  it("une affaire gagnée, en nommant le chiffre d'affaires", () => {
    const facts: DeletionFacts = { ...FRESH, status: "won" };
    const verdict = deletionVerdict(facts);
    expect(verdict.deletable).toBe(false);
    expect(describeRefusal(facts, verdict)).toContain("chiffre d'affaires");
  });

  it("une affaire déjà perdue — le geste est déjà fait", () => {
    const facts: DeletionFacts = { ...FRESH, status: "lost" };
    expect(deletionVerdict(facts).deletable).toBe(false);
    expect(describeRefusal(facts, deletionVerdict(facts))).toContain(
      "statistiques de perte",
    );
  });

  it("une tâche rattachée", () => {
    expect(deletionVerdict({ ...FRESH, tasks: 1 }).blockers).toEqual(["tasks"]);
  });

  it("cumule les raisons plutôt que de s'arrêter à la première", () => {
    const facts: DeletionFacts = {
      status: "won",
      realActivities: 3,
      notes: 5,
      stageVisits: 4,
      tasks: 2,
    };
    expect(deletionVerdict(facts).blockers).toEqual([
      "activities",
      "stage-moves",
      "closed",
      "tasks",
    ]);
  });
});

describe("le refus renvoie vers le bon geste", () => {
  it("nomme « perdue » et ce qu'elle préserve", () => {
    const facts = { ...FRESH, realActivities: 1 };
    const message = describeRefusal(facts, deletionVerdict(facts));
    expect(message).toContain("Marquez-la perdue");
    expect(message).toMatch(/montant.*historique.*motif/);
  });

  it("ne dit rien quand il n'y a rien à refuser", () => {
    expect(describeRefusal(FRESH, deletionVerdict(FRESH))).toBe("");
  });
});

describe("la confirmation nomme l'affaire et son montant", () => {
  it("plutôt qu'un « Êtes-vous sûr ? » nu", () => {
    const text = describeDeletion("Doublon — Kotto", "6 480 €", deletionVerdict(FRESH));
    expect(text).toContain("« Doublon — Kotto »");
    expect(text).toContain("6 480 €");
    expect(text).not.toContain("Êtes-vous sûr");
  });

  it("annonce ce qui part avec elle", () => {
    const verdict = deletionVerdict({ ...FRESH, notes: 2 });
    expect(describeDeletion("Essai", "0 €", verdict)).toContain("2 note(s) d'historique");
  });
});
