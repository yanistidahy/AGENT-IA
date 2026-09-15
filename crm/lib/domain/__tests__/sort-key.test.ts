import { describe, expect, it } from "vitest";
import { byName, compareKeys, sortKey } from "../sort-key";

describe("la clé de tri plie les accents et la casse", () => {
  it("« Élixir », « elixir » et « ELIXIR » produisent la même clé", () => {
    expect(sortKey(["Élixir"])).toBe("elixir");
    expect(sortKey(["elixir"])).toBe("elixir");
    expect(sortKey(["ELIXIR"])).toBe("elixir");
  });

  it("« Édition » tombe entre « Eden » et « Effet », jamais après Z", () => {
    // C'est le cas qui condamne la collation `C.UTF-8` du serveur : en ordre
    // d'octets, « Édition » passe après « Zèbre ».
    const noms = ["Zèbre", "Effet", "Édition", "Eden", "Alpha"];
    const ordre = byName(noms, (nom) => sortKey([nom]));
    expect(ordre).toEqual(["Alpha", "Eden", "Édition", "Effet", "Zèbre"]);
  });

  it("l'alphabet latin au-delà du français est couvert", () => {
    expect(sortKey(["Ångström"])).toBe("angstrom");
    // « ł » n'est pas un accent combinant : NFD le laisse, et son point de code
    // passe après « z ». Sans la table de lettres, ce nom se classerait après
    // tout l'alphabet.
    expect(sortKey(["Skłodowska"])).toBe("sklodowska");
    expect(sortKey(["Œuvre"])).toBe("oeuvre");
    expect(byName(["Zèbre", "Łukasz", "Alpha"], (n) => sortKey([n]))).toEqual([
      "Alpha",
      "Łukasz",
      "Zèbre",
    ]);
  });

  it("plusieurs morceaux se joignent dans l'ordre donné", () => {
    // Nom puis prénom : c'est l'ordre d'un CRM, et il décide du tri à l'intérieur
    // d'une même maison.
    expect(sortKey(["Rouvier", "Camille"])).toBe("rouvier camille");
  });
});

describe("l'absence de nom va en fin de liste", () => {
  it("une valeur vide rend null, jamais la chaîne vide", () => {
    // `""` est le plus petit préfixe de tout : stockée, elle classerait les
    // fiches sans nom **en tête**, en poussant les vraies entrées vers le bas.
    expect(sortKey([""])).toBeNull();
    expect(sortKey(["   "])).toBeNull();
    expect(sortKey([null, undefined])).toBeNull();
  });

  it("null se classe après tout le monde, dans les deux sens", () => {
    expect(compareKeys(null, "alpha")).toBe(1);
    expect(compareKeys("zebre", null)).toBe(-1);
    expect(compareKeys(null, null)).toBe(0);
  });

  it("une liste mêlée range les sans-nom à la fin", () => {
    const rows = [
      { nom: "", key: sortKey([""]) },
      { nom: "Zèbre", key: sortKey(["Zèbre"]) },
      { nom: "Alpha", key: sortKey(["Alpha"]) },
    ];
    expect(byName(rows, (row) => row.key).map((row) => row.nom)).toEqual(["Alpha", "Zèbre", ""]);
  });
});

describe("le comparateur ne dépend d'aucune locale", () => {
  it("il compare des clés déjà pliées, pas des chaînes brutes", () => {
    // `localeCompare` suivrait la locale du processus — celle du conteneur,
    // pas celle de l'utilisateur — et ferait varier l'ordre d'un environnement
    // à l'autre, ce qu'on vient d'écarter côté serveur.
    expect(compareKeys(sortKey(["Édition"]), sortKey(["Effet"]))).toBe(-1);
    expect(compareKeys(sortKey(["ELIXIR"]), sortKey(["elixir"]))).toBe(0);
  });
});
