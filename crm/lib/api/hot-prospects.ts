import "server-only";
import { prisma } from "../db";
import { auditHot, type ClickFact, type HotAudit } from "../domain/hot-clicks";
import { TERMINAL_LIFECYCLES } from "../domain/lost";

/**
 * **Les prospects chauds, lus une fois et servis à trois endroits.**
 *
 * Le compte du lien en tête de l'écran Tâches, la liste qu'ouvre
 * `/contacts?chauds=1`, et l'audit de la qualité des clics viennent tous de
 * cette fonction. Un second calcul aurait fini par annoncer un nombre que la
 * liste ne rend pas — c'est l'écart que le jalon 49 a payé entre une puce et sa
 * liste, et le jalon 78 entre une carte et son tableau.
 *
 * Les trois signaux sont ceux du jalon 92, **inchangés** : une réponse reçue, un
 * clic sur l'un de nos liens, un passage en Qualifié. L'ouverture du pixel n'en
 * fait toujours pas partie — elle surestime par construction (jalons 37 et 43),
 * et une file d'appels alimentée par des relais Apple ferait appeler des gens qui
 * n'ont rien fait.
 */

export const HOT_WINDOW_DAYS = 14;

export interface HotProspects {
  /** Les fiches à rappeler. **La même liste que celle du compte affiché.** */
  readonly ids: readonly string[];
  /** La décomposition de ce compte par la solidité du signal (jalon 105). */
  readonly audit: HotAudit;
}

function windowStart(now: Date): Date {
  return new Date(now.getTime() - HOT_WINDOW_DAYS * 86_400_000);
}

function alive(lifecycle: string): boolean {
  return !TERMINAL_LIFECYCLES.includes(lifecycle as (typeof TERMINAL_LIFECYCLES)[number]);
}

/**
 * Qui est chaud, et sur quoi ça repose.
 *
 * **La règle n'est pas changée par l'audit** : `ids` reste exactement ce que le
 * jalon 92 retenait, clics douteux compris. L'audit dit ce que ce total
 * perdrait si la règle changeait — mesurer avant de décider, la discipline du
 * jalon 43.
 */
export async function readHotProspects(now = new Date()): Promise<HotProspects> {
  const start = windowStart(now);

  const [clicks, replies, deals] = await Promise.all([
    prisma.emailLinkClick.findMany({
      where: { at: { gte: start } },
      select: {
        at: true,
        kind: true,
        emailSendId: true,
        emailSend: {
          select: { sentAt: true, contact: { select: { id: true, lifecycle: true } } },
        },
      },
    }),
    prisma.emailReply.findMany({
      where: { receivedAt: { gte: start } },
      select: { contact: { select: { id: true, lifecycle: true } } },
    }),
    // `Deal.createdAt` **est** la date de qualification depuis le jalon 22 :
    // l'affaire naît du geste « Qualifier », qui écrit les deux dans la même
    // transaction.
    prisma.deal.findMany({
      where: { createdAt: { gte: start }, contactId: { not: null } },
      select: { contact: { select: { id: true, lifecycle: true } } },
    }),
  ]);

  const facts: ClickFact[] = clicks.map((click) => ({
    sendId: click.emailSendId,
    kind: click.kind,
    at: click.at,
    sentAt: click.emailSend.sentAt,
    contactId:
      click.emailSend.contact !== null && alive(click.emailSend.contact.lifecycle)
        ? click.emailSend.contact.id
        : null,
  }));

  const other = new Set<string>();
  for (const reply of replies) {
    if (reply.contact !== null && alive(reply.contact.lifecycle)) other.add(reply.contact.id);
  }
  for (const deal of deals) {
    if (deal.contact !== null && alive(deal.contact.lifecycle)) other.add(deal.contact.id);
  }

  const audit = auditHot(facts, [...other]);
  const ids = new Set<string>(other);
  for (const id of audit.clicks.solidContacts) ids.add(id);
  for (const id of audit.clicks.suspectOnlyContacts) ids.add(id);

  return { ids: [...ids], audit };
}
