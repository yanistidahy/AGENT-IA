import { describe, expect, it } from "vitest";
import {
  compareCards,
  contactedBars,
  nicheLines,
  rateSeries,
  restrictToSize,
  segmentBuckets,
  sizeCard,
  sizesWithData,
  toNicheSort,
  toRateMode,
  visitorCoverage,
} from "../segments";
import { customPeriod, type EventRow } from "../pilotage";
import type { OutreachChannel, OutreachType as Type } from "../outreach";
import type { SizeBucket } from "../size-buckets";

/**
 * **L'onglet « Segments », et la discipline qui l'empêche de mentir.**
 *
 * Chaque test ci-dessous fixe une façon précise de tromper quelqu'un avec des
 * chiffres justes : un taux sans dénominateur, une comparaison sur trois
 * personnes, une courbe hebdomadaire qui raconte du hasard, une niche d'une
 * personne en tête du tableau.
 */

let seq = 0;

function row(
  contactId: string | null,
  type: Type,
  iso: string,
  extra: Partial<EventRow> = {},
): EventRow {
  seq += 1;
  return {
    id: `e${seq}`,
    contactId,
    contactName: contactId ?? "Sans contact",
    companyName: contactId === null ? "" : `Marque ${contactId}`,
    campaignId: null,
    campaignName: "",
    extCampaignId: "",
    extCampaignName: "",
    channel: "email" as OutreachChannel,
    type,
    occurredAt: new Date(iso),
    owner: "Yanis",
    source: "crm",
    replyCategory: "",
    size: "unknown",
    niche: "",
    stepIndex: null,
    stepType: "",
    group: "Non classé",
    ...extra,
  };
}

/** Deux semaines pleines de novembre 2026, bornes de Paris. */
const PERIOD = customPeriod(new Date("2026-11-02T12:00:00Z"), new Date("2026-11-15T12:00:00Z"));

/* ------------------------------------------------------ les deux cartes ---- */

describe("une carte de tranche", () => {
  const rows = [
    row("a", "message_sent", "2026-11-03T09:00:00Z", { size: "small", companyName: "Alpha" }),
    row("a", "reply_received", "2026-11-04T09:00:00Z", { size: "small", companyName: "Alpha" }),
    row("b", "message_sent", "2026-11-03T09:00:00Z", { size: "small", companyName: "Beta" }),
    row("c", "message_sent", "2026-11-03T09:00:00Z", { size: "large", companyName: "Gamma" }),
  ];

  it("compte les marques distinctes, pas les lignes", () => {
    const card = sizeCard(rows, rows, PERIOD, "small");
    // Trois lignes sur deux marques : Alpha compte une fois.
    expect(card.brands).toEqual(["Alpha", "Beta"]);
  });

  it("fait porter au taux son numérateur et son dénominateur", () => {
    const card = sizeCard(rows, rows, PERIOD, "small");
    expect(card.contacted).toEqual(["a", "b"]);
    expect(card.replied).toEqual(["a"]);
    expect(card.rate).toBe(0.5);
    // Deux personnes : à ne pas interpréter, et la carte le dit.
    expect(card.reliability).toBe("unusable");
  });

  it("ne mélange pas les tranches", () => {
    expect(sizeCard(rows, rows, PERIOD, "large").contacted).toEqual(["c"]);
    expect(sizeCard(rows, rows, PERIOD, "micro").contacted).toEqual([]);
  });

  it("rend un entonnoir qui parle des mêmes gens que son taux", () => {
    const card = sizeCard(rows, rows, PERIOD, "small");
    const contacted = card.steps.find((step) => step.stage === "contacted");
    const replied = card.steps.find((step) => step.stage === "replied");
    expect(contacted?.contactIds).toEqual(["a", "b"]);
    expect(replied?.contactIds).toEqual(["a"]);
  });
});

describe("la comparaison des deux cartes", () => {
  /** Quarante personnes de chaque côté, pour franchir le seuil de trente. */
  function population(size: SizeBucket, people: number, repliers: number): EventRow[] {
    const out: EventRow[] = [];
    for (let index = 0; index < people; index += 1) {
      const id = `${size}-${index}`;
      out.push(row(id, "message_sent", "2026-11-03T09:00:00Z", { size }));
      if (index < repliers) out.push(row(id, "reply_received", "2026-11-04T09:00:00Z", { size }));
    }
    return out;
  }

  it("pose la phrase sur la plus faible, et sur elle seule", () => {
    const rows = [...population("small", 40, 12), ...population("large", 40, 4)];
    const cards = [sizeCard(rows, rows, PERIOD, "small"), sizeCard(rows, rows, PERIOD, "large")];
    const out = compareCards(cards[0]!, cards[1]!);
    expect(out).toEqual({ bucket: "large", label: "3 fois moins de réponses" });
  });

  it("se taît quand un échantillon est sous trente", () => {
    const rows = [...population("small", 40, 12), ...population("large", 12, 1)];
    const cards = [sizeCard(rows, rows, PERIOD, "small"), sizeCard(rows, rows, PERIOD, "large")];
    expect(compareCards(cards[0]!, cards[1]!)).toBeNull();
  });
});

/* -------------------------------------------------------- les séries ------- */

describe("l'évolution du taux", () => {
  const rows = [
    // Semaine 1 : deux personnes, une réponse.
    row("a", "message_sent", "2026-11-03T09:00:00Z", { size: "small" }),
    row("a", "reply_received", "2026-11-04T09:00:00Z", { size: "small" }),
    row("b", "message_sent", "2026-11-03T09:00:00Z", { size: "small" }),
    // Semaine 2 : deux personnes, aucune réponse.
    row("c", "message_sent", "2026-11-10T09:00:00Z", { size: "small" }),
    row("d", "message_sent", "2026-11-10T09:00:00Z", { size: "small" }),
  ];
  const buckets = segmentBuckets(rows, "semaine", new Date("2026-11-13T12:00:00Z"));

  it("commence à la première période qui porte quelque chose", () => {
    expect(buckets).toHaveLength(2);
  });

  /**
   * **Le cumulé se stabilise, la période seule saute.** C'est pour cela que le
   * cumulé est le défaut : un taux hebdomadaire sur deux personnes passe de
   * 50 % à 0 % parce qu'une personne a répondu, et la courbe raconte alors du
   * hasard avec l'autorité d'un graphique.
   */
  it("cumule depuis le début en mode cumulé", () => {
    const line = rateSeries(rows, buckets, "small", "cumule");
    expect(line.points.map((point) => point.n)).toEqual([2, 4]);
    expect(line.points.map((point) => point.rate)).toEqual([0.5, 0.25]);
  });

  it("borne chaque point à sa période en mode période", () => {
    const line = rateSeries(rows, buckets, "small", "periode");
    expect(line.points.map((point) => point.n)).toEqual([2, 2]);
    expect(line.points.map((point) => point.rate)).toEqual([0.5, 0]);
  });

  it("marque chaque point comme illisible sous dix personnes", () => {
    const line = rateSeries(rows, buckets, "small", "periode");
    expect(line.points.every((point) => point.reliability === "unusable")).toBe(true);
  });

  it("rend un taux nul plutôt que zéro quand il n'y a rien à convertir", () => {
    const line = rateSeries(rows, buckets, "large", "cumule");
    // La règle du jalon 20 : « 0 % » affirmerait un échec, alors qu'aucune
    // grosse marque n'a été contactée.
    expect(line.points.every((point) => point.rate === null)).toBe(true);
    expect(line.points.every((point) => point.n === 0)).toBe(true);
  });

  it("garde les deux vocabulaires sûrs face à une URL abîmée", () => {
    expect(toRateMode("periode")).toBe("periode");
    expect(toRateMode("n'importe quoi")).toBe("cumule");
    expect(toNicheSort("taux")).toBe("taux");
    expect(toNicheSort("")).toBe("contactees");
  });
});

describe("les personnes contactées en barres groupées", () => {
  const rows = [
    row("a", "message_sent", "2026-11-03T09:00:00Z", { size: "small" }),
    row("b", "message_sent", "2026-11-03T09:00:00Z", { size: "large" }),
    row("c", "message_sent", "2026-11-10T09:00:00Z", { size: "small" }),
  ];
  const buckets = segmentBuckets(rows, "semaine", new Date("2026-11-13T12:00:00Z"));

  it("rend une valeur par tranche demandée, dans l'ordre reçu", () => {
    const bars = contactedBars(rows, buckets, ["small", "large"]);
    expect(bars).toHaveLength(2);
    expect(bars[0]?.values.map((value) => value.bucket)).toEqual(["small", "large"]);
    expect(bars[0]?.values.map((value) => value.count)).toEqual([1, 1]);
    expect(bars[1]?.values.map((value) => value.count)).toEqual([1, 0]);
    expect(bars[0]?.total).toBe(2);
  });
});

/* --------------------------------------------------------- par niche ------- */

describe("le tableau par niche", () => {
  const rows = [
    row("a", "message_sent", "2026-11-03T09:00:00Z", { niche: "Bijoux", size: "small" }),
    row("a", "reply_received", "2026-11-04T09:00:00Z", { niche: "Bijoux", size: "small" }),
    row("b", "message_sent", "2026-11-03T09:00:00Z", { niche: "bijoux", size: "small" }),
    row("c", "message_sent", "2026-11-03T09:00:00Z", { niche: "", size: "large" }),
  ];
  const buckets = segmentBuckets(rows, "semaine", new Date("2026-11-13T12:00:00Z"));

  it("plie la casse : « Bijoux » et « bijoux » font une seule ligne", () => {
    const lines = nicheLines(rows, rows, PERIOD, buckets, "contactees");
    const bijoux = lines.find((line) => line.label.toLowerCase() === "bijoux");
    expect(bijoux?.contacted).toBe(2);
    expect(lines).toHaveLength(2);
  });

  it("nomme la niche absente au lieu de la masquer", () => {
    const lines = nicheLines(rows, rows, PERIOD, buckets, "contactees");
    const unnamed = lines.find((line) => line.key === "non-renseignee");
    // Quarante fiches sans niche est une information actionnable ; une ligne
    // vide se lirait comme un défaut d'affichage.
    expect(unnamed?.label).toBe("Niche non renseignée");
    expect(unnamed?.contacted).toBe(1);
  });

  /**
   * **Un taux absent se range en bas, pas en haut.** Une comparaison naïve sur
   * `null` ferait du vide le meilleur résultat du tableau.
   */
  it("range les taux absents en fin de tri par taux", () => {
    const silent = [
      row("x", "demo_sent", "2026-11-03T09:00:00Z", { niche: "Vide" }),
      ...rows,
    ];
    const lines = nicheLines(silent, silent, PERIOD, buckets, "taux");
    expect(lines[lines.length - 1]?.label).toBe("Vide");
  });

  it("porte une tendance cumulée, de la même définition que la courbe", () => {
    const lines = nicheLines(rows, rows, PERIOD, buckets, "contactees");
    const bijoux = lines.find((line) => line.label.toLowerCase() === "bijoux");
    expect(bijoux?.trend).toHaveLength(buckets.length);
    expect(bijoux?.trend[0]).toBe(0.5);
  });
});

/* ------------------------------------------------------- la couverture ----- */

describe("le bandeau de couverture", () => {
  const rows = [
    row("a", "message_sent", "2026-11-03T09:00:00Z", { size: "small" }),
    row("b", "message_sent", "2026-11-03T09:00:00Z", { size: "large" }),
    row("c", "message_sent", "2026-11-03T09:00:00Z", { size: "unknown" }),
    // Une réponse n'est pas un message : elle ne gonfle pas le dénominateur.
    row("d", "reply_received", "2026-11-03T09:00:00Z", { size: "unknown" }),
  ];

  it("compte les personnes de la période, et non les marques en base", () => {
    const out = visitorCoverage(rows);
    expect(out.total).toEqual(["a", "b", "c"]);
    expect(out.known).toEqual(["a", "b"]);
    expect(out.share).toBeCloseTo(2 / 3);
  });

  it("rend une part nulle plutôt que zéro quand personne n'a été contacté", () => {
    expect(visitorCoverage([]).share).toBeNull();
  });
});

describe("les tranches affichées", () => {
  const rows = [
    row("a", "message_sent", "2026-11-03T09:00:00Z", { size: "mid" }),
    row("b", "message_sent", "2026-11-03T09:00:00Z", { size: "unknown" }),
  ];

  it("ne garde que les tranches qui portent quelqu'un, dans l'ordre donné", () => {
    // C'est ce qui réalise « Moins de 2 000 affichée seulement si non vide » :
    // une tranche vide n'est pas une information, c'est une case à ne pas
    // dessiner.
    expect(sizesWithData(rows, ["mid", "unknown", "micro"])).toEqual(["mid", "unknown"]);
  });

  it("restreint à une tranche, ou laisse tout passer", () => {
    expect(restrictToSize(rows, "mid")).toHaveLength(1);
    expect(restrictToSize(rows, null)).toHaveLength(2);
  });
});
