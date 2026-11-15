import { describe, expect, it } from "vitest";
import {
  RELIABILITY_LABELS,
  SIZE_BUCKETS,
  SIZE_LABELS,
  SIZE_ONE,
  SMALL,
  SOLID_FROM,
  WEAK_FROM,
  comparisonLabel,
  isSizeBucket,
  reliabilityLabel,
  reliabilityOf,
  sizeBucketOf,
  tooSmallToRead,
  visitorsBadge,
} from "../size-buckets";

/**
 * **Les deux tranches de travail, et la règle d'échantillon.**
 *
 * Trois choses que ces tests fixent et qu'un relecteur ne verrait pas :
 *
 * 1. **les deux bornes des petites sont inclusives** depuis le jalon 115 :
 *    2 000 et 10 000 sont des petites marques, 10 001 est une grosse. Le choix
 *    compte parce qu'un rond chiffre est précisément ce qu'on saisit quand on
 *    estime, et le ranger des deux côtés selon l'écran serait l'incohérence qui
 *    décrédibilise un tableau ;
 * 2. **« Intermédiaires » n'existe plus.** Ce qui tombait dedans est désormais
 *    une grosse marque, et ce test le fixe pour qu'on sache que le déplacement
 *    est voulu et non subi ;
 * 3. **zéro n'est pas « non renseigné ».** Une marque à 0 visiteur déclaré
 *    tombe dans « Moins de 2 000 » ; `null` seul vaut l'ignorance. C'est la
 *    règle du jalon 20 appliquée à la saisie.
 */

describe("les tranches de taille", () => {
  it("nomme les quatre tranches du brief, au mot près", () => {
    expect(SIZE_BUCKETS).toEqual(["micro", "small", "large", "unknown"]);
    expect(SIZE_LABELS.micro).toBe("Moins de 2 000");
    expect(SIZE_LABELS.small).toBe("Petites marques");
    expect(SIZE_LABELS.large).toBe("Grosses marques");
    expect(SIZE_LABELS.unknown).toBe("Non renseigné");
  });

  it("range selon les bornes, les deux inclusives pour les petites", () => {
    expect(sizeBucketOf(SMALL.min - 1)).toBe("micro");
    expect(sizeBucketOf(SMALL.min)).toBe("small");
    expect(sizeBucketOf(SMALL.max - 1)).toBe("small");
    // Les cinq valeurs du test d'acceptation, dans l'ordre du brief.
    expect(sizeBucketOf(1_999)).toBe("micro");
    expect(sizeBucketOf(2_000)).toBe("small");
    // 10 000 pile : petite, et plus « intermédiaire » comme au jalon 113 v2.
    expect(sizeBucketOf(10_000)).toBe("small");
    expect(sizeBucketOf(10_001)).toBe("large");
    expect(sizeBucketOf(250_000)).toBe("large");
  });

  /**
   * **Ce qui était « intermédiaire » est une grosse marque.**
   *
   * 12 000 visiteurs : « non renseigné » au jalon 109, « intermédiaire » au
   * jalon 113 v2, « grosse » ici. Le test fixe le déplacement pour qu'il soit
   * lisible dans l'historique plutôt que découvert dans une carte.
   */
  it("range l'ancien intervalle intermédiaire chez les grosses", () => {
    expect(sizeBucketOf(10_001)).toBe("large");
    expect(sizeBucketOf(12_000)).toBe("large");
    expect(sizeBucketOf(14_999)).toBe("large");
    expect(sizeBucketOf(15_000)).toBe("large");
    expect(sizeBucketOf(1_500)).toBe("micro");
  });

  /**
   * **La badge d'une fiche parle d'une marque, au singulier.**
   *
   * Et « Trafic non renseigné » plutôt que « 0 visiteurs/mois » : zéro
   * affirmerait un site sans visite là où personne n'a mesuré.
   */
  it("écrit la badge d'une fiche, au singulier et sans inventer de zéro", () => {
    /*
      **L'espace des milliers est une espace insécable fine** (U+202F), ce que
      `toLocaleString("fr-FR")` produit et ce que la typographie française veut :
      « 24 000 » ne doit pas se couper en fin de ligne. Le test l'écrit en clair
      plutôt qu'avec une espace ordinaire, sinon il mesurerait autre chose que ce
      qui s'affiche — et c'est la même espace que `readVisitorCount` accepte en
      entrée, donc la badge se recopie dans le champ sans être refusée.
    */
    expect(visitorsBadge(24_000)).toBe("Grosse marque · 24\u202f000 visiteurs/mois");
    expect(visitorsBadge(8_000)).toBe("Petite marque · 8\u202f000 visiteurs/mois");
    expect(visitorsBadge(900)).toBe("Moins de 2 000 · 900 visiteurs/mois");
    expect(visitorsBadge(null)).toBe("Trafic non renseigné");
    expect(SIZE_ONE.unknown).toBe("Trafic non renseigné");
  });

  it("distingue « non renseigné » de zéro", () => {
    expect(sizeBucketOf(null)).toBe("unknown");
    // Zéro est une **mesure** : une boutique sans visite, pas une inconnue.
    expect(sizeBucketOf(0)).toBe("micro");
  });

  it("reconnaît une clé de tranche, et refuse le reste", () => {
    expect(isSizeBucket("small")).toBe(true);
    expect(isSizeBucket("petites")).toBe(false);
    expect(isSizeBucket("")).toBe(false);
  });

  it("couvre toute la droite des nombres, sans trou", () => {
    // Un trou rendrait une marque inclassable, et c'est exactement le défaut
    // que le jalon 109 avait : l'intervalle 10 000 à 15 000 n'appartenait à
    // aucune tranche nommée.
    for (const value of [0, 1, 1_999, 2_000, 9_999, 10_000, 10_001, 14_999, 15_000, 10_000_000]) {
      expect(SIZE_BUCKETS, String(value)).toContain(sizeBucketOf(value));
      expect(sizeBucketOf(value), String(value)).not.toBe("unknown");
    }
  });
});

describe("la règle d'échantillon", () => {
  it("passe d'« à ne pas interpréter » à « faible » puis « fiable » aux deux seuils", () => {
    expect(reliabilityOf(0)).toBe("unusable");
    expect(reliabilityOf(WEAK_FROM - 1)).toBe("unusable");
    expect(reliabilityOf(WEAK_FROM)).toBe("weak");
    expect(reliabilityOf(SOLID_FROM - 1)).toBe("weak");
    expect(reliabilityOf(SOLID_FROM)).toBe("solid");
    expect(reliabilityOf(4_000)).toBe("solid");
  });

  it("dit « à ne pas interpréter » et non « faible » sous dix", () => {
    // Deux mots différents pour deux états différents : sous dix il n'y a rien
    // à lire, entre dix et trente on peut regarder sans conclure.
    expect(reliabilityLabel(3)).toBe("à ne pas interpréter");
    expect(reliabilityLabel(12)).toBe("échantillon faible");
    expect(reliabilityLabel(90)).toBe("fiable");
    expect(RELIABILITY_LABELS.solid).toBe("fiable");
  });

  it("marque les échantillons illisibles", () => {
    expect(tooSmallToRead(9)).toBe(true);
    expect(tooSmallToRead(10)).toBe(false);
  });
});

describe("la phrase de comparaison", () => {
  it("nomme l'écart sur la plus faible quand les deux échantillons tiennent", () => {
    expect(
      comparisonLabel({ rate: 0.04, n: 120 }, { rate: 0.12, n: 90 }),
    ).toBe("3 fois moins de réponses");
  });

  it("arrondit à un chiffre sous dix, à l'entier au-delà", () => {
    expect(comparisonLabel({ rate: 0.04, n: 40 }, { rate: 0.1, n: 40 })).toBe(
      "2,5 fois moins de réponses",
    );
    expect(comparisonLabel({ rate: 0.01, n: 40 }, { rate: 0.123, n: 40 })).toBe(
      "12 fois moins de réponses",
    );
  });

  /**
   * **Trois refus, et chacun évite une affirmation fausse.** Ce sont eux qui
   * font le travail : la phrase est facile, c'est le silence qui est juste.
   */
  it("se taît sous trente personnes d'un seul côté", () => {
    expect(comparisonLabel({ rate: 0.04, n: 29 }, { rate: 0.12, n: 500 })).toBeNull();
    expect(comparisonLabel({ rate: 0.04, n: 500 }, { rate: 0.12, n: 29 })).toBeNull();
  });

  it("se taît sur un taux nul : « une infinité de fois moins » n'est pas une phrase", () => {
    expect(comparisonLabel({ rate: 0, n: 100 }, { rate: 0.12, n: 100 })).toBeNull();
    expect(comparisonLabel({ rate: 0.04, n: 100 }, { rate: 0, n: 100 })).toBeNull();
  });

  it("se taît sous 1,5 fois : « 1,1 fois moins » est du bruit présenté comme un écart", () => {
    expect(comparisonLabel({ rate: 0.1, n: 100 }, { rate: 0.11, n: 100 })).toBeNull();
    expect(comparisonLabel({ rate: 0.1, n: 100 }, { rate: 0.1, n: 100 })).toBeNull();
  });
});
