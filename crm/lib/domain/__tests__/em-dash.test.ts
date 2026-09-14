import { describe, expect, it } from "vitest";
import { hasDash, stripDashes } from "../em-dash";

describe("le nettoyage ne déborde pas sur les lignes intactes", () => {
  it("laisse la virgule de l'appel — le défaut du jalon 68", () => {
    /*
      « Une virgule en fin de ligne ne ponctue plus rien » est juste pour une
      virgule que cette fonction vient de poser. Appliquée à toutes les lignes,
      elle mangeait l'appel de **chaque** brouillon depuis le jalon 58.
    */
    expect(stripDashes("Bonjour Roxana,\n\nUn texte.")).toBe("Bonjour Roxana,\n\nUn texte.");
  });

  it("un texte sans aucun tiret ressort identique à l'octet près", () => {
    const texte = "Bonjour Roxana,\n\nUne phrase, puis une autre,\net une fin de ligne,";
    expect(stripDashes(texte)).toBe(texte);
  });

  it("mais le tiret disparaît toujours, et sa virgule orpheline avec lui", () => {
    expect(stripDashes("Un texte —\nsuite")).toBe("Un texte\nsuite");
    expect(stripDashes("Bonjour Roxana,\n\nun mot — un autre.")).toBe(
      "Bonjour Roxana,\n\nun mot, un autre.",
    );
    expect(hasDash(stripDashes("a — b – c"))).toBe(false);
  });
});
