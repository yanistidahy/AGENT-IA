import { z } from "zod";
import { applyTaskIntent, ownerOrDefault, staleDealsWithoutTask } from "@/lib/api/automation";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { prisma } from "@/lib/db";
import { staleDealTask } from "@/lib/domain/automation";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  dealIds: z.array(z.string().trim().min(1)).min(1, "Aucune affaire à réveiller"),
});

/**
 * Crée les tâches de réveil des affaires en sommeil, en une fois.
 *
 * Action **explicite**, jamais déclenchée par la simple lecture d'un écran :
 * `/api/alerts` est lu par les agents, dont Brutus qui est en lecture seule par
 * conception. Une alerte qui écrirait en base au moment d'être affichée
 * transformerait une consultation en modification — l'inverse de la règle.
 *
 * Idempotent : `stale:<affaire>` est unique, relancer l'action ne crée pas de
 * seconde tâche, elle met la même à jour.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const pending = await staleDealsWithoutTask(parsed.data.dealIds);
    if (pending.length === 0) return jsonOk({ created: 0, titles: [] });

    const deals = await prisma.deal.findMany({
      where: { id: { in: pending } },
      select: { id: true, name: true, owner: true },
    });

    const now = new Date();
    const titles = await prisma.$transaction(async (tx) => {
      const done: string[] = [];
      for (const deal of deals) {
        const outcome = await applyTaskIntent(
          tx,
          staleDealTask({
            dealId: deal.id,
            dealName: deal.name,
            owner: await ownerOrDefault(tx, deal.owner),
            from: now,
          }),
        );
        if (outcome !== null) done.push(outcome.title);
      }
      return done;
    });

    return jsonOk({ created: titles.length, titles }, 201);
  } catch (error) {
    return serverError("POST /api/deals/wake-stale", error);
  }
}
