import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  dropDeparture,
  listDepartures,
  postponeDeparture,
  removeFromSequence,
  rewriteDeparture,
  saveDeparture,
  sendDeparture,
} from "@/lib/api/departures";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * La file du matin : lecture, et les décisions.
 *
 * Trois décisions d'abord — envoyer, reporter d'un jour, retirer de la séquence.
 * Une file qui demanderait plus d'un geste par ligne serait contournée dès la
 * deuxième semaine, et c'est alors le mode automatique qu'on activerait trop
 * tôt.
 *
 * `rewrite` les rejoint parce qu'une carte vide ou périmée n'a aucune des trois
 * à offrir : ce qu'on veut n'est ni l'envoyer, ni la reporter, ni la retirer,
 * mais **celle-ci, à jour**. Sur une étape écrite à la main, elle ne coûte rien.
 *
 * `drop` la rejoint pour la raison inverse : `remove` arrêtait une inscription
 * quand on voulait seulement jeter un texte, et c'est la décision la plus lourde
 * qu'on prenait faute d'une plus légère.
 */
const decisionSchema = z.object({
  id: z.string().min(1),
  /*
    **La portée de l'écran, pour que la réponse rende la même file.**

    La route rendait `listDepartures()` sans portée : sur `/departs?campagne=…`,
    le premier clic remplaçait la liste bornée par celle de tout le CRM, et
    l'écran cessait de décrire ce que son bandeau annonçait. Trouvé en écrivant
    la recette au clic, pas à la lecture.
  */
  campaignId: z.string().min(1).optional(),
  action: z.enum(["send", "postpone", "remove", "rewrite", "drop"], { error: "Action inconnue" }),
});

/**
 * Enregistrer un brouillon retravaillé — **et rien d'autre**.
 *
 * Schéma distinct de `decisionSchema` : les trois décisions ne portent pas de
 * texte, et les mêler sous un seul verbe aurait obligé la charge utile à porter
 * un champ que le serveur n'aurait pu que croire. Surtout, un `action: "send"`
 * mal formé qui traînerait un objet et un corps ferait partir un message qu'on
 * voulait seulement enregistrer.
 */
const saveSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1, "L'objet ne peut pas être vide").max(200),
  body: z.string().min(1, "Le message ne peut pas être vide"),
});

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = saveSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await saveDeparture(parsed.data.id, parsed.data.subject, parsed.data.body);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ departures: await listDepartures() });
  } catch (error) {
    return serverError("PATCH /api/departures", error);
  }
}

export async function GET() {
  try {
    return jsonOk({ departures: await listDepartures() });
  } catch (error) {
    return serverError("GET /api/departures", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = decisionSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const { id, action } = parsed.data;
    // `"human"` en dur : cette route est celle de l'humain. Un envoi
    // automatique ne passe jamais par HTTP, il part du passage quotidien — et
    // c'est ce qui fait que le compteur de départs « validés à la main » ne peut
    // pas être gonflé par la machine.
    const result =
      action === "send"
        ? await sendDeparture(id, "human")
        : action === "postpone"
          ? await postponeDeparture(id)
          : action === "rewrite"
            ? await rewriteDeparture(id)
            : action === "drop"
              ? await dropDeparture(id)
              : await removeFromSequence(id);

    /*
      **L'échec rend la file lui aussi.** Rendre un 400 nu laissait l'écran sur
      son état d'avant le clic : un départ que le serveur venait de marquer
      « échoué », avec sa cause, s'affichait encore comme s'il n'avait rien
      tenté. Le message et la file voyagent donc ensemble dans les deux cas, et
      c'est la carte qui portera la cause.
    */
    const scope = parsed.data.campaignId === undefined ? {} : { campaignId: parsed.data.campaignId };
    const departures = await listDepartures(new Date(), scope);
    if (!result.ok) return jsonOk({ ok: false, message: result.message, departures });
    return jsonOk({ ok: true, message: result.message, departures });
  } catch (error) {
    return serverError("POST /api/departures", error);
  }
}
