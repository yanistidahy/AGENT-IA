import { REMOVED } from "./campaign-members";
import { fold } from "./text";
import { BLOCK_LABELS } from "./sequence-rules";

/**
 * **Rouvrir une inscription que la séquence avait épuisée — et elle seule.**
 *
 * Une campagne qui n'avait qu'une étape ferme ses inscriptions dès que cette
 * étape est partie : « Toutes les étapes ont été envoyées ». Ajouter une
 * relance ensuite ne servait alors à personne — les cinquante-deux qui
 * l'attendaient étaient déjà sortis de la mécanique.
 *
 * Ce module dit **qui peut rentrer** et **quand son prochain message est dû**.
 * Deux règles, et la première est celle qu'on ne négocie pas :
 *
 * 1. **un seul motif rouvre.** « Toutes les étapes ont été envoyées » est une
 *    fin technique : la personne n'a rien demandé, c'est la séquence qui n'avait
 *    plus rien à dire. Tous les autres motifs — a répondu, fiche close,
 *    opposition, retirée à la main — sont des décisions **sur la personne**, et
 *    ce sont exactement elles qui la protègent d'une relance qu'elle ne doit pas
 *    recevoir. Les traiter d'un même geste reviendrait à écrire à quelqu'un qui
 *    a dit non, pour la seule raison qu'on a ajouté un paragraphe ;
 * 2. **le délai court depuis son dernier message**, jamais depuis l'instant où
 *    l'on ajoute l'étape. Quelqu'un servi il y a dix jours est dû tout de suite
 *    pour une étape à J+4 ; le compter depuis maintenant lui ferait attendre
 *    quatre jours de plus sans raison, et surtout ferait mentir la phrase de
 *    confirmation.
 */

/** Le statut écrit par la composition quand la séquence n'a plus d'étape. */
export const FINISHED_STATUS = "done";

/** Le motif, réduit à ce qui ne dépend ni de la casse ni des accents. */
function normalize(reason: string): string {
  return fold(reason).replace(/\s+/g, " ").trim();
}

const EXHAUSTED = normalize(BLOCK_LABELS.finished);

/**
 * Cette inscription a-t-elle été fermée **faute d'étape suivante** ?
 *
 * **La première version exigeait le statut `done` ET le motif exact.** C'était
 * une redondance délibérée — « le statut suffirait aujourd'hui, la comparaison
 * ferme la porte au jour où un autre chemin écrirait `done` pour autre
 * chose » — et c'est elle qui rend le mécanisme muet dès que la base porte
 * l'une des deux moitiés sous une autre forme : un `stopped` hérité d'un
 * chemin plus ancien, un accent perdu à l'import, un motif vide. Rien ne
 * correspond, rien ne rouvre, et **rien ne le dit**.
 *
 * La règle repose donc désormais sur ce qui décide vraiment, dans cet ordre :
 *
 * 1. **jamais une inscription vivante ni retirée** — `active` n'a rien à
 *    rouvrir, et `removed` est un geste de l'utilisateur ;
 * 2. **`done` suffit** : ce statut n'est écrit qu'à l'épuisement de la
 *    séquence, motif vide ou non ;
 * 3. **le motif d'épuisement suffit aussi**, comparé sans casse ni accents :
 *    les quatre motifs qui protègent quelqu'un — a répondu, fiche close,
 *    opposition, retrait à la main — ne peuvent pas lui ressembler.
 *
 * Ce qui n'a pas bougé : aucune de ces trois portes ne laisse passer une
 * inscription arrêtée **sur la personne**. C'est la seule chose qui compte.
 */
export function reopenable(status: string, stopReason: string): boolean {
  if (status === "active" || status === REMOVED) return false;
  if (status === FINISHED_STATUS) return true;
  return normalize(stopReason) === EXHAUSTED;
}

const DAY_MS = 86_400_000;

/**
 * Dans combien de jours cette personne est due, 0 si elle l'est déjà.
 *
 * Compté en jours pleins depuis `lastSentAt`, et non en heures : la
 * composition tourne une fois par matin, donc promettre « dans 2 jours » vaut
 * mieux que « dans 1,6 jour » — l'un décrit ce qui va se passer, l'autre
 * décrit une soustraction.
 */
export function daysUntilDue(lastSentAt: Date | null, delayDays: number, now: Date): number {
  if (lastSentAt === null) return 0;
  const due = new Date(lastSentAt);
  due.setDate(due.getDate() + Math.max(0, delayDays));
  if (due <= now) return 0;
  return Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
}

export interface ReopenCandidate {
  readonly enrollmentId: string;
  readonly name: string;
  /** Jours restants avant que son étape soit due — 0 : elle l'est déjà. */
  readonly inDays: number;
}

export interface ReopenExclusion {
  readonly name: string;
  readonly reason: string;
}

export interface ReasonCount {
  readonly reason: string;
  readonly count: number;
}

export interface ReopenPlan {
  /** L'étape que ces personnes recevront. */
  readonly step: number;
  readonly candidates: readonly ReopenCandidate[];
  /** Arrêtées pour un motif qui les protège : nommées, jamais rouvertes. */
  readonly excluded: readonly ReopenExclusion[];
  /**
   * Les motifs **tels qu'ils sont écrits en base**, comptés.
   *
   * C'est le diagnostic : le jour où rien ne rouvre, il faut lire ce que la
   * base porte vraiment, pas ce que le code croit qu'elle porte.
   */
  readonly reasons: readonly ReasonCount[];
  /** Rouvrables, mais qui ont déjà reçu toutes les étapes existantes. */
  readonly exhausted: number;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

/**
 * Ce que l'ajout d'une étape va faire, dit avant de le faire.
 *
 * La phrase sépare **immédiatement** de **plus tard** parce que ce sont deux
 * décisions différentes : la première engage la prochaine composition, la
 * seconde engage la semaine. Un total unique — « 52 personnes seront
 * relancées » — laisserait croire que tout part le matin même.
 */
export function describeReopen(plan: ReopenPlan): string {
  const total = plan.candidates.length;
  if (total === 0) {
    return "Personne n'a terminé cette campagne : l'étape ne rouvrira aucune inscription.";
  }

  const now = plan.candidates.filter((entry) => entry.inDays === 0).length;
  const later = plan.candidates.filter((entry) => entry.inDays > 0);

  const parts: string[] = [];
  if (now > 0) parts.push(`${now} immédiatement`);
  // Les retardataires sont groupés par échéance : « 3 dans 2 jours » se lit,
  // « 1 dans 2 jours, 1 dans 2 jours, 1 dans 3 jours » ne se lit pas.
  const byDay = new Map<number, number>();
  for (const entry of later) byDay.set(entry.inDays, (byDay.get(entry.inDays) ?? 0) + 1);
  for (const [days, count] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    parts.push(`${count} dans ${plural(days, "jour")}`);
  }

  return (
    `${plural(total, "personne")} ${total > 1 ? "ont" : "a"} terminé cette campagne. ` +
    `Elle${total > 1 ? "s" : ""} recevront l'étape ${plan.step} : ${parts.join(", ")}.`
  );
}

/**
 * **Pourquoi personne ne rouvre**, quand personne ne rouvre.
 *
 * Le défaut qui a coûté ce jalon n'est pas qu'aucune inscription n'ait été
 * rouverte : c'est que l'écran ait **enregistré sans rien dire**. Un ajout
 * d'étape qui ne rattrape personne alors que la campagne est pleine de gens
 * qui ont terminé est soit une règle trop étroite, soit une base qui ne dit
 * pas ce qu'on croit — et dans les deux cas, la seule chose à faire est de
 * montrer ce qui est écrit.
 *
 * Rend une chaîne vide quand il y a des candidats : il n'y a alors rien à
 * expliquer.
 */
export function describeSilence(plan: ReopenPlan): string {
  if (plan.candidates.length > 0) return "";

  const closed = plan.reasons.reduce((total, entry) => total + entry.count, 0);
  if (closed === 0) {
    return "Aucune inscription close sur cette campagne : il n'y a personne à rouvrir.";
  }

  if (plan.exhausted > 0) {
    return `${plural(
      plan.exhausted,
      "inscription",
    )} ${plan.exhausted > 1 ? "ont" : "a"} déjà reçu toutes les étapes existantes : ajoutez-en une de plus pour les rattraper.`;
  }

  const detail = plan.reasons
    .map((entry) => `${entry.count} × « ${entry.reason === "" ? "(aucun motif écrit)" : entry.reason} »`)
    .join(", ");
  return (
    `${plural(closed, "inscription")} close${closed > 1 ? "s" : ""}, ` +
    `aucune rouvrable. Motifs enregistrés : ${detail}. ` +
    "Seules les inscriptions arrêtées faute d'étape suivante se rouvrent ; " +
    "les autres protègent la personne."
  );
}

/**
 * Les exclus, nommés.
 *
 * **Voir la garde fonctionner est la moitié de la confiance** qu'on accorde au
 * bouton : « Margaux Keller (le contact a répondu) reste arrêtée » dit en une
 * ligne que la règle ne se contente pas d'exister.
 */
export function describeExclusions(excluded: readonly ReopenExclusion[]): string {
  if (excluded.length === 0) return "";
  const named = excluded
    .slice(0, 5)
    .map((entry) => `${entry.name} (${entry.reason.toLocaleLowerCase("fr-FR")})`)
    .join(", ");
  const rest = excluded.length > 5 ? `, et ${excluded.length - 5} autre(s)` : "";
  return `${plural(excluded.length, "inscription")} reste${
    excluded.length > 1 ? "nt" : ""
  } arrêtée${excluded.length > 1 ? "s" : ""} : ${named}${rest}.`;
}
