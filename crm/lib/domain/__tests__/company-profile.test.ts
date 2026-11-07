import { describe, expect, it } from "vitest";
import {
  NICHE_MAX,
  NICHE_VARIABLES,
  VISITORS_VARIABLES,
  cleanNiche,
  nicheKey,
  nicheSuggestions,
  pickVariable,
  readVisitorCount,
  syncMayWrite,
  valueSourceLabel,
  variableKey,
} from "../company-profile";

/**
 * **La niche, le trafic, et qui a le droit de les écrire.**
 *
 * Les trois règles de ce module valent chacune une perte de données évitée, et
 * les tests sont écrits dans ce sens : pas « la fonction rend ce qu'elle rend »,
 * mais « voilà la donnée qu'on aurait perdue ».
 */

describe("la niche", () => {
  it("rogne et réduit les espaces, sans toucher à la casse", () => {
    // La casse est gardée parce que c'est la donnée de quelqu'un : normaliser
    // l'affichage pour simplifier le regroupement abîme la donnée pour
    // arranger le code.
    expect(cleanNiche("  Soins   visage ")).toBe("Soins visage");
    expect(cleanNiche("BIJOUX")).toBe("BIJOUX");
    expect(cleanNiche("   ")).toBe("");
  });

  it("borne la longueur : au-delà c'est une phrase, pas une niche", () => {
    expect(cleanNiche("x".repeat(200))).toHaveLength(NICHE_MAX);
  });

  it("regroupe sans la casse ni les accents", () => {
    expect(nicheKey("Bijoux")).toBe(nicheKey("bijoux"));
    expect(nicheKey("Beauté")).toBe(nicheKey("beaute"));
    expect(nicheKey("Soins  Visage")).toBe(nicheKey("soins visage"));
    expect(nicheKey("  ")).toBe("");
  });

  /**
   * **La variante proposée est la plus fréquente, pas la première vue.**
   *
   * Proposer « bijoux » à quelqu'un qui a toujours écrit « Bijoux » le pousse à
   * créer la variante qu'on cherche justement à éviter.
   */
  it("propose la variante la plus fréquente, triée par usage", () => {
    const out = nicheSuggestions(["bijoux", "Bijoux", "Bijoux", "Soins visage", "", "   "]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ label: "Bijoux", count: 3 });
    expect(out[1]).toMatchObject({ label: "Soins visage", count: 1 });
  });
});

describe("le trafic mensuel", () => {
  it("lit les quatre formes du brief", () => {
    expect(readVisitorCount("8000")).toBe(8_000);
    expect(readVisitorCount("8 000")).toBe(8_000);
    expect(readVisitorCount("8k")).toBe(8_000);
    expect(readVisitorCount("8K")).toBe(8_000);
  });

  /**
   * Et quatre formes de plus qu'un vrai compte contient : l'espace insécable
   * que Google Sheets produit, le séparateur de milliers, le `k` décimal, le
   * suffixe `M`. Les refuser perdrait de la donnée réelle.
   */
  it("lit aussi l'insécable, les milliers, le k décimal et le M", () => {
    expect(readVisitorCount("8 000")).toBe(8_000);
    expect(readVisitorCount("8 000")).toBe(8_000);
    expect(readVisitorCount("8.000")).toBe(8_000);
    expect(readVisitorCount("8,000")).toBe(8_000);
    expect(readVisitorCount("1.234.567")).toBe(1_234_567);
    expect(readVisitorCount("8,5k")).toBe(8_500);
    expect(readVisitorCount("8.5k")).toBe(8_500);
    expect(readVisitorCount("1,2M")).toBe(1_200_000);
  });

  /**
   * **Jamais zéro sur une valeur illisible.** Zéro rangerait la marque dans
   * « Moins de 2 000 » sur la foi d'un point d'interrogation, et la ferait
   * entrer dans une population qu'elle ne décrit pas.
   */
  it("rend null sur tout ce qui n'est pas un nombre, jamais zéro", () => {
    for (const raw of ["", "   ", "?", "à voir", "gros site", "beaucoup", "8 000 visiteurs", "-3", "8.0000", "8.000k", "k"]) {
      expect(readVisitorCount(raw), raw).toBeNull();
    }
  });

  it("lit zéro quand c'est écrit zéro", () => {
    expect(readVisitorCount("0")).toBe(0);
  });

  it("refuse l'absurde plutôt que de le stocker", () => {
    expect(readVisitorCount("9999M")).toBeNull();
  });
});

describe("les variables du lead", () => {
  it("compare les noms sans casse, accents ni séparateurs", () => {
    expect(variableKey("Visiteurs mensuels")).toBe("visiteursmensuels");
    expect(variableKey("NICHE")).toBe("niche");
    expect(variableKey("trafic_mensuel")).toBe("traficmensuel");
  });

  it("trouve la niche quel que soit l'habillage du nom", () => {
    expect(pickVariable({ Niche: "Bijoux" }, NICHE_VARIABLES)).toBe("Bijoux");
    expect(pickVariable({ NICHE: "Bijoux" }, NICHE_VARIABLES)).toBe("Bijoux");
    expect(pickVariable({ "niche-marche": "Bijoux" }, NICHE_VARIABLES)).toBe("Bijoux");
  });

  it("trouve le trafic, et laisse le nom exact gagner sur le synonyme", () => {
    expect(pickVariable({ Visiteurs: "8k", Trafic: "12k" }, VISITORS_VARIABLES)).toBe("8k");
    expect(pickVariable({ monthlyVisitors: "8000" }, VISITORS_VARIABLES)).toBe("8000");
  });

  it("ne confond pas un nom voisin avec le bon : jamais de sous-chaîne", () => {
    // « visiteurs_annuels » n'est pas le trafic mensuel : une recherche par
    // sous-chaîne le ferait passer pour tel, et diviserait le chiffre par douze
    // sans que personne le sache.
    expect(pickVariable({ visiteurs_annuels: "96000" }, VISITORS_VARIABLES)).toBe("");
  });

  it("saute une variable vide au profit de la suivante", () => {
    expect(pickVariable({ niche: "   ", secteur: "Beauté" }, NICHE_VARIABLES)).toBe("Beauté");
  });
});

describe("qui a le droit d'écrire", () => {
  it("écrit sur du vide, quelle que soit l'origine", () => {
    expect(syncMayWrite({ filled: false, source: "" })).toBe(true);
    expect(syncMayWrite({ filled: false, source: "crm" })).toBe(true);
  });

  it("rafraîchit ce qu'elle a posé elle-même", () => {
    // Refuser figerait un trafic de l'an dernier : lemlist est la source de
    // vérité de ce qu'elle a importé.
    expect(syncMayWrite({ filled: true, source: "lemlist" })).toBe(true);
  });

  /**
   * **Le cas qui justifie tout le module.** Sans ce refus, une correction tapée
   * à 10 h 02 serait remplacée au relevé de 10 h 15, sans trace et sans
   * message. La personne recommencerait, puis cesserait de corriger.
   */
  it("n'écrase jamais une valeur du CRM", () => {
    expect(syncMayWrite({ filled: true, source: "crm" })).toBe(false);
  });

  it("n'écrase pas non plus une valeur d'origine inconnue", () => {
    // Devant une provenance qu'on ignore, écraser est le geste irréversible ;
    // garder ne coûte qu'un import de moins.
    expect(syncMayWrite({ filled: true, source: "" })).toBe(false);
  });

  it("nomme les origines en français, et rend l'inconnu tel quel", () => {
    expect(valueSourceLabel("crm")).toBe("saisi dans le CRM");
    expect(valueSourceLabel("lemlist")).toBe("importé de lemlist");
    expect(valueSourceLabel("zapier")).toBe("zapier");
  });
});
