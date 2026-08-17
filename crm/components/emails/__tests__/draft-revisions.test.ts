import { describe, expect, it } from "vitest";
import { isEdited, MAX_VERSIONS, popVersion, pushVersion } from "../draft-revisions";

/**
 * La pile de versions du brouillon.
 *
 * Ce qu'elle protège : demander une reprise et perdre une bonne phrase. On
 * accepte une révision parce qu'elle améliore trois lignes, et on s'aperçoit
 * après coup qu'elle en a abîmé une quatrième — sans pile, il ne reste qu'à
 * réécrire de mémoire.
 */
const v = (subject: string, body: string) => ({ subject, body });

describe("pile de versions", () => {
  it("empile, et restaure la plus récente", () => {
    const history = pushVersion(pushVersion([], v("A", "un")), v("B", "deux"));
    const popped = popVersion(history);
    expect(popped?.restored).toEqual(v("B", "deux"));
    expect(popped?.rest).toEqual([v("A", "un")]);
  });

  it("garde au moins trois versions", () => {
    let history = pushVersion([], v("1", "un"));
    history = pushVersion(history, v("2", "deux"));
    history = pushVersion(history, v("3", "trois"));
    expect(history).toHaveLength(3);
    expect(MAX_VERSIONS).toBeGreaterThanOrEqual(3);
  });

  it("borne la pile plutôt que de la laisser grossir", () => {
    let history: ReturnType<typeof pushVersion> = [];
    for (let index = 0; index < MAX_VERSIONS + 4; index += 1) {
      history = pushVersion(history, v(`s${index}`, `b${index}`));
    }
    expect(history).toHaveLength(MAX_VERSIONS);
    // Ce sont les plus **récentes** qui restent : remonter de deux crans doit
    // fonctionner, remonter de dix n'intéresse personne.
    expect(history[history.length - 1]).toEqual(v(`s${MAX_VERSIONS + 3}`, `b${MAX_VERSIONS + 3}`));
  });

  it("n'empile pas deux fois la même version", () => {
    // Demander deux fois la même chose ne doit pas consommer un cran de pile au
    // détriment d'une version réellement différente.
    const once = pushVersion([], v("A", "un"));
    expect(pushVersion(once, v("A", "un"))).toEqual(once);
  });

  it("rend null quand il n'y a rien à restaurer", () => {
    expect(popVersion([])).toBeNull();
  });
});

describe("détection des retouches manuelles", () => {
  it("repère une modification du corps", () => {
    const history = [v("Objet", "Bonjour,\n\nUn mot.")];
    expect(isEdited(history, v("Objet", "Bonjour,\n\nUn mot."))).toBe(false);
    expect(isEdited(history, v("Objet", "Bonjour,\n\nUn mot réécrit."))).toBe(true);
  });

  it("repère une modification de l'objet", () => {
    const history = [v("Objet", "corps")];
    expect(isEdited(history, v("Autre objet", "corps"))).toBe(true);
  });

  it("ne prétend rien sur une pile vide", () => {
    expect(isEdited([], v("Objet", "corps"))).toBe(false);
  });
});
