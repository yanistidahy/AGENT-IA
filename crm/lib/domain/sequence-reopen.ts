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

/**
 * Cette inscription a-t-elle été fermée **faute d'étape suivante** ?
 *
 * Le statut *et* le motif sont vérifiés, alors que le premier suffirait
 * aujourd'hui : `done` n'est écrit qu'à cet endroit. La redondance coûte une
 * comparaison et ferme la porte au jour où un autre chemin écrirait `done`
 * pour autre chose — une relance envoyée par erreur ne se rattrape pas.
 */
export function reopenable(status: string, stopReason: string): boolean {
  return status === FINISHED_STATUS && stopReason === BLOCK_LABELS.finished;
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

export interface ReopenPlan {
  /** L'étape que ces personnes recevront. */
  readonly step: number;
  readonly candidates: readonly ReopenCandidate[];
  /** Arrêtées pour un motif qui les protège : nommées, jamais rouvertes. */
  readonly excluded: readonly ReopenExclusion[];
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
