import {
  breakdown,
  campaignKey,
  campaignLabel,
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
 * **L'état d'une campagne, dérivé des faits — jamais stocké.**
 *
 * C'est la doctrine de `lib/domain/campaign-status.ts` appliquée aux deux
 * origines : une colonne d'état à tenir à jour finit par contredire ce que la
 * ligne d'à côté affiche.
 *
 * - **terminée** : la campagne du CRM a été archivée. C'est une décision
 *   humaine, et c'est le seul cas où « terminée » est un fait ;
 * - **en cours** : un fait dans les trente derniers jours ;
 * - **en pause** : des faits, mais plus rien depuis trente jours.
 *
 * **Ce que l'API lemlist ne nous dit pas, et qu'on n'invente donc pas** : une
 * activité ne porte aucun état de campagne — vérifié contre le schéma publié de
 * l'objet Activity. Une campagne lemlist arrêtée pour de bon et une campagne
 * lemlist simplement silencieuse se lisent donc toutes deux « en pause », et
 * l'écran le dit au survol plutôt que d'afficher « terminée » sans le savoir.
 * Lever cette limite demanderait d'appeler `GET /api/campaigns`, ce que la
 * synchronisation ne fait pas aujourd'hui.
 */
export function boardState(input: {
  readonly archived: boolean;
  readonly lastFactAt: Date | null;
  readonly now: Date;
}): BoardState {
  if (input.archived) return "done";
  if (input.lastFactAt === null) return "paused";
  const quietFor = input.now.getTime() - input.lastFactAt.getTime();
  return quietFor <= QUIET_DAYS * 86_400_000 ? "running" : "paused";
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
  readonly replies: number;
  readonly rate: number | null;
  readonly reliability: Reliability;
  readonly demos: number;
  readonly qualified: number;
  readonly lastFactAt: Date | null;
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
  now: Date,
): BoardLine[] {
  // Le `Set` est construit **ici** et non dans l'écran : la garde statique
  // refuse `new Set(` dans un fichier de pilotage, et elle a raison de le
  // refuser sans nuance — c'est la forme qu'une déduplication de personnes
  // prend quand elle se glisse dans une vue.
  const archived = new Set(archivedKeys);
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
    const sent = messagesSent(line.rows);
    let lastFactAt: Date | null = null;
    for (const row of line.rows) {
      if (lastFactAt === null || row.occurredAt.getTime() > lastFactAt.getTime()) {
        lastFactAt = row.occurredAt;
      }
    }
    return {
      key: line.key,
      label: line.label,
      // `crm:` ou `lemlist:`, le préfixe que `campaignKey` pose. « Hors
      // campagne » n'a pas de préfixe et vient du CRM par défaut.
      origin: line.key === NO_CAMPAIGN ? "crm" : (line.key.split(":")[0] ?? "crm"),
      state: boardState({ archived: archived.has(line.key), lastFactAt, now }),
      people: line.people,
      messages: line.messages,
      invites: sent.filter((row) => row.type === "linkedin_invite_sent").length,
      replies: line.replies,
      rate: line.replyRate,
      reliability: reliabilityOf(line.contacted),
      demos: line.demos,
      qualified: line.qualified,
      lastFactAt,
      steps: stepLines(line.rows),
    };
  });

  /*
    Tri par volume de messages : la campagne sur laquelle on a le plus travaillé
    est celle dont on veut lire le résultat en premier. Trier par taux mettrait
    en tête la campagne d'une personne — ce que la puce de fiabilité signale
    déjà, mais au prix d'un tableau dont la première ligne est du bruit.
  */
  lines.sort((a, b) => b.messages - a.messages || a.label.localeCompare(b.label, "fr"));
  return lines;
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
