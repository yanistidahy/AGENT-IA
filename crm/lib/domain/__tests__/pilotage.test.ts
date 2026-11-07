import { describe, expect, it } from "vitest";
import {
  ALL_OPEN,
  DEFAULT_TARGETS,
  FUNNEL_STAGES,
  METRICS,
  NO_FILTER,
  applyFilters,
  breakdown,
  customPeriod,
  funnel,
  inPeriod,
  messagesSent,
  metricResult,
  newlyContacted,
  parisWeek,
  peopleMessaged,
  progress,
  qualifiedDemos,
  rateLabel,
  replyRate,
  uncategorisedReplies,
  type EventRow,
  type Metric,
} from "../pilotage";
import type { OutreachChannel, OutreachType } from "../outreach";

/**
 * Les définitions du pilotage, une par fonction, toutes pures.
 *
 * Elles prennent une horloge et un tableau de lignes : les tests tournent donc
 * sans base, et un chiffre se vérifie à la main. C'est la condition pour que
 * l'écran n'ait plus rien à calculer — `tests/pilotage-source.test.ts` échoue si
 * une page s'y remet.
 */

let seq = 0;

function row(
  contactId: string,
  type: OutreachType,
  iso: string,
  extra: Partial<EventRow> = {},
): EventRow {
  seq += 1;
  return {
    id: `e${seq}`,
    contactId,
    contactName: contactId,
    companyName: "Maison",
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

/* ------------------------------------------------------- les tranches ----- */

/*
  **Les tranches de taille ont déménagé au jalon 113 v2.**

  Elles vivaient ici avec trois valeurs, et rangeaient l'intervalle 10 000 à
  15 000 dans « non renseigné » faute d'un brief qui le nomme. Le prototype
  validé en nomme cinq : la règle et ses tests sont désormais dans
  `size-buckets.test.ts`, avec la règle d'échantillon que les quatre onglets
  lisent aussi.
*/

/* ------------------------------------------------------- les périodes ----- */

describe("la semaine de Paris", () => {
  /** Jeudi 5 novembre 2026, 14 h à Paris (13 h UTC). */
  const now = new Date("2026-11-05T13:00:00.000Z");

  it("commence le lundi et finit le dimanche soir", () => {
    const week = parisWeek(now);
    // Lundi 2 novembre, minuit à Paris = 23:00 UTC le 1er.
    expect(week.start.toISOString()).toBe("2026-11-01T23:00:00.000Z");
    // Borne **exclue** : lundi 9 novembre à minuit.
    expect(week.end.toISOString()).toBe("2026-11-08T23:00:00.000Z");
    expect(inPeriod(now, week)).toBe(true);
  });

  it("recule d'une semaine entière sans trou ni recouvrement", () => {
    const week = parisWeek(now);
    const before = parisWeek(now, 1);
    expect(before.end.getTime()).toBe(week.start.getTime());
    expect(inPeriod(week.start, before)).toBe(false);
  });

  /**
   * Un dimanche appartient à la semaine qui vient de s'écouler, pas à celle qui
   * s'ouvre : `parisWall().weekday` compte le dimanche à 0, et une arithmétique
   * naïve l'enverrait six jours en avant.
   */
  it("rattache le dimanche à la semaine qui finit", () => {
    const sunday = new Date("2026-11-08T18:00:00.000Z");
    const week = parisWeek(sunday);
    expect(week.start.toISOString()).toBe("2026-11-01T23:00:00.000Z");
    expect(inPeriod(sunday, week)).toBe(true);
  });

  it("borne une plage libre au jour, fin exclue, même à l'envers", () => {
    const direct = customPeriod(new Date("2026-11-02T10:00:00Z"), new Date("2026-11-03T22:00:00Z"));
    const reversed = customPeriod(
      new Date("2026-11-03T22:00:00Z"),
      new Date("2026-11-02T10:00:00Z"),
    );
    expect(reversed.start.toISOString()).toBe(direct.start.toISOString());
    expect(reversed.end.toISOString()).toBe(direct.end.toISOString());
    // Le 4 à minuit est dehors, le 3 à 23:59:59,400 est dedans (jalon 59).
    expect(inPeriod(new Date("2026-11-03T22:59:59.400Z"), direct)).toBe(true);
    expect(inPeriod(direct.end, direct)).toBe(false);
  });
});

/* ------------------------------------------------------- les chiffres ----- */

describe("messages et personnes", () => {
  /**
   * **Le cas nommé par le test d'acceptation** : une personne relancée trois
   * fois dans la semaine fait trois messages et une seule nouvelle personne
   * contactée. Les deux chiffres mesurent deux choses — l'effort et
   * l'ouverture de nouvelles portes — et les confondre rendrait l'un des deux
   * faux.
   */
  it("compte trois messages et une personne pour trois relances", () => {
    const rows = [
      row("c1", "message_sent", "2026-11-02T09:00:00Z"),
      row("c1", "message_sent", "2026-11-04T09:00:00Z"),
      row("c1", "message_sent", "2026-11-05T09:00:00Z"),
    ];
    const week = parisWeek(new Date("2026-11-05T13:00:00Z"));

    expect(messagesSent(rows)).toHaveLength(3);
    expect(peopleMessaged(rows)).toEqual(["c1"]);
    expect(newlyContacted(rows, week)).toEqual(["c1"]);
  });

  it("compte l'invitation LinkedIn comme un message, pas l'acceptation", () => {
    const rows = [
      row("c1", "linkedin_invite_sent", "2026-11-02T09:00:00Z", { channel: "linkedin_invite" }),
      row("c1", "linkedin_invite_accepted", "2026-11-03T09:00:00Z", {
        channel: "linkedin_invite",
      }),
    ];
    expect(messagesSent(rows)).toHaveLength(1);
  });

  /**
   * « Nouvelle personne » se juge sur **toute** l'histoire : une personne
   * approchée en septembre et relancée cette semaine n'est pas nouvelle.
   */
  it("ne compte pas comme neuve une personne déjà touchée avant la période", () => {
    const all = [
      row("vieux", "message_sent", "2026-09-01T09:00:00Z"),
      row("vieux", "message_sent", "2026-11-04T09:00:00Z"),
      row("neuf", "message_sent", "2026-11-04T09:30:00Z"),
    ];
    const week = parisWeek(new Date("2026-11-05T13:00:00Z"));
    expect(newlyContacted(all, week)).toEqual(["neuf"]);
  });
});

describe("taux de réponse", () => {
  const week = parisWeek(new Date("2026-11-05T13:00:00Z"));

  it("divise les personnes qui ont répondu par les personnes contactées", () => {
    const rows = [
      row("a", "message_sent", "2026-11-02T09:00:00Z"),
      row("b", "message_sent", "2026-11-02T09:00:00Z"),
      row("c", "message_sent", "2026-11-02T09:00:00Z"),
      row("d", "message_sent", "2026-11-02T09:00:00Z"),
      row("a", "reply_received", "2026-11-03T09:00:00Z"),
      // Deux réponses de la même personne ne font pas deux répondants.
      row("a", "reply_received", "2026-11-04T09:00:00Z"),
    ];
    expect(replyRate(rows)).toBe(0.25);
    expect(rateLabel(replyRate(rows))).toBe("25 %");
    expect(inPeriod(rows[0]!.occurredAt, week)).toBe(true);
  });

  /**
   * **« 0 % » affirme un échec de conversion ; ici il n'y a rien à convertir.**
   * C'est la règle du jalon 20, et la raison pour laquelle le taux est
   * `number | null` et non `number`.
   */
  it("ne rend aucun taux sans personne contactée", () => {
    expect(replyRate([])).toBeNull();
    expect(replyRate([row("a", "reply_received", "2026-11-03T09:00:00Z")])).toBeNull();
    expect(rateLabel(null)).toBe("—");
  });

  it("compte les réponses sans catégorie, et ne les range dans aucune", () => {
    const rows = [
      row("a", "message_sent", "2026-11-02T09:00:00Z"),
      row("a", "reply_received", "2026-11-03T09:00:00Z"),
      row("b", "message_sent", "2026-11-02T09:00:00Z"),
      row("b", "reply_received", "2026-11-03T09:00:00Z", { replyCategory: "interested" }),
    ];
    expect(replyRate(rows)).toBe(1);
    expect(uncategorisedReplies(rows)).toHaveLength(1);
    const positive = metricResult(rows, rows, parisWeek(new Date("2026-11-05T13:00:00Z")), "positive");
    expect(positive.count).toBe(1);
  });
});

describe("démo qualifiée", () => {
  const week = parisWeek(new Date("2026-11-05T13:00:00Z"));

  /**
   * Le cas de l'acceptation nº 4 : envoyée, testée, retour reçu → qualifiée ;
   * retirer le retour la déqualifie, sans seconde règle à tenir à jour.
   */
  it("exige les trois faits, et les trois seulement", () => {
    const sent = row("c1", "demo_sent", "2026-11-02T09:00:00Z");
    const tested = row("c1", "demo_tested", "2026-11-03T09:00:00Z");
    const feedback = row("c1", "feedback_received", "2026-11-04T09:00:00Z");

    expect(qualifiedDemos([sent, tested], week)).toEqual([]);
    expect(qualifiedDemos([sent, tested, feedback], week)).toEqual(["c1"]);
    // Le retour retiré : la qualification tombe d'elle-même.
    expect(qualifiedDemos([sent, tested], week)).toEqual([]);
  });

  /**
   * **La qualification date du dernier des trois pas.** La dater de l'envoi la
   * ferait tomber dans une semaine où le retour n'existait pas encore, et le
   * chiffre d'une semaine déjà close changerait après coup.
   */
  it("date la qualification du dernier pas franchi", () => {
    const all = [
      row("c1", "demo_sent", "2026-10-20T09:00:00Z"),
      row("c1", "demo_tested", "2026-10-21T09:00:00Z"),
      row("c1", "feedback_received", "2026-11-04T09:00:00Z"),
    ];
    expect(qualifiedDemos(all, week)).toEqual(["c1"]);
    expect(qualifiedDemos(all, parisWeek(new Date("2026-10-22T13:00:00Z")))).toEqual([]);
  });
});

/* ------------------------------------------------------- l'entonnoir ------ */

describe("entonnoir", () => {
  const week = parisWeek(new Date("2026-11-05T13:00:00Z"));
  const rows = [
    row("a", "message_sent", "2026-11-02T09:00:00Z"),
    row("a", "message_sent", "2026-11-03T09:00:00Z"),
    row("b", "message_sent", "2026-11-02T09:00:00Z"),
    row("c", "message_sent", "2026-11-02T09:00:00Z"),
    row("d", "message_sent", "2026-11-02T09:00:00Z"),
    row("a", "reply_received", "2026-11-03T10:00:00Z", { replyCategory: "interested" }),
    row("b", "reply_received", "2026-11-03T10:00:00Z", { replyCategory: "not_now" }),
    row("a", "demo_sent", "2026-11-04T10:00:00Z"),
    row("a", "demo_tested", "2026-11-04T11:00:00Z"),
    row("a", "feedback_received", "2026-11-04T12:00:00Z"),
    row("a", "trial_started", "2026-11-05T09:00:00Z"),
  ];

  it("compte des personnes, pas des événements", () => {
    const steps = funnel(rows, rows, week);
    const byStage = new Map(steps.map((step) => [step.stage, step.contactIds.length]));

    expect(byStage.get("contacted")).toBe(4);
    expect(byStage.get("replied")).toBe(2);
    expect(byStage.get("positive")).toBe(1);
    expect(byStage.get("demo_sent")).toBe(1);
    expect(byStage.get("qualified")).toBe(1);
    expect(byStage.get("trial")).toBe(1);
    expect(byStage.get("customer")).toBe(0);
  });

  it("rend les huit marches demandées, dans l'ordre", () => {
    expect([...FUNNEL_STAGES]).toEqual([
      "contacted",
      "replied",
      "positive",
      "demo_sent",
      "demo_tested",
      "qualified",
      "trial",
      "customer",
    ]);
    expect(funnel(rows, rows, week)).toHaveLength(8);
  });

  it("ne rend aucune part quand personne n'a été contacté", () => {
    for (const step of funnel([], [], week)) expect(step.share).toBeNull();
  });
});

/* ------------------------------------------- un nombre, une seule liste --- */

describe("un chiffre et la liste qu'il ouvre", () => {
  const week = parisWeek(new Date("2026-11-05T13:00:00Z"));
  const rows = [
    row("a", "message_sent", "2026-11-02T09:00:00Z"),
    row("a", "message_sent", "2026-11-03T09:00:00Z"),
    row("b", "message_sent", "2026-11-02T09:00:00Z"),
    row("a", "reply_received", "2026-11-03T10:00:00Z", { replyCategory: "interested" }),
    row("a", "demo_sent", "2026-11-04T10:00:00Z"),
    row("a", "demo_tested", "2026-11-04T11:00:00Z"),
    row("a", "feedback_received", "2026-11-04T12:00:00Z"),
  ];

  /**
   * **L'item 6 du test d'acceptation, rendu vrai par construction.**
   *
   * `count` vaut `rows.length` dans tous les cas : il n'existe pas un comptage
   * « pour la pastille » et une requête « pour la liste », donc aucun ordre
   * d'appel ne peut les séparer.
   */
  it("fait du nombre la longueur de sa liste, pour les huit métriques", () => {
    for (const metric of METRICS) {
      const result = metricResult(rows, rows, week, metric as Metric);
      expect(result.rows.length, metric).toBe(result.count);
    }
  });

  it("ouvre la liste qui parle du chiffre cliqué", () => {
    // « Ont répondu » ouvre des réponses, pas les premiers messages.
    const replied = metricResult(rows, rows, week, "replies");
    expect(replied.rows.every((line) => line.type === "reply_received")).toBe(true);
    // « Messages » compte les événements : deux pour la même personne.
    expect(metricResult(rows, rows, week, "messages").count).toBe(3);
    expect(metricResult(rows, rows, week, "contacted").count).toBe(2);
    expect(metricResult(rows, rows, week, "qualified").count).toBe(1);
  });
});

/* --------------------------------------------- filtres et regroupements --- */

describe("filtres", () => {
  const rows = [
    row("a", "message_sent", "2026-11-02T09:00:00Z", {
      campaignId: "k1",
      campaignName: "Novembre",
      owner: "Yanis",
      size: "small",
    }),
    row("b", "message_sent", "2026-11-02T09:00:00Z", {
      campaignId: "k2",
      campaignName: "Décembre",
      owner: "Mohamed",
      size: "large",
      channel: "linkedin_invite",
    }),
  ];

  it("croise les sept axes, et laisse tout passer à vide", () => {
    const none = ALL_OPEN;
    expect(applyFilters(rows, none)).toHaveLength(2);
    expect(applyFilters(rows, { ...none, owner: "Yanis" })).toHaveLength(1);
    expect(applyFilters(rows, { ...none, channel: "linkedin_invite" })).toHaveLength(1);
    expect(applyFilters(rows, { ...none, size: "large", owner: "Yanis" })).toHaveLength(0);
  });
});

describe("attribution de campagne", () => {
  /**
   * Sans cette règle, le tableau « Campagnes côte à côte » afficherait 0
   * réponse et 0 % partout : un échec affirmé là où la donnée n'était pas
   * rattachée. La réponse appartient à la campagne du message auquel elle
   * répond.
   */
  it("donne à une réponse la campagne du dernier message parti avant elle", () => {
    const rows = applyFilters(
      [
        row("a", "message_sent", "2026-11-02T09:00:00Z", { campaignId: "k1", campaignName: "Nov" }),
        row("a", "reply_received", "2026-11-03T10:00:00Z"),
      ],
      // Le filtre compare désormais la **clé** de campagne, préfixée par son
      // outil (jalon 111) : c'est elle que le regroupement produit, et un
      // filtre qui comparerait l'identifiant brut ne retiendrait rien.
      { ...ALL_OPEN, campaignId: "crm:k1" },
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]!.type).toBe("reply_received");
    expect(rows[1]!.campaignName).toBe("Nov");
  });

  it("laisse hors campagne ce qui précède tout message", () => {
    const rows = applyFilters(
      [
        row("a", "reply_received", "2026-11-01T10:00:00Z"),
        row("a", "message_sent", "2026-11-02T09:00:00Z", { campaignId: "k1", campaignName: "Nov" }),
      ],
      ALL_OPEN,
    );
    expect(rows[0]!.campaignId).toBeNull();
  });

  /** Un message écrit hors campagne n'en rejoint aucune : il n'a rien produit pour elle. */
  it("n'attribue jamais une campagne à un message qui n'en a pas", () => {
    const rows = applyFilters(
      [
        row("a", "message_sent", "2026-11-02T09:00:00Z", { campaignId: "k1", campaignName: "Nov" }),
        row("a", "message_sent", "2026-11-03T09:00:00Z"),
      ],
      ALL_OPEN,
    );
    expect(rows[1]!.campaignId).toBeNull();
  });
});

describe("regroupements", () => {
  const week = parisWeek(new Date("2026-11-05T13:00:00Z"));
  const rows = [
    row("a", "message_sent", "2026-11-02T09:00:00Z", { campaignId: "k1", campaignName: "Nov" }),
    row("a", "message_sent", "2026-11-03T09:00:00Z", { campaignId: "k1", campaignName: "Nov" }),
    row("a", "reply_received", "2026-11-03T10:00:00Z", { campaignId: "k1", campaignName: "Nov" }),
    row("b", "message_sent", "2026-11-02T09:00:00Z", { campaignId: "k2", campaignName: "Déc" }),
  ];

  it("rend les mêmes colonnes pour chaque ligne, et les mêmes définitions", () => {
    const lines = breakdown(rows, rows, week, (line) => ({
      key: line.campaignId ?? "hors",
      label: line.campaignName,
    }));
    const nov = lines.find((line) => line.key === "k1");
    expect(nov?.messages).toBe(2);
    expect(nov?.contacted).toBe(1);
    expect(nov?.replies).toBe(1);
    expect(nov?.replyRate).toBe(1);
    const dec = lines.find((line) => line.key === "k2");
    expect(dec?.replyRate).toBe(0);
  });
});

/*
  **La série hebdomadaire a disparu au jalon 113**, avec `weeklySeries`,
  `WeekPoint`, `weekLabel` et `components/pilotage/weekly-chart.tsx`. Ses deux
  tests vivent désormais dans `lib/domain/__tests__/timeline.test.ts`, sur les
  fonctions qui l'ont remplacée — et l'un des deux a changé de sens exprès :
  « dessine aussi les semaines vides » affirmait la course de zéros du début,
  que le jalon 113 retire précisément parce qu'elle réglait l'échelle sur du
  vide. Les zéros **de l'intérieur** restent, et `trimLeadingEmpty` le vérifie.
*/

describe("cibles hebdomadaires", () => {
  it("part sur 100 messages, 10 démos, 5 qualifiées", () => {
    expect(DEFAULT_TARGETS).toEqual({ messages: 100, demos: 10, qualified: 5 });
  });

  /**
   * Dépasser est une information : la part n'est pas plafonnée, seule la barre
   * l'est à l'affichage. Et `0` vaut « pas de cible » — sans cette convention,
   * une cible posée une fois ne pourrait plus être retirée.
   */
  it("ne plafonne pas le dépassement et accepte l'absence de cible", () => {
    expect(progress(120, 100)).toBe(1.2);
    expect(progress(0, 100)).toBe(0);
    expect(progress(12, 0)).toBeNull();
    expect(progress(12, -1)).toBeNull();
  });
});
