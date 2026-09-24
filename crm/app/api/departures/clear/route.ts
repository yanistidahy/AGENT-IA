import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { clearDepartures, listDepartures } from "@/lib/api/departures";

export const dynamic = "force-dynamic";

/**
 * Vider la file des départs en attente.
 *
 * Sa propre route, distincte des trois décisions de `/api/departures` : celles-ci
 * portent sur **une** ligne et sont réversibles à l'échelle d'un contact, tandis
 * que celle-ci jette tout ce qui est affiché. Les mêler sous un même verbe
 * aurait fait d'un `action` mal formé une file vidée.
 *
 * La portée est celle de l'écran : une campagne quand on arrive de sa page, tout
 * le CRM sinon. Le compte annoncé dans la confirmation est donc exactement celui
 * des lignes qu'on a sous les yeux.
 */
const schema = z.object({ campaignId: z.string().min(1).optional() });

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const outcome = await clearDepartures({ campaignId: parsed.data.campaignId });
    return jsonOk({
      ...outcome,
      departures: await listDepartures(new Date(), { campaignId: parsed.data.campaignId }),
    });
  } catch (error) {
    return serverError("POST /api/departures/clear", error);
  }
}
