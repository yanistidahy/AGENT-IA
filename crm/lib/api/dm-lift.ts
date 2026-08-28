import { prisma } from "../db";
import { REAL_ACTIVITY } from "./real-activity";
import { readReplyFacts } from "./email-replies";
import { dmLift, type DmLift, type DmLiftRow } from "../domain/dm-lift";

/**
 * La comparaison « DM puis email » contre « email seul », lue en base.
 *
 * Elle réutilise les deux mêmes briques que l'entonnoir de `/emails` — le
 * premier envoi par personne, et `readReplyFacts` pour savoir qui a répondu
 * **après** lui. Recalculer « a répondu » ici en produirait une seconde
 * définition, et deux définitions d'une même chose finissent toujours par
 * donner deux chiffres différents sur deux écrans.
 *
 * Le seul fait propre à ce module est le DM : le plus récent **antérieur au
 * premier email**. La borne est portée par la requête, pas par un filtre
 * appliqué après coup, pour qu'un DM envoyé en réaction à un email ne puisse
 * pas se faire passer pour une prise de contact préalable.
 */
export async function readDmLift(windowDays: number, now = new Date()): Promise<DmLift> {
  const since = new Date(now);
  since.setDate(since.getDate() - windowDays);

  const sends = await prisma.emailSend.findMany({
    where: { sentAt: { gte: since }, contactId: { not: null } },
    select: { contactId: true, sentAt: true },
    orderBy: { sentAt: "asc" },
  });

  const firstSend = new Map<string, Date>();
  for (const send of sends) {
    if (send.contactId === null) continue;
    const known = firstSend.get(send.contactId);
    if (known === undefined || send.sentAt < known) firstSend.set(send.contactId, send.sentAt);
  }

  if (firstSend.size === 0) return dmLift([]);

  const [facts, dms] = await Promise.all([
    readReplyFacts(firstSend),
    prisma.activity.findMany({
      where: {
        ...REAL_ACTIVITY,
        type: "instagram",
        contactId: { in: [...firstSend.keys()] },
      },
      select: { contactId: true, date: true },
      orderBy: { date: "asc" },
    }),
  ]);

  // Le DM le plus récent **avant** le premier email : c'est celui qui a préparé
  // le terrain. Un DM postérieur laisse la ligne dans le groupe « sans DM ».
  const dmBefore = new Map<string, Date>();
  for (const dm of dms) {
    if (dm.contactId === null) continue;
    const emailAt = firstSend.get(dm.contactId);
    if (emailAt === undefined || dm.date >= emailAt) continue;
    const known = dmBefore.get(dm.contactId);
    if (known === undefined || dm.date > known) dmBefore.set(dm.contactId, dm.date);
  }

  const rows: DmLiftRow[] = [];
  for (const [contactId, firstEmailAt] of firstSend) {
    rows.push({
      contactId,
      firstEmailAt,
      dmBeforeAt: dmBefore.get(contactId) ?? null,
      repliedAt: facts.get(contactId)?.repliedAt ?? null,
    });
  }

  return dmLift(rows);
}
