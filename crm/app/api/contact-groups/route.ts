import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  clearManualGroup,
  describeRecompute,
  readGroupCounts,
  recomputeContactGroups,
  setContactGroup,
} from "@/lib/api/contact-groups";
import { CONTACT_GROUPS } from "@/lib/domain/contact-group";

export const dynamic = "force-dynamic";
// Un recalcul relit toutes les fiches. À cent cinquante c'est instantané ; le
// plafond est là pour qu'un portefeuille plus gros ne soit pas coupé par le
// proxy sur un travail déjà à moitié écrit.
export const maxDuration = 300;

/**
 * Les groupes de fonction : compter, recalculer, corriger à la main.
 *
 * `GET` ne fait que lire — c'est ce qui permet à un écran d'afficher « 150
 * contacts jamais classés » sans rien écrire (règle du jalon 8 : une
 * consultation n'écrit pas).
 */
export async function GET() {
  try {
    return jsonOk({ counts: await readGroupCounts() });
  } catch (error) {
    return serverError("GET /api/contact-groups", error);
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("recompute") }),
  /** La correction à la main : elle met la fiche hors de portée du recalcul. */
  z.object({
    action: z.literal("set"),
    contactId: z.string().min(1),
    group: z.enum(CONTACT_GROUPS),
  }),
  /** Rendre la fiche au recalcul, quand la correction n'a plus lieu d'être. */
  z.object({ action: z.literal("auto"), contactId: z.string().min(1) }),
]);

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    if (parsed.data.action === "recompute") {
      const report = await recomputeContactGroups();
      return jsonOk({
        report,
        // La phrase est composée par le service, pas par l'écran : deux
        // formulations d'un même compte finiraient par ne plus s'accorder.
        message: describeRecompute(report),
        counts: await readGroupCounts(),
      });
    }

    if (parsed.data.action === "set") {
      await setContactGroup(parsed.data.contactId, parsed.data.group);
    } else {
      await clearManualGroup(parsed.data.contactId);
    }
    return jsonOk({ counts: await readGroupCounts() });
  } catch (error) {
    return serverError("POST /api/contact-groups", error);
  }
}
