import {
  breakdown,
  campaignKey,
  campaignLabel,
  inviteAcceptance,
  messagesSent,
  peopleMessaged,
  peopleReplied,
  replyRate,
  NO_CAMPAIGN,
  type EventRow,
  type Period,
} from "./pilotage";
import { reliabilityOf, type Reliability } from "./size-buckets";
import { CHANNEL_LABELS } from "./outreach";

/**
 * **« Campagnes côte à côte » : les deux outils dans un seul tableau.**
 *
 * Une campagne lemlist et une campagne du CRM n'ont rien en commun côté
 * technique — l'une est une ligne de `campaigns`, l'autre deux colonnes de
 * texte sur un événement. Elles ont pourtant exactement la même question : *est
 * -ce que celle-là marche mieux que celle-ci ?* Les mettre dans deux tableaux
 * différents rendrait la question inposable, et c'est pour cela que
 * `campaignKey` existe depuis le jalon 111.
 *
 * Deux choses que ce module fait et qu'un tableau naïf ne fait pas :
 *
 * 1. **chaque taux porte son `n`**, comme partout dans ce jalon. Une campagne de
 *    six personnes à 50 % n'est pas la meilleure campagne, c'est trois
 *    personnes ;
 * 2. **le résultat par étape**, parce qu'un total de campagne ne dit jamais
 *    laquelle des quatre relances ne sert à rien. C'est à cela que servent les
 *    colonnes `stepIndex` / `stepType` ajoutées au jalon 113 v2.
 */

/* ---------------------------------------------------------- l'état -------- */

export const BOARD_STATES = ["running", "paused", "done"] as const;
export type BoardState = (typeof BOARD_STATES)[number];

export const BOARD_STATE_LABELS: Record<BoardState, string> = {
  running: "En cours",
  paused: "En pause",
  done: "Terminée",
};

/** Au-delà de ce silence, une campagne n'est plus « en cours ». */
export const QUIET_DAYS = 30;

/**
 * **Le vocabulaire d'état de lemlist, traduit vers les trois puces.**
 *
 * `GET /campaigns` rend `running`, `paused`, `draft`, `ended`, `archived` ou
 * `errors`. Les six se rangent dans trois, et chaque choix mérite sa ligne :
 *
 * - `ended` et `archived` → **terminée**. Deux façons de dire « c'est fini » ;
 * - `running` → **en cours** ;
 * - `paused` → **en pause**, évidemment ;
 * - `draft` → **en pause**, parce qu'une campagne jamais lancée n'est pas
 *   « en cours ». En pratique on ne la verra pas : le tableau ne liste que les
 *   campagnes que le journal a vues produire quelque chose, et un brouillon n'a
 *   rien produit ;
 * - `errors` → **en pause**. Ce n'est pas « en cours » : lemlist ne l'envoie
 *   plus. Dire « en cours » sur une campagne en erreur ferait croire que le
 *   travail avance.
 *
 * Une valeur inconnue rend `null` plutôt qu'un repli : si lemlist ajoute un
 * état demain, mieux vaut retomber sur la déduction par le silence que de ranger
 * une nouveauté dans une case au hasard.
 */
export const LEMLIST_STATE_MAP: Readonly<Record<string, BoardState>> = {
  running: "running",
  paused: "paused",
  draft: "paused",
  errors: "paused",
  ended: "done",
  archived: "done",
};

export function stateFromLemlist(status: string): BoardState | null {
  return LEMLIST_STATE_MAP[status.trim()] ?? null;
}

/**
 * **L'état d'une campagne : relevé quand lemlist le dit, déduit sinon.**
 *
 * Au jalon 113 v2, il était **toujours** déduit d'un silence de trente jours,
 * parce qu'une activité ne porte aucun état de campagne — vérifié contre le
 * schéma publié de l'objet Activity. Une campagne arrêtée pour de bon et une
 * campagne simplement muette se lisaient donc pareil, et l'écran le disait au
 * survol faute de mieux.
 *
 * Le jalon 114 lève la limite : la synchronisation appelle `GET /campaigns` et
 * stocke le `status` publié. Quand il est là, **il gagne** — c'est un fait
 * contre une déduction. Il n'y a pas de doctrine « jamais stocké » qui tienne
 * ici : ce que `lib/domain/campaign-status.ts` interdit, c'est de tenir à jour à
 * la main un état qu'on pourrait calculer ; recopier ce que l'outil source
 * déclare est l'inverse exact.
 *
 * L'ordre reste : une campagne du CRM archivée est terminée (décision humaine),
 * puis l'état relevé, puis la déduction par le silence.
 */
export function boardState(input: {
  readonly archived: boolean;
  /** L'état publié par lemlist, s'il a été relevé. */
  readonly reported: string;
  readonly lastFactAt: Date | null;
  readonly now: Date;
}): BoardState {
  if (input.archived) return "done";
  const reported = stateFromLemlist(input.reported);
  if (reported !== null) return reported;
  if (input.lastFactAt === null) return "paused";
  const quietFor = input.now.getTime() - input.lastFactAt.getTime();
  return quietFor <= QUIET_DAYS * 86_400_000 ? "running" : "paused";
}

/**
 * **Combien de prospects attendent d'être lancés.**
 *
 * `nbLeads − nbLeadsLaunched`, relevé par la synchronisation. `null` dit « on
 * ne sait pas » — soit la campagne n'a pas encore été relue, soit ses
 * statistiques n'ont pas été demandées à ce passage. **Ce n'est pas zéro** :
 * afficher « 0 prospect attend » sur une campagne dont on n'a rien lu serait
 * une affirmation qu'on n'a pas vérifiée, et c'est la règle du jalon 20.
 *
 * Un compte négatif est refusé plutôt que corrigé : `nbLeadsLaunched` supérieur
 * à `nbLeads` voudrait dire qu'on a mal compris la route, et un `Math.max(0, …)`
 * cacherait précisément ce qu'il faut voir.
 */
export function waitingToLaunch(input: {
  readonly leads: number | null;
  readonly leadsLaunched: number | null;
}): number | null {
  if (input.leads === null || input.leadsLaunched === null) return null;
  const waiting = input.leads - input.leadsLaunched;
  return waiting < 0 ? null : waiting;
}

/**
 * La phrase du brief, et elle ne s'écrit que quand elle dit quelque chose.
 *
 * Trois silences : l'état n'est pas « en pause », le compte est inconnu, ou
 * personne n'attend. « Campagne en pause : 0 prospect attend d'être lancé » est
 * une phrase vraie et inutile — elle occupe la place de ce qui compte, et la
 * répéter sur chaque campagne apprendrait à ne plus la lire.
 */
export function pausedNotice(input: {
  readonly state: BoardState;
  readonly waiting: number | null;
}): string | null {
  if (input.state !== "paused") return null;
  if (input.waiting === null || input.waiting <= 0) return null;
  const plural = input.waiting > 1;
  return `Campagne en pause : ${input.waiting} prospect${plural ? "s" : ""} attend${
    plural ? "ent" : ""
  } d'être lancé${plural ? "s" : ""}`;
}

/**
 * Ce que la synchronisation a relevé d'une campagne lemlist.
 *
 * `key` est la clé de `campaignKey` (`lemlist:cam_…`) et non l'identifiant brut :
 * le tableau réunit deux origines, et comparer des clés d'espaces de noms
 * différents rangerait deux campagnes sous la même ligne (la raison d'être de
 * `campaignKey` depuis le jalon 111).
 */
export interface CampaignReport {
  readonly key: string;
  readonly status: string;
  readonly leads: number | null;
  readonly leadsLaunched: number | null;
}

/* ------------------------------------------------------- une ligne -------- */

export interface StepLine {
  /** Le rang affiché — 1 pour la première étape. `null` hors séquence. */
  readonly index: number | null;
  readonly label: string;
  readonly messages: number;
  readonly replies: number;
  readonly rate: number | null;
  /** Le dénominateur du taux : les personnes touchées par cette étape. */
  readonly contacted: number;
  readonly reliability: Reliability;
}

export interface BoardLine {
  readonly key: string;
  readonly label: string;
  /** `crm` ou `lemlist` — la puce d'origine. */
  readonly origin: string;
  readonly state: BoardState;
  /**
   * Vrai quand l'état vient du **relevé** de lemlist, faux quand il est déduit
   * d'un silence. L'écran le dit au survol : une déduction et un fait relevé ne
   * se lisent pas avec la même confiance, et les afficher à l'identique serait
   * faire passer l'un pour l'autre.
   */
  readonly reportedState: boolean;
  readonly people: readonly string[];
  /**
   * **Messages, invitations LinkedIn comprises.**
   *
   * `messagesSent` compte `message_sent` **et** `linkedin_invite_sent` depuis
   * le jalon 109 : une invitation est un acte de prospection, et l'exclure ferait
   * paraître une campagne LinkedIn deux fois moins active qu'elle ne l'est.
   * L'écran le dit en une ligne sous le tableau, parce que « messages » se lit
   * spontanément comme « emails » et que l'écart serait mis sur le dos d'un bug.
   */
  readonly messages: number;
  readonly invites: number;
  /**
   * **Les invitations LinkedIn acceptées**, et c'est une colonne à part.
   *
   * Une invitation acceptée n'est pas une réponse : c'est une porte qui
   * s'ouvre. La mélanger au taux de réponse ferait monter ce dernier sans
   * qu'un seul message ait été lu — le refus déjà posé sur la vue d'ensemble au
   * jalon 113 v2, appliqué ici à la ligne de campagne.
   */
  readonly invitesAccepted: number;
  readonly replies: number;
  readonly rate: number | null;
  readonly reliability: Reliability;
  readonly demos: number;
  readonly qualified: number;
  readonly lastFactAt: Date | null;
  /** `nbLeads − nbLeadsLaunched`, relevé par la synchronisation. */
  readonly waiting: number | null;
  /** La phrase du panneau d'étapes, ou `null` quand elle ne dit rien. */
  readonly notice: string | null;
  readonly steps: readonly StepLine[];
}

/**
 * Le libellé d'une étape : son rang, et sa nature quand on la connaît.
 *
 * « Étape 2 · LinkedIn » plutôt que « 2 » : le rang seul n'aide pas à retrouver
 * l'étape dans lemlist, et c'est pourtant ce qu'on va y faire après avoir lu
 * que la 2 ne produit rien.
 */
export function stepLabel(index: number | null, type: string): string {
  if (index === null) return "Hors séquence";
  const named = (CHANNEL_LABELS as Readonly<Record<string, string>>)[type];
  return named === undefined ? `Étape ${index}` : `Étape ${index} · ${named}`;
}

/**
 * **Le tableau, une ligne par campagne et une sous-ligne par étape.**
 *
 * `allRows` sert la qualification, qui se juge sur l'histoire entière ; `rows`
 * est la période filtrée. « Hors campagne » est une ligne comme les autres :
 * l'omettre ferait un tableau dont la somme ne retombe pas sur les pastilles de
 * l'onglet d'à côté, et chercher d'où vient l'écart est précisément le temps
 * qu'un tableau de bord doit faire gagner.
 */
export function boardLines(
  allRows: readonly EventRow[],
  rows: readonly EventRow[],
  period: Period,
  archivedKeys: readonly string[],
  /**
   * Ce que la synchronisation a relevé des campagnes lemlist, par clé de
   * `campaignKey` (`lemlist:cam_…`). Vide tant qu'aucun relevé n'a eu lieu, et
   * l'écran retombe alors sur ce qu'il savait déjà déduire.
   */
  reported: readonly CampaignReport[],
  now: Date,
  sort: BoardSort = "messages",
  dir: SortDir = "desc",
): BoardLine[] {
  // Le `Set` est construit **ici** et non dans l'écran : la garde statique
  // refuse `new Set(` dans un fichier de pilotage, et elle a raison de le
  // refuser sans nuance — c'est la forme qu'une déduplication de personnes
  // prend quand elle se glisse dans une vue.
  const archived = new Set(archivedKeys);
  const known = new Map(reported.map((row) => [row.key, row]));
  /*
    **Les six colonnes communes viennent de `breakdown`**, comme pour tous les
    tableaux de ce produit. Cet onglet n'ajoute que ce qui lui est propre :
    l'origine, l'état, les invitations comptées à part, la date du dernier fait
    et le détail par étape. Recalculer les six ici en ferait une seconde
    définition de « taux de réponse », et deux onglets finiraient par afficher
    deux nombres sur les mêmes gens — le défaut du jalon 54.
  */
  const lines: BoardLine[] = breakdown(allRows, rows, period, (row) => ({
    key: campaignKey(row),
    label: campaignLabel(row),
  })).map((line) => {
    const invites = inviteAcceptance(line.rows);
    let lastFactAt: Date | null = null;
    for (const row of line.rows) {
      if (lastFactAt === null || row.occurredAt.getTime() > lastFactAt.getTime()) {
        lastFactAt = row.occurredAt;
      }
    }
    const seen = known.get(line.key);
    const state = boardState({
      archived: archived.has(line.key),
      reported: seen?.status ?? "",
      lastFactAt,
      now,
    });
    const waiting = waitingToLaunch({
      leads: seen?.leads ?? null,
      leadsLaunched: seen?.leadsLaunched ?? null,
    });
    return {
      key: line.key,
      label: line.label,
      // `crm:` ou `lemlist:`, le préfixe que `campaignKey` pose. « Hors
      // campagne » n'a pas de préfixe et vient du CRM par défaut.
      origin: line.key === NO_CAMPAIGN ? "crm" : (line.key.split(":")[0] ?? "crm"),
      state,
      reportedState: stateFromLemlist(seen?.status ?? "") !== null,
      people: line.people,
      messages: line.messages,
      /*
        **Les deux colonnes viennent de `inviteAcceptance`**, la fonction qui
        rend déjà ce couple sur la vue d'ensemble et derrière les deux chiffres
        cliquables. Comptées sur les **événements** et non les personnes : on
        peut inviter la même personne sur deux comptes, et ce qui compte est
        « combien de mes invitations passent ».
      */
      invites: invites.sent.length,
      invitesAccepted: invites.accepted.length,
      replies: line.replies,
      rate: line.replyRate,
      reliability: reliabilityOf(line.contacted),
      demos: line.demos,
      qualified: line.qualified,
      lastFactAt,
      waiting,
      notice: pausedNotice({ state, waiting }),
      steps: stepLines(line.rows),
    };
  });

  return sortBoard(lines, sort, dir);
}

/* ------------------------------------------------------------ le tri ------ */

/**
 * **Les colonnes triables, et le nom qu'elles portent dans l'URL.**
 *
 * `campagne` trie sur le libellé ; les autres sont numériques. Le vocabulaire
 * vit ici et non dans la vue, pour la raison habituelle : une liste recopiée
 * dans un composant finit par proposer une colonne que le tri ne connaît pas,
 * et l'en-tête devient un bouton qui ne fait rien.
 */
export const BOARD_SORTS = [
  "campagne",
  "personnes",
  "messages",
  "invitations",
  "acceptees",
  "reponses",
  "taux",
  "demos",
  "qualifiees",
] as const;
export type BoardSort = (typeof BOARD_SORTS)[number];

export const SORT_DIRS = ["asc", "desc"] as const;
export type SortDir = (typeof SORT_DIRS)[number];

export function toBoardSort(value: string): BoardSort {
  return (BOARD_SORTS as readonly string[]).includes(value) ? (value as BoardSort) : "messages";
}

export function toSortDir(value: string): SortDir {
  return value === "asc" ? "asc" : "desc";
}

/** La valeur numérique d'une ligne pour une colonne. `null` = pas de valeur. */
function valueOf(line: BoardLine, sort: BoardSort): number | null {
  switch (sort) {
    case "campagne":
      return null;
    case "personnes":
      return line.people.length;
    case "messages":
      return line.messages;
    case "invitations":
      return line.invites;
    case "acceptees":
      return line.invitesAccepted;
    case "reponses":
      return line.replies;
    case "taux":
      return line.rate;
    case "demos":
      return line.demos;
    case "qualifiees":
      return line.qualified;
  }
}

/**
 * **Le tri, dans les deux sens, et les valeurs absentes toujours en fin.**
 *
 * Le défaut reste « messages décroissant » : la campagne sur laquelle on a le
 * plus travaillé est celle dont on veut lire le résultat en premier. Trier par
 * taux mettrait en tête la campagne d'une personne — ce que la puce de
 * fiabilité signale déjà, mais au prix d'un tableau dont la première ligne est
 * du bruit.
 *
 * **Un taux absent se range en bas dans les deux sens.** `null` veut dire
 * « rien à convertir » ; inverser le tri ne doit pas ramener les lignes vides en
 * tête, et c'est la règle du jalon 30. Une comparaison naïve sur `null` en
 * ferait au contraire le meilleur résultat du tableau.
 *
 * Le libellé départage toujours, pour que deux lignes à égalité ne changent pas
 * d'ordre d'un rendu à l'autre — un tableau qui se réordonne tout seul au
 * rechargement est un tableau qu'on croit buggé.
 */
export function sortBoard(
  lines: readonly BoardLine[],
  sort: BoardSort,
  dir: SortDir,
): BoardLine[] {
  const sign = dir === "asc" ? 1 : -1;
  const out = [...lines];
  out.sort((a, b) => {
    if (sort === "campagne") return a.label.localeCompare(b.label, "fr") * sign;
    const left = valueOf(a, sort);
    const right = valueOf(b, sort);
    if (left === null && right === null) return a.label.localeCompare(b.label, "fr");
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * sign || a.label.localeCompare(b.label, "fr");
  });
  return out;
}

/**
 * **Le résultat par étape**, pour une campagne.
 *
 * Le taux d'une étape a son propre dénominateur : les personnes que **cette**
 * étape a touchées. Diviser les réponses de l'étape 3 par les inscrits de la
 * campagne donnerait un taux qui baisse mécaniquement à chaque relance, et on
 * en concluerait que les relances ne marchent pas alors qu'on aurait simplement
 * divisé par le mauvais nombre.
 *
 * **Une réponse est rattachée à l'étape du dernier message parti à cette
 * personne**, parce qu'une réponse ne porte pas d'étape : elle naît d'un relevé
 * de messagerie ou d'une activité lemlist hors séquence. C'est la même
 * attribution que `attributeCampaigns` applique aux campagnes, pour la même
 * raison — sans elle, chaque étape afficherait 0 réponse et 0 %, c'est-à-dire un
 * échec affirmé là où la donnée n'était pas rattachée.
 */
export function stepLines(rows: readonly EventRow[]): StepLine[] {
  const ordered = [...rows].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  // L'étape du dernier message parti à chaque personne, au fil du temps.
  const lastStep = new Map<string, { index: number | null; type: string }>();
  const buckets = new Map<string, { index: number | null; type: string; rows: EventRow[] }>();
  const slot = (index: number | null, type: string) => {
    const key = index === null ? "hors" : `${index}:${type}`;
    const bucket = buckets.get(key) ?? { index, type, rows: [] };
    buckets.set(key, bucket);
    return bucket;
  };

  for (const row of ordered) {
    if (row.stepIndex !== null) {
      if (row.contactId !== null) lastStep.set(row.contactId, { index: row.stepIndex, type: row.stepType });
      slot(row.stepIndex, row.stepType).rows.push(row);
      continue;
    }
    const known = row.contactId === null ? undefined : lastStep.get(row.contactId);
    if (known === undefined) {
      slot(null, "").rows.push(row);
      continue;
    }
    slot(known.index, known.type).rows.push(row);
  }

  const lines: StepLine[] = [];
  for (const bucket of buckets.values()) {
    const contacted = peopleMessaged(bucket.rows).length;
    lines.push({
      index: bucket.index,
      label: stepLabel(bucket.index, bucket.type),
      messages: messagesSent(bucket.rows).length,
      replies: peopleReplied(bucket.rows).length,
      rate: replyRate(bucket.rows),
      contacted,
      reliability: reliabilityOf(contacted),
    });
  }

  // Par rang croissant, « hors séquence » en dernier : c'est l'ordre de la
  // séquence chez lemlist, et le seul qui se lise comme une suite.
  lines.sort((a, b) => {
    if (a.index === null) return 1;
    if (b.index === null) return -1;
    return a.index - b.index || a.label.localeCompare(b.label, "fr");
  });
  return lines;
}
