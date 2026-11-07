import { describe, expect, it } from "vitest";
import {
  LOCAL_PARAMS,
  SHARED_PARAMS,
  TABS,
  backTab,
  baseOf,
  listHref,
  one,
  sameHere,
  tabHref,
} from "../board-links";

/**
 * **Les liens des quatre onglets.**
 *
 * Ce fichier existe pour une raison précise : avec quatre onglets qui partagent
 * leurs filtres et des dizaines de chiffres cliquables, il suffit qu'un lien
 * oublie un paramètre pour qu'un clic ouvre la liste d'un **autre** filtrage que
 * celui affiché. Le nombre resterait juste et la liste parlerait d'autre chose —
 * l'écart exact que le jalon 109 a construit tout un module pour fermer.
 */

const FILTERED = {
  periode: "mois",
  campagne: "lemlist:L1",
  canal: "email",
  proprietaire: "Yanis",
  niche: "bijoux",
  fonction: "Direction",
  origine: "lemlist",
  taille: "small",
  // Réglages locaux : ils ne doivent pas suivre d'un onglet à l'autre.
  pas: "mois",
  vue: "canal",
  tri: "taux",
};

describe("les filtres traversent les onglets", () => {
  it("reconduit les dix filtres partagés sur chacun des quatre onglets", () => {
    for (const tab of TABS) {
      const href = tabHref(FILTERED, tab.href);
      const search = new URLSearchParams(href.split("?")[1] ?? "");
      for (const key of SHARED_PARAMS) {
        const expected = one(FILTERED, key);
        if (expected === "") continue;
        expect(search.get(key), `${tab.href} perd ${key}`).toBe(expected);
      }
      expect(href.startsWith(tab.href)).toBe(true);
    }
  });

  /**
   * **Les réglages locaux restent sur place.** Les emporter remplirait l'URL de
   * paramètres qu'aucun autre onglet ne lit, et pire : un `tri=taux` posé sur
   * « Segments » déciderait silencieusement du tri d'un tableau de
   * « Campagnes » qui n'a pas les mêmes colonnes.
   */
  it("laisse les réglages locaux derrière", () => {
    const href = tabHref(FILTERED, "/pilotage/campagnes");
    const search = new URLSearchParams(href.split("?")[1] ?? "");
    for (const key of LOCAL_PARAMS) {
      expect(search.get(key), `${key} a suivi`).toBeNull();
    }
  });

  it("n'écrit aucun paramètre vide", () => {
    expect(tabHref({}, "/pilotage")).toBe("/pilotage");
    expect(tabHref({ canal: "" }, "/pilotage")).toBe("/pilotage");
  });

  it("ne connaît que les quatre onglets du prototype", () => {
    expect(TABS.map((tab) => tab.href)).toEqual([
      "/pilotage",
      "/pilotage/temps",
      "/pilotage/segments",
      "/pilotage/campagnes",
    ]);
  });
});

describe("la liste derrière un chiffre", () => {
  it("emporte tous les filtres courants, et pose la métrique", () => {
    const href = listHref(FILTERED, "replies");
    const search = new URLSearchParams(href.split("?")[1] ?? "");
    expect(href.startsWith("/pilotage/liste?")).toBe(true);
    expect(search.get("metric")).toBe("replies");
    expect(search.get("campagne")).toBe("lemlist:L1");
    expect(search.get("niche")).toBe("bijoux");
  });

  it("resserre sur la ligne cliquée sans perdre le reste", () => {
    const href = listHref(FILTERED, "contacted", { taille: "large" });
    const search = new URLSearchParams(href.split("?")[1] ?? "");
    expect(search.get("taille")).toBe("large");
    expect(search.get("proprietaire")).toBe("Yanis");
  });

  it("retire un filtre quand on lui passe une valeur vide", () => {
    const search = new URLSearchParams(
      listHref(FILTERED, "contacted", { taille: "" }).split("?")[1] ?? "",
    );
    expect(search.get("taille")).toBeNull();
  });

  it("laisse les tris de l'écran qu'on quitte", () => {
    const search = new URLSearchParams(listHref(FILTERED, "messages").split("?")[1] ?? "");
    expect(search.get("tri")).toBeNull();
    expect(search.get("sens")).toBeNull();
  });

  /**
   * **D'où l'on vient voyage dans l'URL.** Sans ce paramètre, le retour de la
   * liste ramenait toujours à la vue d'ensemble : on cliquait un chiffre depuis
   * « Segments » et on se retrouvait sur un autre onglet. L'historique du
   * navigateur ne suffit pas — il n'existe pas quand le lien est partagé.
   */
  it("retient l'onglet d'origine, et retombe sur la vue d'ensemble à défaut", () => {
    const href = listHref(FILTERED, "messages", {}, "/pilotage/segments");
    expect(new URLSearchParams(href.split("?")[1] ?? "").get("retour")).toBe("/pilotage/segments");
    expect(backTab({ retour: "/pilotage/segments" })).toBe("/pilotage/segments");
    expect(backTab({})).toBe("/pilotage");
    // Une valeur inventée ne devient pas une destination.
    expect(backTab({ retour: "https://ailleurs.example" })).toBe("/pilotage");
  });
});

describe("la même page, un réglage changé", () => {
  it("pose, remplace et retire un paramètre", () => {
    const on = sameHere("/pilotage", FILTERED, { part: "1" });
    expect(new URLSearchParams(on.split("?")[1] ?? "").get("part")).toBe("1");
    const off = sameHere("/pilotage", { ...FILTERED, part: "1" }, { part: "" });
    expect(new URLSearchParams(off.split("?")[1] ?? "").get("part")).toBeNull();
  });

  it("lit la première valeur d'un paramètre répété", () => {
    expect(one({ canal: ["email", "call"] }, "canal")).toBe("email");
    expect(one({}, "canal")).toBe("");
    expect(baseOf({ a: "1", b: "" }).toString()).toBe("a=1");
  });
});
