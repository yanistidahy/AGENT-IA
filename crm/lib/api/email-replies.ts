import "server-only";
import { prisma } from "../db";
import { REAL_ACTIVITY } from "./real-activity";
import { ANSWERED_OUTCOMES } from "../domain/status";

/**
 * Qui a répondu, et quand — la seule mesure fiable de ce que les emails
 * produisent.
 *
 * **Ce module existe pour qu'il n'y ait qu'une définition de « a répondu ».**
 * Trois surfaces la demandent maintenant : les chiffres de l'entête, la
 * colonne « Réponse » de la liste des envois, et le bloc « sans réponse ». Trois
 * calculs séparés finiraient par se contredire — et la contradiction serait
 * invisible, puisque chacun paraît juste isolément.
 *
 * Deux règles portent la définition :
 *
 * 1. **La réponse est postérieure à l'envoi.** Une conversation antérieure au
 *    message ne répond pas à ce message. C'est la borne qui empêche de compter
 *    comme succès un échange qu'on avait déjà.
 * 2. **Les notes de correction ne sont pas des interactions** (`REAL_ACTIVITY`,
 *    jalon 27). Sans cette exclusion, les 135 notes écrites par les reports de
 *    feuille passeraient pour autant de réponses de prospects.
 */

export interface ReplyFacts {
  /** Première réponse postérieure au premier envoi. `null` : personne n'a répondu. */
  readonly repliedAt: Date | null;
  /** Première interaction d'issue « RDV obtenu », même borne. */
  readonly metAt: Date | null;
}

/**
 * Les réponses des personnes écrites, par contact.
 *
 * `firstSend` porte, pour chaque contact, la date de son **premier** message :
 * c'est la borne à partir de laquelle une interaction compte comme réponse.
 */
export async function readReplyFacts(
  firstSend: ReadonlyMap<string, Date>,
): Promise<Map<string, ReplyFacts>> {
  const facts = new Map<string, ReplyFacts>();
  const contactIds = [...firstSend.keys()];
  if (contactIds.length === 0) return facts;

  const answers = await prisma.activity.findMany({
    where: {
      ...REAL_ACTIVITY,
      contactId: { in: contactIds },
      outcome: { in: [...ANSWERED_OUTCOMES] },
    },
    select: { contactId: true, outcome: true, date: true },
    orderBy: { date: "asc" },
  });

  for (const answer of answers) {
    if (answer.contactId === null) continue;
    const since = firstSend.get(answer.contactId);
    if (since === undefined || answer.date < since) continue;

    const known = facts.get(answer.contactId) ?? { repliedAt: null, metAt: null };
    facts.set(answer.contactId, {
      repliedAt: known.repliedAt ?? answer.date,
      metAt: known.metAt ?? (answer.outcome === "meeting" ? answer.date : null),
    });
  }

  return facts;
}

/** Les dates de réponse seules, telles que `signatoryLines()` les attend. */
export function replyDates(facts: ReadonlyMap<string, ReplyFacts>): Map<string, Date> {
  const dates = new Map<string, Date>();
  for (const [contactId, fact] of facts) {
    if (fact.repliedAt !== null) dates.set(contactId, fact.repliedAt);
  }
  return dates;
}
