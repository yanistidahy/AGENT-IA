import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { applyReopen, listSequences, planReopen } from "@/lib/api/email-sequences";
import {
  describeExclusions,
  describeReopen,
  describeSilence,
} from "@/lib/domain/sequence-reopen";

export const dynamic = "force-dynamic";

/**
 * Rouvrir les inscriptions qu'une séquence avait épuisées.
 *
 * **Deux verbes, deux gestes**, et c'est la discipline du produit depuis le
 * jalon 8 : `POST` regarde et ne touche à rien — il compose la phrase de
 * confirmation à partir des étapes **proposées**, avant qu'elles soient
 * enregistrées ; `PUT` rouvre, après que l'utilisateur a lu cette phrase.
 *
 * Une seule route aurait fait de l'affichage d'un écran une relance de
 * cinquante-deux personnes.
 */

const planSchema = z.object({
  sequenceId: z.string().min(1),
  steps: z.array(z.object({ delayDays: z.number().int().min(0).max(90) })).min(1),
});

const applySchema = z.object({ sequenceId: z.string().min(1) });

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = planSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const plan = await planReopen(parsed.data.sequenceId, parsed.data.steps);
    return jsonOk({
      plan,
      // Les phrases sont composées **au serveur**, par le domaine : dites une
      // seconde fois dans le navigateur, elles finiraient par ne plus dire la
      // même chose que ce que le bouton fait.
      message: describeReopen(plan),
      exclusions: describeExclusions(plan.excluded),
      // Vide dès qu'il y a des candidats : il n'y a alors rien à expliquer.
      silence: describeSilence(plan),
    });
  } catch (error) {
    return serverError("POST /api/sequences-email/reopen", error);
  }
}

export async function PUT(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = applySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const outcome = await applyReopen(parsed.data.sequenceId);
    return jsonOk({ ...outcome, sequences: await listSequences() });
  } catch (error) {
    return serverError("PUT /api/sequences-email/reopen", error);
  }
}
