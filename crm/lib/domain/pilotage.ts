import { parisDayRange } from "./mailbox-cap";
import { parisWall } from "./auto-send";
import {
  isPositiveReply,
  OUTREACH_CHANNELS,
  type OutreachChannel,
  type OutreachType,
} from "./outreach";
import { nicheKey, NO_NICHE, NO_NICHE_LABEL } from "./company-profile";
import { SIZE_LABELS, type SizeBucket } from "./size-buckets";

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

/*
  **Les tranches de taille ont quitté ce fichier au jalon 113 v2.**

  `SEGMENTS`, `SEGMENT_LABELS`, `SMALL_RANGE`, `LARGE_MIN` et `segmentOf`
  vivaient ici avec trois valeurs, et rangeaient l'intervalle 10 000 à 15 000
  dans « non renseigné » faute de brief. Le prototype validé nomme maintenant
  cinq tranches : elles sont dans `lib/domain/size-buckets.ts`, avec la règle
  d'échantillon que les quatre onglets lisent aussi. Une seule fonction décide
  d'une tranche, et c'est ce que `no-duplicate-thresholds` exige.
*/

/** Une ligne du journal, telle que le pilotage la lit. */
export interface EventRow {
  readonly id: string;
  /**
   * **`null` depuis le jalon 112** : un message compté au compteur manuel n'a
   * pas toujours de fiche. Toutes les fonctions « par personne » de ce module
   * sautent ces lignes — voir `contactsOf` —, et « messages envoyés », qui
   * compte des faits et non des gens, les compte.
   */
  readonly contactId: string | null;
  readonly contactName: string;
  readonly companyName: string;
  readonly campaignId: string | null;
  readonly campaignName: string;
  /**
   * La campagne **chez la source**, pour un événement que le CRM n'a pas
   * produit. Vide sur tout ce qui vient du CRM ; `campaignKey` réunit les deux
   * origines en une seule clé, de sorte que « Campagnes côte à côte » compare
   * une campagne lemlist et une campagne du CRM dans le même tableau.
   */
  readonly extCampaignId: string;
  readonly extCampaignName: string;
  readonly channel: OutreachChannel;
  readonly type: OutreachType;
  readonly occurredAt: Date;
  readonly owner: string;
  /**
   * `crm` | `lemlist` | `manuel` — d'où vient le fait.
   *
   * Affiché dans la liste d'un chiffre (jalon 112) : trois origines écrivent
   * désormais des messages envoyés, et savoir laquelle a produit une ligne est
   * la première question qu'on se pose devant un total qui surprend.
   */
  readonly source: string;
  readonly replyCategory: string;
  /** La tranche de taille de la marque — `lib/domain/size-buckets.ts`. */
  readonly size: SizeBucket;
  /**
   * **La niche de la marque**, recopiée à la lecture.
   *
   * Vide quand elle n'est pas renseignée, et le tableau « Par niche » en fait
   * une ligne nommée : masquer les non renseignés ferait d'un tableau partiel
   * un tableau qui a l'air complet.
   */
  readonly niche: string;
  /** Le groupe de fonction du contact (jalon 94), pour le tableau par niche. */
  readonly group: string;
  /**
   * L'étape de séquence chez la source — `null` hors séquence. L'onglet
   * Campagnes montre le résultat par étape ; un total de campagne ne dit pas
   * laquelle des quatre relances ne sert à rien.
   */
  readonly stepIndex: number | null;
  readonly stepType: string;
}

/* ------------------------------------------------------- les périodes ----- */

export interface Period {
  readonly start: Date;
  /** **Exclu** : une borne à 23:59:59 laisse passer 23:59:59,400 (jalon 59). */
  readonly end: Date;
  readonly label: string;
}

/**
 * Les périodes proposées par la barre de filtres.
 *
 * Ce vocabulaire vit dans le **domaine** et non dans le service : la barre de
 * filtres est un composant client, et importer un module marqué `server-only`
 * depuis le navigateur fait échouer le build (la garde du jalon 2). Le défaut a
 * d'ailleurs été attrapé exactement comme cela.
 */
export const PERIOD_KEYS = ["semaine", "semaine-1", "mois", "libre"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  semaine: "Cette semaine",
  "semaine-1": "La semaine dernière",
  mois: "Ce mois",
  libre: "Période choisie",
};

export function inPeriod(at: Date, period: Period): boolean {
  const time = at.getTime();
  return time >= period.start.getTime() && time < period.end.getTime();
}

/**
 * Les lignes de la période.
 *
 * Elle vit ici et non dans la page pour que **aucun chiffre ne se calcule hors
 * du domaine** — y compris celui-là, qui décide quelles lignes comptent.
 * `tests/pilotage-source.test.ts` échoue si une page se remet à filtrer :
 * deux bornages, même écrits avec le même prédicat, laissent la possibilité
 * d'en appliquer un à la pastille et l'autre à la liste.
 */
export function slice(rows: readonly EventRow[], period: Period): EventRow[] {
  return rows.filter((row) => inPeriod(row.occurredAt, period));
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

/**
 * Les identifiants, dédoublonnés, dans l'ordre de première apparition.
 *
 * **Une ligne sans fiche n'est personne.** C'est le point d'entrée unique de
 * tout ce qui compte des gens, et c'est donc ici — et nulle part ailleurs —
 * que le jalon 112 se tient : un message compté au compteur sans destinataire
 * enregistré ne peut pas devenir « une nouvelle personne contactée », ni
 * grossir le dénominateur du taux de réponse. Garder le filtre à un seul
 * endroit est ce qui empêche une fonction d'oublier la règle.
 */
function contactsOf(rows: readonly EventRow[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of rows) {
    if (row.contactId === null || seen.has(row.contactId)) continue;
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
    if (row.contactId === null) continue;
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
    // Une ligne sans fiche ne qualifie personne : la qualification est un fait
    // *sur quelqu'un*, et les trois pas doivent être franchis par la même
    // personne.
    if (row.contactId === null) continue;
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
  /**
   * **Le passage depuis la marche précédente**, et c'est une autre question que
   * `share`.
   *
   * « 4 % des contactés ont testé la démo » dit où l'on en est ; « 80 % de ceux
   * qui ont reçu la démo l'ont testée » dit **quelle marche coince**. Les deux
   * se lisent sur le même entonnoir, d'où la bascule du prototype, et les
   * calculer tous les deux ici empêche la vue d'en improviser un.
   *
   * `null` sur la première marche (il n'y a pas de précédente) et sur un
   * dénominateur nul — la règle du jalon 20.
   */
  readonly passage: number | null;
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

  return FUNNEL_STAGES.map((stage, index) => {
    const previous = index === 0 ? null : stages[FUNNEL_STAGES[index - 1]!];
    const from = previous === null ? 0 : previous.length;
    return {
      stage,
      label: FUNNEL_LABELS[stage],
      contactIds: stages[stage],
      share: base === 0 ? null : stages[stage].length / base,
      passage: previous === null || from === 0 ? null : stages[stage].length / from,
    };
  });
}

/* ------------------------------------------- les invitations LinkedIn ----- */

/**
 * **Les invitations LinkedIn acceptées, sur celles envoyées.**
 *
 * Un chiffre à part parce qu'il ne se lit pas comme les autres : une invitation
 * acceptée n'est pas une réponse, c'est une porte qui s'ouvre, et la mélanger au
 * taux de réponse ferait monter ce dernier sans qu'un seul message ait été lu.
 *
 * Les deux nombres sont des **événements** et non des personnes : on peut
 * inviter la même personne sur deux comptes, et le taux qui compte est bien
 * « combien de mes invitations passent ». `null` sur zéro envoi — pas « 0 % »,
 * qui affirmerait un refus.
 */
export interface InviteAcceptance {
  readonly sent: readonly EventRow[];
  readonly accepted: readonly EventRow[];
  readonly rate: number | null;
}

export function inviteAcceptance(rows: readonly EventRow[]): InviteAcceptance {
  const sent = rows.filter((row) => row.type === "linkedin_invite_sent");
  const accepted = rows.filter((row) => row.type === "linkedin_invite_accepted");
  return {
    sent,
    accepted,
    rate: sent.length === 0 ? null : accepted.length / sent.length,
  };
}

/* ------------------------------------------- le taux, canal par canal ----- */

export interface ChannelSplit {
  readonly channel: OutreachChannel;
  readonly rate: number | null;
  /** Les personnes touchées par ce canal : le dénominateur du taux. */
  readonly contacted: number;
  readonly messages: number;
}

/**
 * **Le taux de réponse, décomposé par canal.**
 *
 * Un taux global de 9 % peut cacher 2 % par email et 24 % en DM, et c'est la
 * seule décomposition qui change ce qu'on fera demain. Chaque ligne appelle
 * `replyRate` — la même fonction que le taux global —, donc les deux veulent
 * dire la même chose ; écrire la division ici en ferait une seconde définition.
 *
 * Les canaux sans aucune ligne sont retirés : « email 0 sur 0, — » occupe une
 * ligne pour dire qu'il n'y a rien à dire.
 */
export function channelSplit(rows: readonly EventRow[]): ChannelSplit[] {
  const out: ChannelSplit[] = [];
  for (const channel of OUTREACH_CHANNELS) {
    const scoped = rows.filter((row) => row.channel === channel);
    if (scoped.length === 0) continue;
    out.push({
      channel,
      rate: replyRate(scoped),
      contacted: peopleMessaged(scoped).length,
      messages: messagesSent(scoped).length,
    });
  }
  return out;
}

/* ----------------------------------------- la phrase d'un objectif -------- */

/**
 * **Ce qu'il reste à faire, ou de combien l'objectif est dépassé.**
 *
 * Deux phrases, et le prototype les veut toutes les deux parce qu'elles ne
 * servent pas le même moment de la semaine. En dessous : « Il en manque 8 »,
 * c'est-à-dire un nombre d'actes, pas un pourcentage — « 92 % de l'objectif »
 * ne dit pas quoi faire cet après-midi. Au-dessus : « Objectif atteint ×3,5 »,
 * qui reconnaît le dépassement au lieu d'afficher une barre pleine muette.
 *
 * `target` à zéro veut dire « pas d'objectif » (la convention de `progress`) et
 * rend la chaîne vide : inventer un reste à faire sur un objectif absent serait
 * un reproche sans fondement.
 */
export function objectiveLabel(actual: number, target: number, horizon = "d'ici dimanche"): string {
  if (target <= 0) return "";
  if (actual >= target) {
    const ratio = actual / target;
    // Un dépassement de moins de 5 % ne mérite pas un « ×1,0 » qui ressemble à
    // une erreur d'affichage : on dit simplement que c'est atteint.
    if (ratio < 1.05) return "Objectif atteint";
    const shown = String(Math.round(ratio * 10) / 10).replace(".", ",");
    return `Objectif atteint ×${shown}`;
  }
  const missing = target - actual;
  return `Il en manque ${missing} ${horizon}`;
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
  /** Les personnes du seau : le nombre **est** leur nombre, et le `n` du taux. */
  readonly people: readonly string[];
  readonly contacted: number;
  readonly messages: number;
  readonly replies: number;
  readonly replyRate: number | null;
  readonly demos: number;
  readonly qualified: number;
  /**
   * Les lignes du seau, et l'histoire de ses personnes.
   *
   * Elles voyagent avec la ligne pour que l'appelant n'ait pas à refiltrer :
   * c'est ce qui permet au tableau par niche d'ajouter une tendance et à celui
   * des campagnes d'ajouter le détail par étape **sans recompter** les six
   * colonnes communes. Sans elles, chaque tableau regrouperait de son côté, et
   * c'est précisément ainsi qu'une seconde définition de « taux de réponse »
   * s'installe.
   */
  readonly rows: readonly EventRow[];
  readonly history: readonly EventRow[];
}

/**
 * **Le même jeu de colonnes, quel que soit l'axe de regroupement.**
 *
 * Campagne, niche, tranche, groupe de fonction : une seule fonction les
 * calcule, donc « taux de réponse » veut dire la même chose dans tous les
 * tableaux. Chaque ligne appelle les mêmes définitions que les pastilles — il
 * n'y a pas un comptage « pour le tableau » et un autre « pour la pastille ».
 *
 * Elle avait cessé d'être appelée quand les tableaux du jalon 109 ont été
 * remplacés par ceux du prototype, et les deux nouveaux rederivaient les six
 * mêmes colonnes chacun de son côté. Ils passent de nouveau par ici : une
 * fonction tombée en désuétude qu'on garde est une invitation à en écrire une
 * seconde.
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
    const people = peopleMessaged(scoped);
    lines.push({
      key,
      label: bucket.label,
      people,
      contacted: people.length,
      messages: messagesSent(scoped).length,
      replies: peopleReplied(scoped).length,
      replyRate: replyRate(scoped),
      demos: demosSent(scoped).length,
      qualified: qualifiedDemos(history, period).length,
      rows: scoped,
      history,
    });
  }
  return lines;
}

/* ------------------------------------------------------- dans le temps ---- */

/*
  **La série hebdomadaire a été retirée au jalon 113.**

  `WeekPoint`, `weeklySeries` et `weekLabel` dessinaient douze semaines fixes
  dont dix vides, en barres empilées, sans survol ni clic. Elles vivent
  désormais dans `lib/domain/timeline.ts`, qui sait aussi le jour et le mois,
  retire la course de zéros du début, et fait sortir la valeur d'un point de
  `metricResult` — donc de la même fonction que la liste qu'il ouvre.
*/


/* ------------------------------------------------- la clé de campagne ----- */

/** Ce qui désigne « hors campagne », écrit une fois. */
export const NO_CAMPAIGN = "hors-campagne";

/**
 * **Une seule clé pour deux origines.**
 *
 * Une campagne du CRM est une ligne de `campaigns` ; une campagne lemlist n'est
 * que deux colonnes de texte sur l'événement. Les comparer demande une clé
 * commune, et la préfixer est ce qui empêche un identifiant lemlist de
 * ressembler à un identifiant du CRM — ils n'ont pas le même espace de noms, et
 * une collision rangerait deux campagnes différentes dans la même colonne.
 *
 * C'est la seule fonction qui décide de ce qu'est « une campagne » pour le
 * pilotage : le filtre, le regroupement et le menu l'appellent tous les trois.
 */
export function campaignKey(row: EventRow): string {
  if (row.campaignId !== null) return `crm:${row.campaignId}`;
  if (row.extCampaignId !== "") return `lemlist:${row.extCampaignId}`;
  return NO_CAMPAIGN;
}

/**
 * Le libellé d'une campagne, **en nommant son outil**.
 *
 * Le suffixe n'est pas décoratif : deux campagnes peuvent porter le même nom
 * dans les deux outils, et « Campagnes côte à côte » deviendrait illisible si
 * rien ne les distinguait. Une campagne lemlist sans nom — la documentation
 * prévient qu'un événement hors campagne n'en porte pas — se dit telle quelle
 * plutôt que de s'afficher vide.
 */
export function campaignLabel(row: EventRow): string {
  if (row.campaignId !== null) {
    return row.campaignName === "" ? "Campagne sans nom" : row.campaignName;
  }
  if (row.extCampaignId !== "") {
    const name = row.extCampaignName === "" ? "Campagne lemlist sans nom" : row.extCampaignName;
    return `${name} (lemlist)`;
  }
  return "Hors campagne";
}

/* --------------------------------------------- les autres axes ------------ */

/**
 * **La niche d'une ligne, en clé et en libellé.**
 *
 * La clé plie casse et accents, le libellé garde ce qui a été tapé : c'est ce
 * qui permet à « Bijoux » et « bijoux » de faire une seule ligne de tableau
 * sans que l'une des deux orthographes s'affiche à la place de l'autre.
 *
 * Une niche absente devient une ligne nommée, jamais un vide : « 40 personnes
 * sans niche » est une information actionnable — il y a quarante fiches à
 * compléter —, alors qu'une ligne vide se lit comme un défaut d'affichage.
 */
export function nicheOf(row: EventRow): { readonly key: string; readonly label: string } {
  const key = nicheKey(row.niche);
  if (key === "") return { key: NO_NICHE, label: NO_NICHE_LABEL };
  return { key, label: row.niche.trim() };
}

/** La tranche de taille d'une ligne, en clé et en libellé. */
export function sizeOf(row: EventRow): { readonly key: string; readonly label: string } {
  return { key: row.size, label: SIZE_LABELS[row.size] };
}

/* ------------------------------------------------------- les filtres ------ */

/**
 * **Les sept filtres, et ils voyagent tous dans l'URL.**
 *
 * `""` vaut « tous » pour chacun — c'est `NO_FILTER`. Quatre sont arrivés au
 * jalon 113 v2 : la niche et le groupe de fonction, que le prototype demande
 * dans la barre, et l'origine, qui répond à la première question qu'on se pose
 * devant un total surprenant (« ça vient de lemlist ou du compteur ? »). La
 * taille reste un filtre bien que la barre ne la montre pas : l'onglet
 * « Segments » en a besoin pour que le clic sur une marche de mini-entonnoir
 * ouvre la liste de **cette** tranche, et un lien ne peut porter qu'un filtre
 * qui existe.
 */
export interface PilotageFilters {
  readonly campaignId: string;
  readonly channel: string;
  readonly owner: string;
  readonly size: string;
  readonly niche: string;
  readonly group: string;
  readonly source: string;
}

export const NO_FILTER = "";

/** Tous les filtres ouverts : le point de départ, écrit une fois. */
export const ALL_OPEN: PilotageFilters = {
  campaignId: NO_FILTER,
  channel: NO_FILTER,
  owner: NO_FILTER,
  size: NO_FILTER,
  niche: NO_FILTER,
  group: NO_FILTER,
  source: NO_FILTER,
};

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
  if (filters.campaignId !== NO_FILTER && campaignKey(row) !== filters.campaignId) return false;
  if (filters.channel !== NO_FILTER && row.channel !== filters.channel) return false;
  if (filters.owner !== NO_FILTER && row.owner !== filters.owner) return false;
  if (filters.size !== NO_FILTER && row.size !== filters.size) return false;
  // La niche se compare sur sa **clé** et non sur le libellé : « Bijoux » et
  // « bijoux » sont une seule niche, et un filtre sensible à la casse couperait
  // le tableau en deux lignes dont une seule s'ouvrirait.
  if (filters.niche !== NO_FILTER && nicheOf(row).key !== filters.niche) return false;
  if (filters.group !== NO_FILTER && row.group !== filters.group) return false;
  if (filters.source !== NO_FILTER && row.source !== filters.source) return false;
  return true;
}

/**
 * **La campagne d'une réponse est celle du message auquel elle répond.**
 *
 * Le journal porte les faits bruts : un envoi connaît sa campagne, une réponse
 * non — elle naît d'une interaction consignée, et une démo testée à la main
 * n'appartient à rien. Sans attribution, le tableau « Campagnes côte à côte »
 * afficherait **0 réponse et 0 %** sur chaque campagne : non pas « rien à
 * convertir », mais un échec affirmé là où la donnée n'était simplement pas
 * rattachée. C'est précisément le mensonge que la règle du jalon 20 interdit.
 *
 * La règle est donc explicite et unique : un événement sans campagne reçoit
 * celle du **dernier message parti à cette personne avant lui**. C'est une
 * attribution, pas un fait : elle vit dans le domaine et **jamais en base**,
 * pour que le journal reste relisable et qu'un changement de règle n'exige pas
 * de réécrire des lignes.
 *
 * Les lignes sont supposées triées par date croissante, comme `readEventRows`
 * les rend ; une ligne antérieure au premier message reste hors campagne, ce
 * qui est le fait.
 */
export function attributeCampaigns(rows: readonly EventRow[]): EventRow[] {
  /*
    Les deux origines voyagent ensemble dans le même souvenir : une réponse
    lemlist doit recevoir la campagne lemlist du message auquel elle répond,
    exactement comme une réponse du CRM reçoit la sienne. Garder deux cartes
    séparées aurait laissé la question « laquelle gagne » ouverte, et c'est le
    genre d'ambiguïté qui finit par attribuer une réponse à l'autre outil.
  */
  const last = new Map<string, { id: string | null; name: string; extId: string; extName: string }>();
  const out: EventRow[] = [];
  for (const row of [...rows].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    /*
      **Une ligne sans fiche ne reçoit ni ne donne de campagne.** L'attribution
      remonte au dernier message parti *à cette personne* ; sans personne, il
      n'y a pas de fil à suivre, et prêter à ces lignes la campagne d'un voisin
      les rangerait sous une campagne qui ne les a pas produites.
    */
    if (row.contactId === null) {
      out.push(row);
      continue;
    }
    if (campaignKey(row) !== NO_CAMPAIGN) {
      last.set(row.contactId, {
        id: row.campaignId,
        name: row.campaignName,
        extId: row.extCampaignId,
        extName: row.extCampaignName,
      });
      out.push(row);
      continue;
    }
    const known = last.get(row.contactId);
    // Un envoi sans campagne reste sans campagne : il a été écrit hors de
    // toute campagne, et le lui en attribuer une gonflerait ses chiffres.
    if (known === undefined || SENT_TYPES.includes(row.type)) {
      out.push(row);
      continue;
    }
    out.push({
      ...row,
      campaignId: known.id,
      campaignName: known.name,
      extCampaignId: known.extId,
      extCampaignName: known.extName,
    });
  }
  return out;
}

/**
 * Le filtrage, **et l'attribution de campagne avant lui**.
 *
 * Les deux écrans passent par cette seule fonction : ils ne peuvent donc pas
 * attribuer différemment, ni filtrer sur un tableau que l'autre n'a pas vu.
 */
export function applyFilters(
  rows: readonly EventRow[],
  filters: PilotageFilters,
): EventRow[] {
  return attributeCampaigns(rows).filter((row) => keepRow(row, filters));
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
  "invites",
  "invites_accepted",
  "replies",
  "replies_uncategorised",
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
  invites: "Invitations LinkedIn envoyées",
  invites_accepted: "Invitations LinkedIn acceptées",
  replies: "Réponses",
  replies_uncategorised: "Réponses non classées",
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

/**
 * Une ligne par personne, prise dans le vivier donné, dans l'ordre d'apparition.
 *
 * Le vivier est choisi par appel : pour « ont répondu » ce sont les réponses,
 * pour « contactées » les messages. Ouvrir « ont répondu » sur le premier
 * message de chacun afficherait une liste juste dont chaque ligne parlerait
 * d'autre chose que du chiffre cliqué.
 */
function firstRowPerContact(pool: readonly EventRow[], ids: readonly string[]): EventRow[] {
  const wanted = new Set(ids);
  const seen = new Set<string>();
  const picked: EventRow[] = [];
  for (const row of pool) {
    if (row.contactId === null) continue;
    if (!wanted.has(row.contactId) || seen.has(row.contactId)) continue;
    seen.add(row.contactId);
    picked.push(row);
  }
  return picked;
}

/** Les trois types qui composent une démo qualifiée. */
const QUALIFYING: readonly OutreachType[] = ["demo_sent", "demo_tested", "feedback_received"];

export function metricResult(
  allRows: readonly EventRow[],
  rows: readonly EventRow[],
  period: Period,
  metric: Metric,
): MetricResult {
  const label = METRIC_LABELS[metric];

  /**
   * **Le nombre est la longueur de la liste, par construction.**
   *
   * `count` n'est jamais calculé à part : il vaut `picked.length`. C'est ce qui
   * rend l'item 6 du test d'acceptation vrai sans avoir à y penser — une
   * pastille et sa liste ne peuvent pas différer, puisqu'il n'y a qu'un seul
   * nombre. Les jalons 49, 78 et 105 ont payé trois fois pour l'avoir écrit
   * autrement.
   */
  const byPeople = (pool: readonly EventRow[], ids: readonly string[]): MetricResult => {
    const picked = firstRowPerContact(pool, ids);
    return { metric, label, rows: picked, count: picked.length, byPerson: true };
  };
  const byEvents = (picked: readonly EventRow[]): MetricResult => ({
    metric,
    label,
    rows: picked,
    count: picked.length,
    byPerson: false,
  });

  switch (metric) {
    case "messages":
      return byEvents(messagesSent(rows));
    case "contacted":
      return byPeople(messagesSent(rows), peopleMessaged(rows));
    case "new_contacted":
      // Le vivier est l'histoire entière : le premier message d'une personne
      // contactée pour la première fois dans la période peut être parti par un
      // canal que le filtre courant écarte, et la ligne doit tout de même
      // pouvoir se montrer.
      return byPeople(messagesSent(allRows), newlyContacted(allRows, period));
    /*
      **Les deux colonnes d'invitation ouvrent leur liste par `inviteAcceptance`**
      — la fonction qui en rend déjà le taux sur la vue d'ensemble et les deux
      colonnes du tableau des campagnes. Recompter ici, même d'un `filter`
      identique, ferait deux définitions de « invitation acceptée » : la pastille
      et sa liste pourraient alors différer, et c'est précisément ce que
      l'invariant du jalon 109 interdit.
    */
    case "invites":
      return byEvents(inviteAcceptance(rows).sent);
    case "invites_accepted":
      return byEvents(inviteAcceptance(rows).accepted);
    case "replies":
      return byPeople(replies(rows), peopleReplied(rows));
    /*
      **Les réponses non classées ouvrent leur propre liste**, et c'est un défaut
      réel corrigé au jalon 114 : la ligne affichait le nombre de réponses **non
      classées** et ouvrait la liste des **personnes ayant répondu** — « 11 »
      au-dessus d'une liste de 22 lignes. Trouvé par le contrôle d'invariant
      relancé sur une période large, pas à la relecture ; exactement le même
      défaut que la ligne par canal du jalon 113 v2, et au même endroit : une
      carte dont les lignes partagent un lien avec leur titre.

      Comptées en **événements** : une personne peut avoir deux réponses dont une
      seule classée, et c'est bien le nombre de réponses à classer qu'on cherche.
    */
    case "replies_uncategorised":
      return byEvents(uncategorisedReplies(rows));
    case "positive":
      return byPeople(positiveReplies(rows), peoplePositive(rows));
    case "demos_sent":
      return byEvents(demosSent(rows));
    case "demos_tested":
      return byEvents(demosTested(rows));
    case "qualified":
      // La qualification se juge sur l'histoire (une démo envoyée la semaine
      // dernière, un retour reçu cette semaine qualifient cette semaine-ci),
      // donc le vivier l'est aussi.
      return byPeople(
        allRows.filter((row) => QUALIFYING.includes(row.type)),
        qualifiedDemos(allRows, period),
      );
  }
}

/**
 * **Le libellé d'une ligne sans fiche**, écrit une fois.
 *
 * Depuis le jalon 112, un message compté au compteur manuel peut n'avoir
 * personne derrière lui. La liste d'un chiffre doit tout de même rendre une
 * ligne pour lui : sinon le nombre affiché cesse d'égaler la longueur de la
 * liste, et c'est précisément l'invariant que le jalon 109 a construit.
 */
export const NO_CONTACT_LABEL = "Sans contact";

/**
 * Les libellés d'origine d'un fait, pour la liste d'un chiffre.
 *
 * Trois chemins écrivent des messages envoyés depuis le jalon 112 — le CRM, la
 * synchronisation lemlist et le compteur manuel —, et savoir lequel a produit
 * une ligne est la première question qu'on se pose devant un total qui
 * surprend. Un `source` inconnu se rend tel quel plutôt que vide : une valeur
 * nouvelle doit se voir, pas disparaître.
 */
export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  crm: "CRM",
  lemlist: "lemlist",
  manual: "manuel",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
