import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { backfillMessageIds, relinkOrphanSends } from "@/lib/api/sent-backfill";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Rattraper les `Message-ID` du passé depuis le dossier « Envoyés ».
 *
 * `POST` et non `GET` : la route ouvre une session IMAP, et sous `apply` elle
 * écrit. Une route qui produit un effet ne répond pas à un préchargement de
 * navigateur — même règle que le relevé et que le diagnostic d'API.
 *
 * **Simulation par défaut** : `apply` doit être demandé explicitement. C'est le
 * contrat de toutes les corrections de données depuis le jalon 11.
 */
const schema = z.object({ apply: z.boolean().default(false) });

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = schema.safeParse(body.value ?? {});
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const report = await backfillMessageIds(parsed.data.apply);
    // Le re-rattachement des envois orphelins suit le même geste : les deux
    // réparent la même restauration, et les séparer en deux boutons ferait
    // qu'on en oublierait un.
    const relink = await relinkOrphanSends(parsed.data.apply);
    return jsonOk({ report, relink });
  } catch (error) {
    return serverError("POST /api/mail/backfill", error);
  }
}
