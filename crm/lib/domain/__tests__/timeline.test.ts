import { describe, expect, it } from "vitest";
import {
  bucketsBetween,
  buildSeries,
  channelsWithData,
  dayBucket,
  gapLabel,
  isParisWeekday,
  monthBucket,
  nextBucket,
  peakOf,
  pointValue,
  shareLabel,
  targetFor,
  toGranularity,
  toTimelineMetric,
  toTimelineView,
  trimLeadingEmpty,
  weekBucket,
  weekPace,
  weeklyTargetFor,
  workdaysIn,
  type Bucket,
  type TimelinePoint,
} from "../timeline";
import { metricResult, slice, type EventRow } from "../pilotage";
import type { OutreachChannel } from "../outreach";

/**
 * **Les seaux, les cibles et la série, éprouvés sans base.**
 *
 * Pur : une horloge est injectée partout, donc les tests sont déterministes et
 * un chiffre se vérifie à la main.
 */

let seq = 0;
function row(
  iso: string,
  extra: Partial<EventRow> = {},
): EventRow {
  seq += 1;
  return {
    id: `e${seq}`,
    contactId: `p${seq}`,
    contactName: `p${seq}`,
    companyName: "",
    campaignId: null,
    campaignName: "",
    extCampaignId: "",
    extCampaignName: "",
    channel: "email",
    type: "message_sent",
    occurredAt: new Date(iso),
    owner: "Yanis",
    source: "crm",
    replyCategory: "",
    size: "unknown",
    niche: "",
    stepIndex: null,
    stepType: "",
    group: "autre",
    ...extra,
  };
}

/* --------------------------------------------------------- les vocabulaires */

describe("les vocabulaires de la barre d'outils", () => {
  it("retombent sur un défaut sûr plutôt que de lever", () => {
    expect(toGranularity("jour")).toBe("jour");
    expect(toGranularity("mois")).toBe("mois");
    expect(toGranularity("trimestre")).toBe("semaine");
    expect(toGranularity("")).toBe("semaine");

    expect(toTimelineView("canal")).toBe("canal");
    expect(toTimelineView("empile")).toBe("total");

    expect(toTimelineMetric("replies")).toBe("replies");
    // « Démos qualifiées » ne se trace pas : voir TIMELINE_METRICS.
    expect(toTimelineMetric("qualified")).toBe("messages");
    expect(toTimelineMetric("")).toBe("messages");
  });
});

/* ------------------------------------------------------------- les seaux --- */

describe("les seaux de temps", () => {
  /**
   * **Les dates exactes, parce que l'infobulle ne doit rien laisser deviner.**
   * « semaine du 2 nov. » ne dit pas si le dimanche est dedans.
   */
  it("une semaine va du lundi au dimanche, et le dit", () => {
    // Mercredi 4 novembre 2026.
    const bucket = weekBucket(new Date("2026-11-04T15:00:00Z"));
    expect(bucket.fromKey).toBe("2026-11-02");
    expect(bucket.toKey).toBe("2026-11-08");
    expect(bucket.exact).toContain("lun.");
    expect(bucket.exact).toContain("dim.");
    expect(bucket.exact).toContain("2 nov.");
    expect(bucket.exact).toContain("8 nov.");
    // La borne haute est exclusive : minuit du lundi suivant.
    expect(bucket.end.getTime() - bucket.start.getTime()).toBe(7 * 86_400_000);
  });

  it("un jour est un jour de Paris", () => {
    const bucket = dayBucket(new Date("2026-11-04T23:30:00Z"));
    // 23h30 UTC un 4 novembre, c'est déjà le 5 à Paris (UTC+1 en hiver).
    expect(bucket.fromKey).toBe("2026-11-05");
    expect(bucket.toKey).toBe("2026-11-05");
    expect(bucket.end.getTime() - bucket.start.getTime()).toBe(86_400_000);
  });

  it("un mois couvre exactement son mois, février compris", () => {
    const nov = monthBucket(new Date("2026-11-17T12:00:00Z"));
    expect(nov.fromKey).toBe("2026-11-01");
    expect(nov.toKey).toBe("2026-11-30");

    const feb = monthBucket(new Date("2027-02-10T12:00:00Z"));
    expect(feb.fromKey).toBe("2027-02-01");
    expect(feb.toKey).toBe("2027-02-28");

    const leap = monthBucket(new Date("2028-02-10T12:00:00Z"));
    expect(leap.toKey).toBe("2028-02-29");
  });

  it("le seau suivant ne saute ni ne recouvre", () => {
    for (const granularity of ["jour", "semaine", "mois"] as const) {
      const first = granularity === "mois"
        ? monthBucket(new Date("2026-11-15T12:00:00Z"))
        : granularity === "semaine"
          ? weekBucket(new Date("2026-11-04T12:00:00Z"))
          : dayBucket(new Date("2026-11-04T12:00:00Z"));
      const second = nextBucket(first, granularity);
      expect(second.start.getTime(), granularity).toBe(first.end.getTime());
    }
  });

  it("couvre une plage sans trou, et garde les plus récents quand c'est trop long", () => {
    const from = new Date("2026-09-01T12:00:00Z");
    const to = new Date("2026-11-30T12:00:00Z");

    const months = bucketsBetween(from, to, "mois");
    expect(months.map((bucket) => bucket.key)).toEqual(["m:2026-09", "m:2026-10", "m:2026-11"]);

    const weeks = bucketsBetween(from, to, "semaine");
    expect(weeks.length).toBeGreaterThanOrEqual(13);
    // Aucun trou : chaque seau commence où le précédent finit.
    for (let index = 1; index < weeks.length; index += 1) {
      expect(weeks[index]!.start.getTime()).toBe(weeks[index - 1]!.end.getTime());
    }

    const days = bucketsBetween(from, to, "jour", 10);
    expect(days).toHaveLength(10);
    // Les dix derniers, pas les dix premiers : ce sont ceux qu'on regarde.
    expect(days[days.length - 1]!.fromKey).toBe("2026-11-30");
  });
});

/* ------------------------------------------------------------ les cibles --- */

describe("la cible suit la granularité", () => {
  const monday = weekBucket(new Date("2026-11-02T12:00:00Z"));

  it("la semaine porte la cible telle quelle", () => {
    expect(targetFor(monday, "semaine", 100)).toBe(100);
  });

  /** Item 5 : 20 en jour ouvré. */
  it("un jour ouvré vaut le cinquième, le week-end n'a pas de cible", () => {
    const mon = dayBucket(new Date("2026-11-02T12:00:00Z"));
    const fri = dayBucket(new Date("2026-11-06T12:00:00Z"));
    const sat = dayBucket(new Date("2026-11-07T12:00:00Z"));
    const sun = dayBucket(new Date("2026-11-08T12:00:00Z"));

    expect(targetFor(mon, "jour", 100)).toBe(20);
    expect(targetFor(fri, "jour", 100)).toBe(20);
    // Pas de cible le week-end : le produit n'envoie pas (jalon 93), et en
    // tracer une afficherait un retard que personne n'a décidé.
    expect(targetFor(sat, "jour", 100)).toBeNull();
    expect(targetFor(sun, "jour", 100)).toBeNull();
  });

  /** Item 5 : la cible mensuelle suit le nombre de semaines ouvrées. */
  it("un mois vaut la cible fois ses semaines ouvrées", () => {
    const nov = monthBucket(new Date("2026-11-15T12:00:00Z"));
    expect(workdaysIn(nov)).toBe(21);
    expect(targetFor(nov, "mois", 100)).toBe(420);

    const feb = monthBucket(new Date("2027-02-10T12:00:00Z"));
    expect(workdaysIn(feb)).toBe(20);
    expect(targetFor(feb, "mois", 100)).toBe(400);

    // Deux mois qui ne se ressemblent pas n'ont pas la même cible : c'est tout
    // l'intérêt de compter les jours ouvrés plutôt que d'écrire « 4 semaines ».
    expect(targetFor(nov, "mois", 100)).not.toBe(targetFor(feb, "mois", 100));
  });

  it("aucune cible quand l'indicateur n'en a pas", () => {
    expect(targetFor(monday, "semaine", null)).toBeNull();
    expect(targetFor(monday, "semaine", 0)).toBeNull();

    const targets = { messages: 100, demos: 10, qualified: 5 };
    expect(weeklyTargetFor("messages", targets)).toBe(100);
    expect(weeklyTargetFor("replies", targets)).toBeNull();
    expect(weeklyTargetFor("new_contacted", targets)).toBeNull();
  });

  it("sait reconnaître un jour ouvré au fuseau de Paris", () => {
    expect(isParisWeekday(new Date("2026-11-02T12:00:00Z"))).toBe(true);
    expect(isParisWeekday(new Date("2026-11-07T12:00:00Z"))).toBe(false);
    // 23h30 UTC un vendredi, c'est samedi à Paris.
    expect(isParisWeekday(new Date("2026-11-06T23:30:00Z"))).toBe(false);
  });
});

/* ------------------------------------------------------------- la série ---- */

describe("la série", () => {
  const buckets = bucketsBetween(
    new Date("2026-10-05T12:00:00Z"),
    new Date("2026-11-08T12:00:00Z"),
    "semaine",
  );

  /**
   * **L'item 3 du test d'acceptation, prouvé par construction.** La valeur du
   * point et la longueur de la liste qu'il ouvre sortent du même appel.
   */
  it("la valeur d'un point est la longueur de la liste qu'il ouvre", () => {
    const all = [
      row("2026-11-03T09:00:00Z"),
      row("2026-11-04T09:00:00Z"),
      row("2026-11-05T09:00:00Z"),
      row("2026-10-20T09:00:00Z"),
    ];
    for (const bucket of buckets) {
      for (const metric of ["messages", "new_contacted", "replies"] as const) {
        const value = pointValue(all, bucket, metric);
        const listed = metricResult(all, slice(all, bucket), bucket, metric);
        expect(value, `${bucket.key} / ${metric}`).toBe(listed.rows.length);
      }
    }
  });

  /**
   * **Et dans la vue « Par canal » aussi** : chaque canal est recompté par le
   * même chemin, sur l'histoire réduite à ce canal. Diviser le total aurait
   * donné un nombre qui ne correspond à aucune liste.
   */
  it("la valeur d'un canal est la longueur de sa liste", () => {
    const all = [
      row("2026-11-03T09:00:00Z", { channel: "email" }),
      row("2026-11-03T10:00:00Z", { channel: "linkedin_message" }),
      row("2026-11-04T09:00:00Z", { channel: "email" }),
    ];
    const series = buildSeries(all, buckets, "messages", "semaine", 100);
    const week = series.find((point) => point.bucket.fromKey === "2026-11-02");
    expect(week).toBeDefined();

    for (const channel of ["email", "linkedin_message"] as OutreachChannel[]) {
      const onlyChannel = all.filter((candidate) => candidate.channel === channel);
      const listed = metricResult(
        onlyChannel,
        slice(onlyChannel, week!.bucket),
        week!.bucket,
        "messages",
      );
      expect(week!.byChannel[channel], channel).toBe(listed.rows.length);
    }
    expect(week!.total).toBe(3);
    expect(week!.byChannel.email).toBe(2);
    expect(week!.byChannel.linkedin_message).toBe(1);
  });

  /**
   * **La somme des canaux n'est pas forcément le total**, et c'est exact pour
   * « nouvelles personnes contactées » : quelqu'un touché par deux canaux la
   * même semaine est nouveau une fois dans le total, et une fois sur chacun des
   * deux canaux — c'est sa première touche sur chacun.
   */
  it("ne prétend pas que les canaux font 100 % pour « nouvelles personnes »", () => {
    const all = [
      row("2026-11-03T09:00:00Z", { contactId: "p1", channel: "email" }),
      row("2026-11-03T10:00:00Z", { contactId: "p1", channel: "linkedin_message" }),
    ];
    const series = buildSeries(all, buckets, "new_contacted", "semaine", null);
    const week = series.find((point) => point.bucket.fromKey === "2026-11-02")!;
    expect(week.total).toBe(1);
    expect(week.byChannel.email).toBe(1);
    expect(week.byChannel.linkedin_message).toBe(1);
    // La part affichée est donc 100 % de chaque côté, et c'est ce que
    // `shareLabel` rend — sans affirmer que la somme fait le total.
    expect(shareLabel(week.byChannel.email, week.total)).toBe("100 %");
  });

  it("porte la répartition par origine", () => {
    const all = [
      row("2026-11-03T09:00:00Z", { source: "crm" }),
      row("2026-11-03T10:00:00Z", { source: "lemlist" }),
      row("2026-11-04T10:00:00Z", { source: "lemlist" }),
      row("2026-11-04T11:00:00Z", { source: "manual" }),
    ];
    const series = buildSeries(all, buckets, "messages", "semaine", 100);
    const week = series.find((point) => point.bucket.fromKey === "2026-11-02")!;
    expect(week.bySource).toEqual({ crm: 1, lemlist: 2, manual: 1 });
  });

  it("porte le total du seau précédent, et rien pour le premier", () => {
    const all = [row("2026-10-20T09:00:00Z"), row("2026-11-03T09:00:00Z")];
    const series = buildSeries(all, buckets, "messages", "semaine", 100);
    expect(series[0]!.previous).toBeNull();
    for (let index = 1; index < series.length; index += 1) {
      expect(series[index]!.previous).toBe(series[index - 1]!.total);
    }
  });
});

/* --------------------------------------------- la course de zéros du début - */

describe("la plage commence là où les données commencent", () => {
  function point(total: number, key: string): TimelinePoint {
    const bucket = { key, fromKey: key, toKey: key } as Bucket;
    return {
      bucket,
      total,
      byChannel: { email: total, linkedin_invite: 0, linkedin_message: 0, whatsapp: 0, call: 0, other: 0 },
      bySource: {},
      target: 100,
      previous: null,
    };
  }

  /**
   * Le défaut nommé par le jalon : dix colonnes vides à gauche, et une échelle
   * réglée sur du vide.
   */
  it("retire les périodes vides d'avant le premier fait", () => {
    const trimmed = trimLeadingEmpty([
      point(0, "a"),
      point(0, "b"),
      point(44, "c"),
      point(349, "d"),
    ]);
    expect(trimmed.map((entry) => entry.bucket.key)).toEqual(["c", "d"]);
  });

  /** Un creux au milieu dit quelque chose : il reste. */
  it("garde les périodes vides de l'intérieur", () => {
    const trimmed = trimLeadingEmpty([point(5, "a"), point(0, "b"), point(7, "c")]);
    expect(trimmed.map((entry) => entry.total)).toEqual([5, 0, 7]);
  });

  it("rend telle quelle une série entièrement vide", () => {
    const trimmed = trimLeadingEmpty([point(0, "a"), point(0, "b")]);
    expect(trimmed).toHaveLength(2);
  });

  /**
   * Le premier point conservé perd son « précédent » : un écart contre une
   * période retirée de l'écran serait trompeur.
   */
  it("efface le précédent du premier point conservé", () => {
    const series = [point(0, "a"), { ...point(44, "c"), previous: 0 }];
    expect(trimLeadingEmpty(series)[0]!.previous).toBeNull();
  });

  it("ne liste que les canaux qui portent quelque chose", () => {
    const series: TimelinePoint[] = [
      {
        ...point(3, "a"),
        byChannel: { email: 2, linkedin_invite: 0, linkedin_message: 1, whatsapp: 0, call: 0, other: 0 },
      },
    ];
    expect(channelsWithData(series)).toEqual(["email", "linkedin_message"]);
  });

  it("fait tenir la cible dans l'échelle de la vue Total", () => {
    const series = [point(30, "a")];
    expect(peakOf(series, "total", [])).toBe(100);
    // En vue « Par canal », la cible ne s'applique pas : l'échelle suit les
    // canaux visibles.
    expect(peakOf(series, "canal", ["email"])).toBe(30);
    expect(peakOf(series, "canal", ["whatsapp"])).toBe(1);
  });
});

/* ------------------------------------------------- la semaine en cours ----- */

describe("la bande « Semaine en cours »", () => {
  /** Mercredi 4 novembre 2026, 15 h à Paris. */
  const now = new Date("2026-11-04T14:00:00Z");

  it("répartit la cible sur les cinq jours ouvrés, pas sur sept", () => {
    const pace = weekPace([], now, 100);
    const expected = pace.days.map((day) => day.expected);
    // Lundi 20, mardi 40, mercredi 60, jeudi 80, vendredi 100, puis le
    // week-end n'ajoute rien.
    expect(expected).toEqual([20, 40, 60, 80, 100, 100, 100]);
  });

  /**
   * L'écart se mesure **à ce jour**. « En retard de 60 » un lundi serait vrai
   * et inutile : il reste quatre jours.
   */
  it("compare le cumul au cumul attendu du jour, pas de la semaine", () => {
    const all = [
      row("2026-11-02T09:00:00Z"),
      row("2026-11-02T10:00:00Z"),
      row("2026-11-03T09:00:00Z"),
    ];
    const pace = weekPace(all, now, 100);
    // Trois messages lundi et mardi, attendu à mercredi soir : 60.
    expect(pace.total).toBe(3);
    expect(pace.expected).toBe(60);
    expect(pace.gap).toBe(-57);
    expect(pace.sentence).toContain("En retard de 57");
  });

  it("dit l'avance quand il y en a", () => {
    const all = Array.from({ length: 80 }, (_, index) =>
      row(`2026-11-02T${String(6 + (index % 12)).padStart(2, "0")}:00:00Z`),
    );
    const pace = weekPace(all, now, 100);
    expect(pace.gap).toBeGreaterThan(0);
    expect(pace.sentence).toContain("En avance de");
  });

  /** On ne compte pas ce qui n'a pas eu lieu. */
  it("ne cumule pas les jours à venir", () => {
    const all = [row("2026-11-06T09:00:00Z")];
    const pace = weekPace(all, now, 100);
    expect(pace.total).toBe(0);
    const friday = pace.days[4]!;
    expect(friday.elapsed).toBe(false);
    expect(friday.cumulative).toBe(0);
  });

  /** Item 6 : la bande dit la même chose que la pastille de la semaine. */
  it("son total est celui de la pastille hebdomadaire au jour écoulé", () => {
    const all = [
      row("2026-11-02T09:00:00Z"),
      row("2026-11-03T09:00:00Z"),
      row("2026-11-04T09:00:00Z"),
    ];
    const pace = weekPace(all, now, 100);
    const week = weekBucket(now);
    // La pastille compte toute la semaine ; la bande s'arrête au jour écoulé.
    // Les deux coïncident tant qu'aucun fait n'est daté dans le futur, ce qui
    // est la règle du compteur manuel (jalon 112).
    expect(pace.total).toBe(pointValue(all, week, "messages"));
  });
});

/* -------------------------------------------------------- les écarts dits -- */

describe("les écarts, écrits", () => {
  it("dit l'écart et la part, et rien quand il n'y a rien à comparer", () => {
    expect(gapLabel(349, 100)).toBe("+249 (349 %)");
    expect(gapLabel(92, 100)).toBe("−8 (92 %)");
    // Zéro se dit « 0 », pas par une absence : une parenthèse seule laisserait
    // croire à une donnée manquante.
    expect(gapLabel(100, 100)).toBe("0 (100 %)");
    expect(gapLabel(5, null)).toBe("");
    // Rien à diviser : on dit l'écart sans inventer un pourcentage.
    expect(gapLabel(5, 0)).toBe("+5");
  });

  it("rend le tiret du jalon 20 quand il n'y a rien à convertir", () => {
    expect(shareLabel(0, 0)).toBe("—");
    expect(shareLabel(3, 12)).toBe("25 %");
  });
});
