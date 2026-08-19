import { monthKey } from "./dates";

/**
 * Les chiffres de la section « Emails » — la part pure.
 *
 * **Trois natures de nombre, et l'écran ne doit jamais les confondre :**
 *
 * 1. **les envois** — un fait. On sait combien de messages sont partis ;
 * 2. **les réponses et les rendez-vous** — des faits eux aussi, parce qu'ils
 *    sont saisis à la main en consignant une interaction ;
 * 3. **les ouvertures** — une **estimation**, et systématiquement surestimée.
 *
 * `openRate()` rend donc un objet qui porte son propre avertissement, et non un
 * simple nombre : un taux qu'on peut afficher sans sa mise en garde finira par
 * l'être. La règle du jalon 20 s'applique par-dessus — pas de dénominateur, pas
 * de taux : `null`, jamais `0 %`.
 */

/** L'avertissement, écrit une fois et affiché partout où le taux l'est. */
export const OPEN_RATE_CAVEAT =
  "Estimation surestimée : Apple Mail charge l'image de tous les messages reçus, " +
  "qu'ils soient lus ou non, et Gmail les met en cache derrière son proxy.";

export const OPEN_RATE_LABEL = "Ouvertures (estimation)";

export interface Rate {
  /** `null` quand le dénominateur est nul — aucun taux n'est inventé. */
  readonly value: number | null;
  readonly numerator: number;
  readonly denominator: number;
}

export function rate(numerator: number, denominator: number): Rate {
  return {
    value: denominator === 0 ? null : numerator / denominator,
    numerator,
    denominator,
  };
}

export function formatRate(value: Rate): string {
  if (value.value === null) return "—";
  return `${Math.round(value.value * 100)} %`;
}

export interface Bucket {
  /** Clé triable : `YYYY-MM-DD` pour un jour, `YYYY-Www` pour une semaine. */
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Le lundi de la semaine d'une date.
 *
 * Lundi et non dimanche : c'est la semaine de travail française, et « envois de
 * la semaine » doit désigner la même période que « ma semaine » de l'accueil.
 */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // `getDay()` rend 0 pour dimanche : on le ramène à 6 jours après lundi.
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

export function weekKey(date: Date): string {
  const start = weekStart(date);
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/**
 * Découpe une série de dates en jours consécutifs, **trous compris**.
 *
 * Les jours sans envoi valent zéro et restent dans la série : une courbe qui
 * saute les jours creux transforme une semaine sans prospection en une ligne
 * continue, c'est-à-dire en un mensonge visuel.
 */
export function byDay(dates: readonly Date[], now: Date, days: number): Bucket[] {
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(dayKey(date), (counts.get(dayKey(date)) ?? 0) + 1);

  const buckets: Bucket[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - index);
    const key = dayKey(day);
    buckets.push({
      key,
      label: `${pad(day.getDate())}/${pad(day.getMonth() + 1)}`,
      count: counts.get(key) ?? 0,
    });
  }
  return buckets;
}

/** Même règle, par semaines pleines terminées lundi. */
export function byWeek(dates: readonly Date[], now: Date, weeks: number): Bucket[] {
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(weekKey(date), (counts.get(weekKey(date)) ?? 0) + 1);

  const current = weekStart(now);
  const buckets: Bucket[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = new Date(current);
    start.setDate(start.getDate() - index * 7);
    const key = weekKey(start);
    buckets.push({
      key,
      label: `sem. ${pad(start.getDate())}/${pad(start.getMonth() + 1)}`,
      count: counts.get(key) ?? 0,
    });
  }
  return buckets;
}

/**
 * Un envoi antérieur au sélecteur de signataire n'en porte aucun. Le ranger
 * sous ce libellé plutôt que de l'écarter : le total par signataire doit rester
 * égal au total des envois, sinon la somme des lignes ne fait plus le compte
 * affiché en tête de page.
 */
export const UNKNOWN_SIGNATORY = "(non renseigné)";

export function signatoryName(raw: string): string {
  const name = raw.trim();
  return name === "" ? UNKNOWN_SIGNATORY : name;
}

export interface SignatorySend {
  readonly contactId: string | null;
  readonly signatoryName: string;
  readonly sentAt: Date;
}

export interface SignatoryLine {
  readonly name: string;
  readonly messages: number;
  readonly people: number;
  readonly replies: number;
  readonly replyRate: Rate;
}

/**
 * Ce que chacun a envoyé, et ce que cela a rapporté.
 *
 * **Une réponse est créditée au signataire du dernier message qui la
 * précède** — c'est à celui-là qu'on répond. La créditer au premier message de
 * la séquence donnerait tout le mérite à qui a ouvert la conversation, et
 * l'attribuer aux deux compterait la même réponse deux fois : le total des
 * lignes cesserait d'égaler le nombre de réponses.
 *
 * Un envoi postérieur à la réponse ne compte pas : on ne peut pas répondre à un
 * message qui n'était pas encore parti.
 */
export function signatoryLines(
  sends: readonly SignatorySend[],
  repliedAt: ReadonlyMap<string, Date>,
): SignatoryLine[] {
  const messages = new Map<string, number>();
  const people = new Map<string, Set<string>>();
  const replies = new Map<string, number>();

  sends.forEach((send, index) => {
    const name = signatoryName(send.signatoryName);
    messages.set(name, (messages.get(name) ?? 0) + 1);
    const known = people.get(name) ?? new Set<string>();
    // Une fiche supprimée laisse son envoi sans contact : il reste une personne
    // écrite, simplement anonyme. La compter pour rien ferait mentir le taux.
    known.add(send.contactId ?? `orphelin:${index}`);
    people.set(name, known);
  });

  for (const [contactId, replyDate] of repliedAt) {
    let credited: SignatorySend | null = null;
    for (const send of sends) {
      if (send.contactId !== contactId || send.sentAt > replyDate) continue;
      if (credited === null || send.sentAt > credited.sentAt) credited = send;
    }
    if (credited === null) continue;
    const name = signatoryName(credited.signatoryName);
    replies.set(name, (replies.get(name) ?? 0) + 1);
  }

  return [...messages.entries()]
    .map(([name, count]) => {
      const written = people.get(name)?.size ?? 0;
      const answered = replies.get(name) ?? 0;
      return {
        name,
        messages: count,
        people: written,
        replies: answered,
        replyRate: rate(answered, written),
      };
    })
    .sort((a, b) => b.messages - a.messages || a.name.localeCompare(b.name));
}

/**
 * Par séquence **et par étape**, les envois hors séquence exclus.
 *
 * Exclus et non rangés sous « (aucune) » : contrairement au signataire, où le
 * total des barres doit égaler le total des envois, ce graphique répond à « que
 * font mes séquences ». Y mêler les messages écrits à la main noierait la
 * réponse sous la colonne la plus haute.
 */
export function bySequence(
  rows: ReadonlyArray<{ readonly sequenceName: string; readonly sequenceStep: number | null }>,
): Bucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.sequenceName.trim();
    if (name === "") continue;
    const key = `${name} · étape ${row.sequenceStep ?? "?"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Le mois d'un envoi, pour les regroupements longs. Réutilise `dates.ts`. */
export function sendMonth(date: Date): string {
  return monthKey(date);
}
