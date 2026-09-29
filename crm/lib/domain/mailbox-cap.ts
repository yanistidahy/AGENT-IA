import { AUTO_TIMEZONE } from "./auto-send";

/**
 * **Combien de messages une boîte a le droit d'envoyer dans une journée.**
 *
 * ### Ce que ce plafond protège, et pourquoi il est par boîte
 *
 * La réputation d'expédition se joue par **adresse d'envoi**, pas par produit :
 * trois boîtes qui envoient cinquante messages chacune ne présentent pas le même
 * profil qu'une boîte qui en envoie cent cinquante. Les plafonds du jalon 38
 * (`send-rate.ts`) sont d'une autre nature et restent en place : ils portent sur
 * **tout le CRM**, ils apprennent d'un refus `450` du serveur, et ils existent
 * pour ne pas se faire couper. Celui-ci est une **discipline de prospection**,
 * choisie à l'avance et la même pour chaque boîte.
 *
 * ### Ce qui compte, et où c'est compté
 *
 * **Tout message réellement parti par SMTP depuis cette boîte aujourd'hui**,
 * quel que soit le chemin : un départ validé à la main, un envoi de
 * l'ordonnanceur, un email écrit depuis une fiche contact. Le compte est lu dans
 * le **journal des envois** à chaque lecture, jamais tenu dans une colonne à
 * part : un compteur parallèle finirait par diverger, et il divergerait dans le
 * mauvais sens — en autorisant plus que le réel. C'est la leçon de
 * `checkRate` (jalon 38), qui compte déjà depuis `email_sends`.
 *
 * ### Ce qui est bloqué, et ce qui ne l'est jamais
 *
 * **Seuls les départs de campagne.** Un email écrit à la main depuis une fiche
 * est une réponse à quelque chose : le refuser ferait perdre une conversation
 * pour protéger une moyenne. Il est donc **compté sans être bloqué**, et
 * l'écran avertit quand la boîte est au-delà.
 *
 * ### Rien n'est perdu
 *
 * Un départ refusé pour cause de plafond **reste en attente** avec sa cause : il
 * repart le prochain jour ouvré. C'est la règle des motifs transitoires du
 * jalon 91 — un départ qui disparaît de la file se lit comme un envoi réussi.
 */

/** Cinquante par boîte et par jour : trois boîtes, cent cinquante au plus. */
export const DEFAULT_DAILY_CAP = 50;

/**
 * `0` vaut « pas de plafond », la convention du plafond mensuel de l'API
 * (jalon 36) et de la fenêtre d'avertissement entre collègues (jalon 53) : sans
 * elle, on ne pourrait plus le désactiver.
 */
export const NO_CAP = 0;

/** Le fuseau du jour, celui de l'ordonnanceur : une seule source. */
export const CAP_TIMEZONE = AUTO_TIMEZONE;

const DAY_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Le jour **calendaire de Paris** d'un instant, en `AAAA-MM-JJ`.
 *
 * Lu par `Intl`, jamais calculé : le serveur tourne en UTC (Railway), donc
 * `getDate()` y désigne une autre journée une partie de la nuit, et un décalage
 * saisonnier écrit en dur serait faux la moitié de l'année. C'est le
 * raisonnement de `parisWall` (jalon 93), appliqué au jour plutôt qu'à l'heure.
 */
export function parisDayKey(date: Date): string {
  return DAY_PARTS.format(date);
}

/**
 * Le décalage de Paris à cet instant, en minutes.
 *
 * Déduit de l'écart entre l'heure murale lue par `Intl` et l'heure UTC : c'est
 * la seule façon de remonter d'un jour local à une borne absolue sans coder
 * l'heure d'été.
 */
function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAP_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const value = (type: string) => Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const wall = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour") % 24,
    value("minute"),
    value("second"),
  );
  return Math.round((wall - at.getTime()) / 60_000);
}

/**
 * Les deux bornes absolues du jour parisien qui contient cet instant.
 *
 * `start` inclus, `end` **exclu** : une borne haute posée à 23:59:59 laisse
 * passer entre les mailles un envoi à 23:59:59,400 — le jour a des
 * millisecondes (la leçon de `added-window.ts`, jalon 59).
 *
 * Le décalage est relu **sur la borne calculée** et non sur l'instant de départ :
 * les deux diffèrent la nuit du changement d'heure, et c'est précisément la nuit
 * où une borne fausse décalerait tout le comptage d'une heure.
 */
export function parisDayRange(date: Date): { readonly start: Date; readonly end: Date } {
  const key = parisDayKey(date);
  const naive = Date.parse(`${key}T00:00:00Z`);
  const first = new Date(naive - parisOffsetMinutes(date) * 60_000);
  const start = new Date(naive - parisOffsetMinutes(first) * 60_000);

  const nextKey = parisDayKey(new Date(start.getTime() + 36 * 3_600_000));
  const nextNaive = Date.parse(`${nextKey}T00:00:00Z`);
  const nextFirst = new Date(nextNaive - parisOffsetMinutes(start) * 60_000);
  const end = new Date(nextNaive - parisOffsetMinutes(nextFirst) * 60_000);

  return { start, end };
}

/** L'état d'une boîte aujourd'hui, tel que l'écran l'affiche. */
export interface MailboxUsage {
  readonly mailboxId: string;
  /** L'adresse d'expédition : c'est elle que le refus nomme. */
  readonly from: string;
  /** Le libellé de la boîte, pour les écrans qui ont la place. */
  readonly label: string;
  /** Messages réellement partis de cette boîte aujourd'hui. */
  readonly sent: number;
  readonly cap: number;
}

/**
 * Ce qui reste, ou `null` quand il n'y a pas de plafond.
 *
 * `null` plutôt qu'`Infinity` : un appelant qui oublie le cas d'absence de
 * plafond obtient `null`, que le compilateur lui fait traiter, là où `Infinity`
 * traverserait silencieusement une soustraction.
 */
export function remainingOf(usage: Pick<MailboxUsage, "sent" | "cap">): number | null {
  if (usage.cap <= NO_CAP) return null;
  return Math.max(0, usage.cap - usage.sent);
}

/** La boîte a-t-elle atteint son plafond ? Sans plafond, jamais. */
export function capReached(usage: Pick<MailboxUsage, "sent" | "cap">): boolean {
  const left = remainingOf(usage);
  return left !== null && left === 0;
}

/**
 * Le refus, nommé : l'adresse, le compte, et ce qui arrive ensuite.
 *
 * « Plafond atteint » seul laisserait croire à une perte. La dernière phrase est
 * la moitié utile du message : le départ n'est ni envoyé ni jeté, il attend.
 */
export function capRefusal(usage: MailboxUsage): string {
  return `Plafond atteint pour ${usage.from} : ${usage.sent}/${usage.cap} aujourd'hui. Ce départ partira demain.`;
}

/** Ce que la carte d'un départ en attente affiche quand sa boîte est pleine. */
export const CARRIED_LABEL = "Reporté : plafond de la boîte atteint";

/**
 * L'avertissement d'un email écrit à la main depuis une fiche.
 *
 * Il **n'empêche rien** : il dit ce que cet envoi fait au compte du jour, pour
 * que personne ne découvre après coup pourquoi ses départs de campagne ne
 * partent plus.
 */
export function overCapNotice(usage: MailboxUsage): string {
  if (!capReached(usage)) return "";
  return `${usage.from} a atteint son plafond du jour (${usage.sent}/${usage.cap}). Cet email partira quand même — un message écrit à la main n'est jamais bloqué — mais les départs de campagne de cette boîte attendent demain.`;
}

/** Le compteur en tête de la file : « contact@… 32/50 · yanis@… 12/50 ». */
export function describeUsage(rows: readonly MailboxUsage[]): string {
  return rows
    .map((row) => `${row.from} ${row.sent}/${row.cap <= NO_CAP ? "∞" : row.cap}`)
    .join(" · ");
}

/** Ce qu'il faut d'un départ pour le classer : son étape et son ancienneté. */
export interface Prioritizable {
  readonly id: string;
  readonly step: number;
  readonly createdAt: Date;
}

/**
 * **L'ordre dans lequel la capacité du jour se dépense.**
 *
 * Les relances (étapes 2 et 3) d'abord, les premiers contacts ensuite, et à
 * l'intérieur de chaque groupe le plus ancien d'abord.
 *
 * La raison n'est pas l'ancienneté : une relance s'adresse à quelqu'un qu'on a
 * **déjà approché**, qui attend peut-être, et qui perd tout intérêt si la suite
 * arrive trois jours en retard. Un premier contact, lui, ne coûte rien à
 * décaler : le prospect ne nous attend pas. Dépenser les derniers créneaux du
 * jour sur des inconnus laisserait des séquences en plan.
 *
 * `id` départage à ancienneté égale, pour que deux lectures rendent le même
 * ordre : une file qui se réordonne d'un rafraîchissement à l'autre ne se relit
 * pas.
 */
export function sortByPriority<T extends Prioritizable>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const followUp = Number(b.step > 1) - Number(a.step > 1);
    if (followUp !== 0) return followUp;
    const age = a.createdAt.getTime() - b.createdAt.getTime();
    if (age !== 0) return age;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Combien de brouillons une composition a le droit d'écrire pour une boîte, et
 * combien elle laisse pour plus tard.
 *
 * **Le but est de ne pas payer ce qui ne peut pas partir.** Un brouillon d'étape
 * rédigée par Alex est un appel au modèle facturé ; en écrire soixante pour une
 * boîte qui n'en enverra que cinquante, c'est acheter dix textes qui seront
 * périmés demain matin (jalon 96). Les étapes **écrites à la main** ne passent
 * pas par ici : elles ne coûtent rien, et la file les porte sans dommage.
 */
export function composeAllowance(
  due: number,
  usage: Pick<MailboxUsage, "sent" | "cap">,
): { readonly write: number; readonly later: number } {
  const left = remainingOf(usage);
  if (left === null) return { write: due, later: 0 };
  const write = Math.min(due, left);
  return { write, later: due - write };
}

/** Ce que la confirmation de « Écrire les mails » ajoute quand elle borne. */
export function describeAllowance(later: number): string {
  if (later <= 0) return "";
  return `${later} départ${later > 1 ? "s" : ""} ${
    later > 1 ? "sont laissés" : "est laissé"
  } pour demain : le plafond du jour de leur boîte est atteint, et un brouillon écrit aujourd'hui pour partir dans deux jours serait à réécrire.`;
}

/** Ce que l'ordonnanceur dit quand une boîte est pleine et qu'il continue ailleurs. */
export function describeCappedBoxes(rows: readonly MailboxUsage[]): string {
  const full = rows.filter((row) => capReached(row));
  if (full.length === 0) return "";
  const names = full.map((row) => `${row.from} (${row.sent}/${row.cap})`).join(", ");
  return `Plafond du jour atteint pour ${names} : l'envoi automatique continue avec les autres boîtes.`;
}
