import { describe, expect, it } from "vitest";
import {
  FRESH_DAYS,
  RETRY_MINUTES,
  isStaleAt,
  researchCard,
  describeUngrounded,
  isStale,
  isUsable,
  ungroundedClaims,
  usableFacts,
  type Research,
} from "../research";

const fact = (detail: string, sourceUrl = "https://minimiil.com") => ({
  label: "produit",
  detail,
  sourceUrl,
});

const research = (over: Partial<Research> = {}): Research => ({
  gap: null,
  summary: "Shots probiotiques pour enfants, vendus par abonnement.",
  facts: [fact("Shots probiotiques pour enfants"), fact("Vente par abonnement mensuel")],
  sources: [{ url: "https://minimiil.com", title: "minimiil" }],
  fetchedAt: new Date("2026-09-01T10:00:00Z"),
  ...over,
});

describe("un fait sans source n'est pas un fait", () => {
  it("les faits sans URL sont écartés avant d'atteindre le prompt", () => {
    // Le modèle peut rendre un fait parfaitement plausible sans l'avoir lu :
    // c'est exactement le mode de défaillance qu'on craint.
    const kept = usableFacts([
      fact("Shots probiotiques pour enfants"),
      { label: "modèle", detail: "Probablement du DTC", sourceUrl: "" },
      { label: "modèle", detail: "Inventé", sourceUrl: "pas-une-url" },
    ]);
    expect(kept).toHaveLength(1);
  });

  it("un fait vide ne compte pas non plus", () => {
    expect(usableFacts([fact("   ")])).toHaveLength(0);
  });
});

describe("ce qui rend une recherche exploitable", () => {
  it("il faut deux faits, pas un", () => {
    // Un seul fait produit l'accroche générique qu'on cherche à quitter.
    expect(isUsable(research())).toBe(true);
    expect(isUsable(research({ facts: [fact("Shots probiotiques")] }))).toBe(false);
  });

  it("un manque nommé rend la recherche inexploitable, quoi qu'elle porte", () => {
    expect(isUsable(research({ gap: "unreachable" }))).toBe(false);
    expect(isUsable(research({ gap: "no-domain" }))).toBe(false);
  });

  it("une recherche périmée reste exploitable", () => {
    // La péremption déclenche une relecture, pas un appauvrissement : une
    // marque change rarement de métier en un trimestre.
    const old = research({ fetchedAt: new Date("2026-01-01T00:00:00Z") });
    const now = new Date("2026-09-01T00:00:00Z");
    expect(isStale(old, now)).toBe(true);
    expect(isUsable(old)).toBe(true);
    expect(isStale(research({ fetchedAt: now }), now)).toBe(false);
    expect(FRESH_DAYS).toBeGreaterThan(0);
  });
});

describe("le garde-fou des affirmations produit", () => {
  const corpus =
    "minimiil propose des shots probiotiques pour enfants, en abonnement mensuel. " +
    "Convient dès 3 ans.";

  it("une affirmation appuyée sur ce qui a été lu ne déclenche rien", () => {
    const body = "Vos shots probiotiques posent aux parents mille questions.";
    expect(ungroundedClaims(body, corpus)).toEqual([]);
  });

  it("une affirmation absente des pages lues est signalée, avec sa phrase", () => {
    // Le cas qui coûte un prospect : parler de bougies à une marque qui n'en
    // vend pas.
    const body = "Bonjour,\n\nVotre gamme de bougies parfumées mérite mieux.";
    const claims = ungroundedClaims(body, corpus);
    expect(claims.map((claim) => claim.word)).toContain("bougie");
    expect(claims[0]?.sentence).toContain("bougies parfumées");
  });

  it("la garde reste étroite : elle ne signale pas une phrase sans produit", () => {
    // Une alerte qui sonne sur chaque brouillon est une alerte qu'on apprend à
    // ignorer (jalon 62).
    const body =
      "Bonjour Annouk,\n\nLa plupart des visiteurs partent sans poser leur question.";
    expect(ungroundedClaims(body, corpus)).toEqual([]);
  });

  it("le mot doit être entier", () => {
    // « thé » ne doit pas se reconnaître dans « théorie », ni « sac » dans
    // « sachant ».
    expect(ungroundedClaims("En théorie, sachant cela, c'est utile.", corpus)).toEqual([]);
  });

  it("le pluriel compte comme le singulier", () => {
    expect(ungroundedClaims("Vos vitamines.", corpus).map((c) => c.word)).toEqual(["vitamine"]);
  });

  it("sans corpus, toute affirmation produit est signalée", () => {
    // C'est le cas du repli générique : s'il parle d'un produit, c'est une
    // invention par construction.
    expect(ungroundedClaims("Vos compléments alimentaires.", "").length).toBeGreaterThan(0);
  });

  it("la phrase d'alerte nomme les mots, et se tait quand il n'y a rien", () => {
    expect(describeUngrounded([])).toBeNull();
    const message = describeUngrounded(ungroundedClaims("Vos bougies.", corpus));
    expect(message).toContain("bougie");
    expect(message).toContain("À vérifier avant d'envoyer");
  });
});

describe("la carte : trois états qui ne se confondent pas", () => {
  it("aucune société rattachée, et aucun site : deux phrases, un même état", () => {
    expect(researchCard(null).state).toBe("none");
    expect(researchCard(null).headline).toContain("Aucune société");
    const noSite = researchCard(research({ gap: "no-domain", facts: [], sources: [] }));
    expect(noSite.state).toBe("none");
    expect(noSite.headline).toBe("Aucun site connu sur la fiche");
  });

  it("un échec porte sa raison exacte, jamais une phrase tiède", () => {
    // C'est le défaut qui a coûté une journée : une recherche cassée et une
    // société sans site se lisaient pareil.
    const card = researchCard(
      research({ gap: "failed", summary: "L'API a refusé la requête (400)", facts: [] }),
    );
    expect(card.state).toBe("failed");
    expect(card.detail).toContain("400");
  });

  it("un échec sans raison enregistrée le dit plutôt que de se taire", () => {
    expect(researchCard(research({ gap: "failed", summary: "", facts: [] })).detail).toBe(
      "raison non enregistrée",
    );
  });

  it("une lecture compte ses sources, au singulier comme au pluriel", () => {
    expect(researchCard(research()).headline).toBe("Recherche effectuée, 1 source lue");
    const two = researchCard(
      research({
        sources: [
          { url: "https://minimiil.com", title: "a" },
          { url: "https://minimiil.com/b", title: "b" },
        ],
      }),
    );
    expect(two.headline).toBe("Recherche effectuée, 2 sources lues");
  });

  it("un seul fait ne fait pas une lecture : c'est un échec, et il est nommé", () => {
    const card = researchCard(research({ facts: [fact("Shots probiotiques")] }));
    expect(card.state).toBe("failed");
  });
});

describe("un échec ne se garde pas comme un résultat", () => {
  const now = new Date("2026-09-01T12:00:00Z");

  it("il est périmé au bout de la fenêtre de reprise, pas au bout de 90 jours", () => {
    const fresh = new Date(now.getTime() - (RETRY_MINUTES - 5) * 60 * 1000);
    const aged = new Date(now.getTime() - (RETRY_MINUTES + 5) * 60 * 1000);
    expect(isStaleAt(fresh, now, "failed")).toBe(false);
    expect(isStaleAt(aged, now, "failed")).toBe(true);
    // Une lecture réussie du même âge, elle, reste fraîche : sans cela on
    // repaierait chaque demi-heure.
    expect(isStaleAt(aged, now, null)).toBe(false);
  });
});
