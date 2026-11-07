import { describe, expect, it } from "vitest";
import {
  LARGE_MIN,
  MICRO_MAX,
  MID,
  RELIABILITY_LABELS,
  SIZE_BUCKETS,
  SIZE_LABELS,
  SMALL,
  SOLID_FROM,
  WEAK_FROM,
  comparisonLabel,
  isSizeBucket,
  reliabilityLabel,
  reliabilityOf,
  sizeBucketOf,
  tooSmallToRead,
} from "../size-buckets";

/**
 * **Les cinq tranches, et la règle d'échantillon.**
 *
 * Deux choses que ces tests fixent et qu'un relecteur ne verrait pas :
 *
 * 1. **les bornes sont inclusives en bas, exclusives en haut.** 10 000 pile est
 *    « intermédiaire », pas « petite ». Le choix compte parce qu'un rond chiffre
 *    est précisément ce qu'on saisit quand on estime, et le ranger des deux
 *    côtés selon l'écran serait l'incohérence qui décrédibilise un tableau ;
 * 2. **zéro n'est pas « non renseigné ».** Une marque à 0 visiteur déclaré
 *    tombe dans « Moins de 2 000 » ; `null` seul vaut l'ignorance. C'est la
 *    règle du jalon 20 appliquée à la saisie.
 */

describe("les tranches de taille", () => {
  it("nomme les cinq tranches du prototype, au mot près", () => {
    expect(SIZE_BUCKETS).toEqual(["micro", "small", "mid", "large", "unknown"]);
    expect(SIZE_LABELS.micro).toBe("Moins de 2 000");
    expect(SIZE_LABELS.small).toBe("Petites 2 000 à 10 000");
    expect(SIZE_LABELS.mid).toBe("Intermédiaires 10 000 à 15 000");
    expect(SIZE_LABELS.large).toBe("Grosses 15 000 et plus");
    expect(SIZE_LABELS.unknown).toBe("Non renseigné");
  });

  it("range selon les bornes, inclusives en bas et exclusives en haut", () => {
    expect(sizeBucketOf(MICRO_MAX - 1)).toBe("micro");
    expect(sizeBucketOf(SMALL.min)).toBe("small");
    expect(sizeBucketOf(SMALL.max - 1)).toBe("small");
    // 10 000 pile : intermédiaire, et pas petite.
    expect(sizeBucketOf(SMALL.max)).toBe("mid");
    expect(sizeBucketOf(MID.max - 1)).toBe("mid");
    expect(sizeBucketOf(LARGE_MIN)).toBe("large");
    expect(sizeBucketOf(250_000)).toBe("large");
  });

  /**
   * **Le creux du jalon 109 est comblé.**
   *
   * 12 000 visiteurs comptaient dans « non renseigné » parce que le brief
   * d'alors ne décrivait pas l'intervalle. Le prototype le nomme : la valeur
   * change de tranche, et ce test fixe le changement pour qu'on sache qu'il est
   * voulu.
   */
  it("range maintenant 12 000 en « intermédiaires », et non en non renseigné", () => {
    expect(sizeBucketOf(12_000)).toBe("mid");
    expect(sizeBucketOf(1_500)).toBe("micro");
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
    for (const value of [0, 1, 1_999, 2_000, 9_999, 10_000, 14_999, 15_000, 10_000_000]) {
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
