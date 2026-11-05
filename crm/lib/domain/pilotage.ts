import { parisDayRange } from "./mailbox-cap";
import { parisWall } from "./auto-send";
import {
  isPositiveReply,
  type OutreachChannel,
  type OutreachType,
} from "./outreach";

/**
 * **Une définition, une fonction, et aucun chiffre calculé ailleurs.**
 *
 * Les mesures du produit vivaient dans quatre écrans qui portaient chacun la
 * leur : `/performance` comptait les interactions consignées, `/emails` les
 * lignes d'envoi, `/rapports` les affaires, l'accueil ses propres agrégats.
 * Quatre réponses à « combien de messages cette semaine ? », toutes justes
 * isolément, aucune comparable — et c'est ce qui les rendait inutilisables.
 *
 * Tout chiffre de `/pilotage` sort donc d'ici, sur un seul tableau de lignes, et
 * `tests/pilotage-source.test.ts` échoue si un écran se met à compter lui-même.
 *
 * **Chaque nombre est la longueur d'une liste.** Les fonctions rendent les
 * identifiants ou les lignes, pas des totaux : c'est ce qui permet à l'écran
 * d'ouvrir « les 23 personnes » sous un « 23 » sans recompter — le nombre et la
 * liste sortent du même appel, l'invariant des jalons 49, 78 et 105.
 */

/* ------------------------------------------------------- la ligne lue ----- */

/** Un segment de marque, déduit des visiteurs mensuels de la société. */
export const SEGMENTS = ["small", "large", "unknown"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, string> = {
  small: "Petites marques (2 000 à 10 000 visiteurs)",
  large: "Grandes marques (15 000 visiteurs et plus)",
  unknown: "Non renseigné",
};

/**
 * Les bornes du brief, **et l'intervalle entre les deux n'est pas un segment**.
 *
 * 10 000 à 15 000 visiteurs n'appartient à aucune des deux populations
 * décrites : les ranger dans l'une gonflerait un segment d'après une règle que
 * personne n'a posée. Ils comptent donc comme « non renseigné » — ce qui est le
 * fait : on ne sait pas dans quel segment ils tombent.
 */
export const SMALL_RANGE = { min: 2_000, max: 10_000 } as const;
export const LARGE_MIN = 15_000;

export function segmentOf(monthlyVisitors: number | null): Segment {
  if (monthlyVisitors === null) return "unknown";
  if (monthlyVisitors >= LARGE_MIN) return "large";
  if (monthlyVisitors >= SMALL_RANGE.min && monthlyVisitors <= SMALL_RANGE.max) return "small";
  return "unknown";
}

/** Une ligne du journal, telle que le pilotage la lit. */
export interface EventRow {
  readonly id: string;
  readonly contactId: string;
  readonly contactName: string;
  readonly companyName: string;
  readonly campaignId: string | null;
  readonly campaignName: string;
  readonly channel: OutreachChannel;
  readonly type: OutreachType;
  readonly occurredAt: Date;
  readonly owner: string;
  readonly replyCategory: string;
  readonly segment: Segment;
  /** Le groupe de fonction du contact (jalon 94), pour le tableau par segment. */
  readonly group: string;
}

/* ------------------------------------------------------- les périodes ----- */

export interface Period {
  readonly start: Date;
  /** **Exclu** : une borne à 23:59:59 laisse passer 23:59:59,400 (jalon 59). */
  readonly end: Date;
  readonly label: string;
}

export function inPeriod(at: Date, period: Period): boolean {
  const time = at.getTime();
  return time >= period.start.getTime() && time < period.end.getTime();
}

/**
 * La semaine **lundi → dimanche**, à Paris.
 *
 * `parisWall().weekday` compte le dimanche à 0 ; on recule donc de six jours un
 * dimanche, et de `weekday - 1` les autres jours. Les bornes passent par
 * `parisDayRange` (jalon 100) plutôt que par une arithmétique de millisecondes :
 * une semaine qui enjambe le changement d'heure ne fait pas 7 × 24 heures, et
 * la soustraction se tromperait d'une heure deux fois l'an.
 */
export function parisWeek(now: Date, weeksBack = 0): Period {
  const weekday = parisWall(now).weekday;
  const backToMonday = weekday === 0 ? 6 : weekday - 1;
  const anchor = new Date(now.getTime() - (backToMonday + weeksBack * 7) * 86_400_000);
  const monday = parisDayRange(anchor).start;
  const sunday = parisDayRange(new Date(monday.getTime() + 6 * 86_400_000));
  return {
    start: monday,
    end: sunday.end,
    label: weeksBack === 0 ? "Cette semaine" : weeksBack === 1 ? "La semaine dernière" : "Semaine",
  };
}

/** Le mois calendaire de Paris qui contient cet instant. */
export function parisMonth(now: Date): Period {
  const first = parisDayRange(now).start;
  const key = first.toISOString().slice(0, 10);
  const day = Number.parseInt(key.slice(8, 10), 10);
  const start = parisDayRange(new Date(first.getTime() - (day - 1) * 86_400_000)).start;
  // Le 32 du mois tombe toujours dans le suivant, quelle que soit sa longueur.
  const nextMonth = new Date(start.getTime() + 32 * 86_400_000);
  const nextFirstKey = nextMonth.toISOString().slice(0, 10);
  const nextDay = Number.parseInt(nextFirstKey.slice(8, 10), 10);
  const end = parisDayRange(new Date(nextMonth.getTime() - (nextDay - 1) * 86_400_000)).start;
  return { start, end, label: "Ce mois" };
}

/** Une plage libre, bornes incluses côté jour, `end` exclu côté instant. */
export function customPeriod(from: Date, to: Date): Period {
  const [first, last] = from.getTime() <= to.getTime() ? [from, to] : [to, from];
  return {
    start: parisDayRange(first).start,
    end: parisDayRange(last).end,
    label: "Période choisie",
  };
}

/* --------------------------------------------------------- les chiffres --- */

/**
 * **Messages envoyés : chaque touche compte.**
 *
 * `message_sent` et `linkedin_invite_sent` — la vue « Activities » de lemlist.
 * Trois relances à la même personne font trois messages : c'est du travail
 * fourni trois fois, et une mesure qui n'en compterait qu'un décrirait la
 * personne, pas l'effort. Le nombre de personnes est l'autre chiffre, à côté.
 */
export const SENT_TYPES: readonly OutreachType[] = ["message_sent", "linkedin_invite_sent"];

export function messagesSent(rows: readonly EventRow[]): EventRow[] {
  return rows.filter((row) => SENT_TYPES.includes(row.type));
}

/** Les identifiants, dédoublonnés, dans l'ordre de première apparition. */
function contactsOf(rows: readonly EventRow[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of rows) {
    if (seen.has(row.contactId)) continue;
    seen.add(row.contactId);
    ids.push(row.contactId);
  }
  return ids;
}

/** Les personnes touchées par au moins un message dans ces lignes. */
export function peopleMessaged(rows: readonly EventRow[]): string[] {
  return contactsOf(messagesSent(rows));
}

/**
 * L'instant du **premier** message de chaque personne, sur toute l'histoire.
 *
 * C'est pour cette fonction que `newlyContacted` reçoit l'histoire entière et
 * non la période : « nouvelle personne contactée » veut dire « jamais touchée
 * avant », et une lecture bornée à la période compterait comme neuve une
 * personne approchée depuis six mois.
 */
export function firstTouch(allRows: readonly EventRow[]): Map<string, Date> {
  const first = new Map<string, Date>();
  for (const row of messagesSent(allRows)) {
    const known = first.get(row.contactId);
    if (known === undefined || row.occurredAt.getTime() < known.getTime()) {
      first.set(row.contactId, row.occurredAt);
    }
  }
  return first;
}

/**
 * **Nouvelles personnes contactées : celles dont le premier message tombe dans
 * la période.** La vue « Leads » de lemlist.
 */
export function newlyContacted(allRows: readonly EventRow[], period: Period): string[] {
  const first = firstTouch(allRows);
  const ids: string[] = [];
  for (const [contactId, at] of first) {
    if (inPeriod(at, period)) ids.push(contactId);
  }
  return ids;
}

export function replies(rows: readonly EventRow[]): EventRow[] {
  return rows.filter((row) => row.type === "reply_received");
}

export function peopleReplied(rows: readonly EventRow[]): string[] {
  return contactsOf(replies(rows));
}

/** Les réponses positives, et elles seules — voir `isPositiveReply`. */
export function positiveReplies(rows: readonly EventRow[]): EventRow[] {
  return replies(rows).filter((row) => isPositiveReply(row.replyCategory));
}

export function peoplePositive(rows: readonly EventRow[]): string[] {
  return contactsOf(positiveReplies(rows));
}

/** Les réponses que personne n'a encore classées. Comptées, jamais rangées. */
export function uncategorisedReplies(rows: readonly EventRow[]): EventRow[] {
  return replies(rows).filter((row) => row.replyCategory.trim() === "");
}

/**
 * **Taux de réponse : personnes qui ont répondu sur personnes contactées**, même
 * période.
 *
 * Le dénominateur est l'ensemble des personnes **à qui un message est parti dans
 * la période**, pas les seules nouvelles : une relance est une tentative, et un
 * taux qui n'en tiendrait pas compte ignorerait la majeure partie du travail.
 *
 * `null` sur un dénominateur vide, la règle du jalon 20 : « 0 % » affirme un
 * échec, alors qu'il n'y avait rien à convertir. **Les ouvertures n'entrent
 * nulle part** — elles surestiment par construction (jalons 37 et 43), et ce
 * jalon les retire des mesures.
 */
export function replyRate(rows: readonly EventRow[]): number | null {
  const contacted = peopleMessaged(rows).length;
  if (contacted === 0) return null;
  return peopleReplied(rows).length / contacted;
}

export function demosSent(rows: readonly EventRow[]): EventRow[] {
  return rows.filter((row) => row.type === "demo_sent");
}

export function demosTested(rows: readonly EventRow[]): EventRow[] {
  return rows.filter((row) => row.type === "demo_tested");
}

/**
 * **Démo qualifiée : envoyée, testée, et un retour reçu.**
 *
 * Les trois sur la même personne, et la date retenue est celle du **dernier**
 * des trois — c'est l'instant où la fiche devient qualifiée. Dater la
 * qualification de l'envoi la ferait tomber dans une semaine où le retour
 * n'existait pas encore, et le chiffre d'une semaine close changerait après
 * coup.
 *
 * L'histoire entière est nécessaire : une démo envoyée la semaine dernière et un
 * retour reçu cette semaine qualifient bien cette semaine-ci.
 */
export function qualifiedAt(allRows: readonly EventRow[]): Map<string, Date> {
  const parts = new Map<string, { sent?: Date; tested?: Date; feedback?: Date }>();
  for (const row of allRows) {
    const key =
      row.type === "demo_sent"
        ? "sent"
        : row.type === "demo_tested"
          ? "tested"
          : row.type === "feedback_received"
            ? "feedback"
            : null;
    if (key === null) continue;
    const known = parts.get(row.contactId) ?? {};
    const current = known[key];
    // Le premier de chaque sorte : la qualification date du dernier *pas*
    // franchi, pas de la dernière fois qu'on a recliqué.
    if (current === undefined || row.occurredAt.getTime() < current.getTime()) {
      parts.set(row.contactId, { ...known, [key]: row.occurredAt });
    } else {
      parts.set(row.contactId, known);
    }
  }

  const qualified = new Map<string, Date>();
  for (const [contactId, part] of parts) {
    if (part.sent === undefined || part.tested === undefined || part.feedback === undefined) {
      continue;
    }
    const last = Math.max(part.sent.getTime(), part.tested.getTime(), part.feedback.getTime());
    qualified.set(contactId, new Date(last));
  }
  return qualified;
}

export function qualifiedDemos(allRows: readonly EventRow[], period: Period): string[] {
  const ids: string[] = [];
  for (const [contactId, at] of qualifiedAt(allRows)) {
    if (inPeriod(at, period)) ids.push(contactId);
  }
  return ids;
}

/* -------------------------------------------------------- l'entonnoir ----- */

export const FUNNEL_STAGES = [
  "contacted",
  "replied",
  "positive",
  "demo_sent",
  "demo_tested",
  "qualified",
  "trial",
  "customer",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  contacted: "Contactés",
  replied: "Ont répondu",
  positive: "Réponse positive",
  demo_sent: "Démo envoyée",
  demo_tested: "Démo testée",
  qualified: "Démo qualifiée",
  trial: "Essai démarré",
  customer: "Clients",
};

export interface FunnelStep {
  readonly stage: FunnelStage;
  readonly label: string;
  /** Les personnes de cette marche — le nombre **est** leur nombre. */
  readonly contactIds: readonly string[];
  /** Part des personnes contactées, `null` quand il n'y a rien à convertir. */
  readonly share: number | null;
}

/**
 * L'entonnoir, en **personnes** et jamais en événements.
 *
 * Relancer trois fois la même personne ne la fait pas entrer trois fois dans la
 * première marche : c'est la règle de l'entonnoir du jalon 39, et c'est ce qui
 * rend les parts lisibles.
 */
export function funnel(allRows: readonly EventRow[], rows: readonly EventRow[], period: Period): FunnelStep[] {
  const byType = (type: OutreachType) => contactsOf(rows.filter((row) => row.type === type));
  const contacted = peopleMessaged(rows);
  const base = contacted.length;

  const stages: Record<FunnelStage, readonly string[]> = {
    contacted,
    replied: peopleReplied(rows),
    positive: peoplePositive(rows),
    demo_sent: byType("demo_sent"),
    demo_tested: byType("demo_tested"),
    qualified: qualifiedDemos(allRows, period),
    trial: byType("trial_started"),
    customer: byType("customer_won"),
  };

  return FUNNEL_STAGES.map((stage) => ({
    stage,
    label: FUNNEL_LABELS[stage],
    contactIds: stages[stage],
    share: base === 0 ? null : stages[stage].length / base,
  }));
}

/* ----------------------------------------------------- les objectifs ------ */

export interface WeeklyTargets {
  readonly messages: number;
  readonly demos: number;
  readonly qualified: number;
}

export const DEFAULT_TARGETS: WeeklyTargets = { messages: 100, demos: 10, qualified: 5 };

/**
 * L'avancement d'un objectif : la part **n'est pas plafonnée**.
 *
 * Dépasser est une information, pas un débordement à masquer — seule la barre
 * se plafonne visuellement. `0` vaut « pas d'objectif » (la convention du
 * plafond mensuel de l'API, jalon 36) et rend `null` : une barre sur zéro
 * n'aurait aucun sens.
 */
export function progress(actual: number, target: number): number | null {
  if (target <= 0) return null;
  return actual / target;
}

/* ----------------------------------------------- les regroupements -------- */

export interface Breakdown {
  readonly key: string;
  readonly label: string;
  readonly contacted: number;
  readonly messages: number;
  readonly replies: number;
  readonly replyRate: number | null;
  readonly demos: number;
  readonly qualified: number;
}

/**
 * Le même jeu de colonnes, quel que soit l'axe de regroupement.
 *
 * Campagne, segment, groupe de fonction : une seule fonction les calcule, donc
 * « taux de réponse » veut dire la même chose dans les trois tableaux. Chaque
 * ligne appelle les mêmes définitions que les pastilles — il n'y a pas un
 * comptage « pour le tableau » et un autre « pour la pastille ».
 */
export function breakdown(
  allRows: readonly EventRow[],
  rows: readonly EventRow[],
  period: Period,
  axis: (row: EventRow) => { readonly key: string; readonly label: string },
): Breakdown[] {
  const buckets = new Map<string, { label: string; rows: EventRow[] }>();
  for (const row of rows) {
    const { key, label } = axis(row);
    const bucket = buckets.get(key) ?? { label, rows: [] };
    bucket.rows.push(row);
    buckets.set(key, bucket);
  }

  const lines: Breakdown[] = [];
  for (const [key, bucket] of buckets) {
    const scoped = bucket.rows;
    // La qualification se juge sur l'histoire entière, bornée aux personnes de
    // ce seau : une démo envoyée hors période compte pour la personne, pas pour
    // la ligne d'à côté.
    const ids = new Set(scoped.map((row) => row.contactId));
    const history = allRows.filter((row) => ids.has(row.contactId));
    lines.push({
      key,
      label: bucket.label,
      contacted: peopleMessaged(scoped).length,
      messages: messagesSent(scoped).length,
      replies: peopleReplied(scoped).length,
      replyRate: replyRate(scoped),
      demos: demosSent(scoped).length,
      qualified: qualifiedDemos(history, period).length,
    });
  }
  return lines;
}

/* ------------------------------------------------------- dans le temps ---- */

export interface WeekPoint {
  readonly weekStart: Date;
  readonly label: string;
  /** Messages par canal, dans l'ordre de `OUTREACH_CHANNELS`. */
  readonly byChannel: Record<OutreachChannel, number>;
  readonly total: number;
}

/**
 * Les messages par semaine et par canal, sur les `weeks` dernières semaines.
 *
 * **Les semaines vides restent dessinées** : c'est elles qu'on veut voir sur un
 * graphique de régularité (la règle du jalon 59), et une série qui saute les
 * creux ferait d'une interruption un trait continu.
 */
export function weeklySeries(
  rows: readonly EventRow[],
  now: Date,
  weeks: number,
): WeekPoint[] {
  const points: WeekPoint[] = [];
  for (let back = weeks - 1; back >= 0; back -= 1) {
    const week = parisWeek(now, back);
    const inside = messagesSent(rows).filter((row) => inPeriod(row.occurredAt, week));
    const byChannel = {
      email: 0,
      linkedin_invite: 0,
      linkedin_message: 0,
      whatsapp: 0,
      call: 0,
      other: 0,
    } satisfies Record<OutreachChannel, number>;
    for (const row of inside) byChannel[row.channel] += 1;
    points.push({
      weekStart: week.start,
      label: weekLabel(week.start),
      byChannel,
      total: inside.length,
    });
  }
  return points;
}

/** « 3 nov. » — le lundi de la semaine, en français, lu à Paris. */
export function weekLabel(monday: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
  }).format(monday);
}

/* ------------------------------------------------------- les filtres ------ */

export interface PilotageFilters {
  readonly campaignId: string;
  readonly channel: string;
  readonly owner: string;
  readonly segment: string;
}

export const NO_FILTER = "";

/**
 * Le filtrage, **une seule fois**, pour que le nombre et la liste qu'il ouvre
 * sortent du même tableau.
 *
 * C'est l'invariant que `tabView` a établi au jalon 105 : deux filtrages, même
 * écrits avec le même prédicat, laissent la possibilité d'en appeler un sur un
 * tableau et l'autre sur un autre. Ici l'écran filtre une fois et passe le
 * résultat à toutes les définitions.
 */
export function keepRow(row: EventRow, filters: PilotageFilters): boolean {
  if (filters.campaignId !== NO_FILTER && row.campaignId !== filters.campaignId) return false;
  if (filters.channel !== NO_FILTER && row.channel !== filters.channel) return false;
  if (filters.owner !== NO_FILTER && row.owner !== filters.owner) return false;
  if (filters.segment !== NO_FILTER && row.segment !== filters.segment) return false;
  return true;
}

export function applyFilters(
  rows: readonly EventRow[],
  filters: PilotageFilters,
): EventRow[] {
  return rows.filter((row) => keepRow(row, filters));
}

/** Le pourcentage affiché, ou le tiret quand il n'y a rien à convertir. */
export function rateLabel(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)} %`;
}

/**
 * La phrase d'une période sans donnée.
 *
 * **Jamais un zéro qui ressemble à un résultat** : « 0 message » se lit comme un
 * échec de prospection, alors que l'absence de ligne veut dire qu'il n'y a rien
 * à mesurer sur cette période.
 */
export const NO_DATA = "Aucune donnée sur cette période.";

/* --------------------------------------------- un nombre, une liste ------- */

/**
 * **Les chiffres du tableau de bord, et la liste derrière chacun.**
 *
 * Une seule fonction rend les deux : la pastille affiche `ids.length`, le clic
 * ouvre `ids`. Il n'existe donc aucun ordre d'appel qui les sépare — c'est
 * l'invariant que `tabView` a établi au jalon 105, et que les jalons 49 et 78
 * ont payé deux fois pour l'avoir manqué.
 *
 * `metric` voyage dans l'URL : la liste se met en favori, et elle est rejouable.
 */
export const METRICS = [
  "messages",
  "contacted",
  "new_contacted",
  "replies",
  "positive",
  "demos_sent",
  "demos_tested",
  "qualified",
] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_LABELS: Record<Metric, string> = {
  messages: "Messages envoyés",
  contacted: "Personnes contactées",
  new_contacted: "Nouvelles personnes contactées",
  replies: "Réponses",
  positive: "Réponses positives",
  demos_sent: "Démos envoyées",
  demos_tested: "Démos testées",
  qualified: "Démos qualifiées",
};

export function isMetric(value: string): value is Metric {
  return (METRICS as readonly string[]).includes(value);
}

/**
 * Les personnes derrière un chiffre.
 *
 * `messages`, `demos_sent` et `demos_tested` comptent des **événements**, pas
 * des personnes : trois relances font trois messages. La liste qu'ils ouvrent
 * porte donc une ligne par événement, et son nombre reste celui de la pastille.
 * Les autres comptent des personnes, dédoublonnées.
 */
export interface MetricResult {
  readonly metric: Metric;
  readonly label: string;
  /** Les lignes derrière le nombre — une par événement ou une par personne. */
  readonly rows: readonly EventRow[];
  readonly count: number;
  /** `true` quand le chiffre compte des personnes et non des événements. */
  readonly byPerson: boolean;
}

function firstRowPerContact(rows: readonly EventRow[], ids: readonly string[]): EventRow[] {
  const wanted = new Set(ids);
  const seen = new Set<string>();
  const picked: EventRow[] = [];
  for (const row of rows) {
    if (!wanted.has(row.contactId) || seen.has(row.contactId)) continue;
    seen.add(row.contactId);
    picked.push(row);
  }
  return picked;
}

export function metricResult(
  allRows: readonly EventRow[],
  rows: readonly EventRow[],
  period: Period,
  metric: Metric,
): MetricResult {
  const person = (ids: readonly string[]): MetricResult => ({
    metric,
    label: METRIC_LABELS[metric],
    rows: firstRowPerContact(rows.length > 0 ? rows : allRows, ids),
    count: ids.length,
    byPerson: true,
  });
  const events = (picked: readonly EventRow[]): MetricResult => ({
    metric,
    label: METRIC_LABELS[metric],
    rows: picked,
    count: picked.length,
    byPerson: false,
  });

  switch (metric) {
    case "messages":
      return events(messagesSent(rows));
    case "contacted":
      return person(peopleMessaged(rows));
    case "new_contacted": {
      const ids = newlyContacted(allRows, period);
      // La liste vient de l'histoire : une personne contactée pour la première
      // fois dans la période peut l'avoir été hors du filtre de canal courant.
      return {
        metric,
        label: METRIC_LABELS[metric],
        rows: firstRowPerContact(allRows, ids),
        count: ids.length,
        byPerson: true,
      };
    }
    case "replies":
      return person(peopleReplied(rows));
    case "positive":
      return person(peoplePositive(rows));
    case "demos_sent":
      return events(demosSent(rows));
    case "demos_tested":
      return events(demosTested(rows));
    case "qualified": {
      const ids = qualifiedDemos(allRows, period);
      return {
        metric,
        label: METRIC_LABELS[metric],
        rows: firstRowPerContact(allRows, ids),
        count: ids.length,
        byPerson: true,
      };
    }
  }
}
