import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  enroll,
  enrollSchema,
  listSequences,
  saveSequence,
  sequenceSchema,
} from "@/lib/api/email-sequences";
import { composeAfterSave } from "@/lib/api/compose-now";

export const dynamic = "force-dynamic";
// Ces routes composent : jusqu'à dix brouillons, donc autant d'appels au
// modèle, dans la requête. Au-delà, `composeForCampaign` passe en arrière-plan
// — mais le plafond doit couvrir le cas en ligne, sinon le proxy couperait sur
// un travail déjà payé.
export const maxDuration = 300;

/**
 * Séquences d'emails : définition et inscriptions.
 *
 * `PUT` porte l'inscription plutôt que `POST` : c'est une opération sur des
 * contacts, pas la création d'une séquence, et les mêler sous un seul verbe
 * aurait obligé la charge utile à porter un champ « type » que le serveur
 * n'aurait pu que croire.
 */
export async function GET() {
  try {
    return jsonOk({ sequences: await listSequences() });
  } catch (error) {
    return serverError("GET /api/sequences-email", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = sequenceSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await saveSequence(parsed.data);
    if (!result.ok) return badRequest(result.message);

    // **« Enregistrer » compose. C'est tout l'objet du jalon 56.**
    //
    // C'est ici que l'on écrit la consigne d'une étape et que l'on active la
    // séquence : c'est donc ici que la campagne devient prête, et c'est ce clic
    // que l'on attend de voir suivi d'effet. L'enregistrement était le seul
    // geste du parcours qui ne composait pas — on enregistrait, la file restait
    // vide, et il fallait trouver un second bouton ou attendre le lendemain.
    //
    // Rien n'est envoyé : la file se remplit, on la relit, on valide à la main.
    const composition = await composeAfterSave(result.sequence.id);

    return jsonOk({
      sequence: result.sequence,
      composition,
      sequences: await listSequences(),
    });
  } catch (error) {
    return serverError("POST /api/sequences-email", error);
  }
}

export async function PUT(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = enrollSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    return jsonOk({ outcome: await enroll(parsed.data), sequences: await listSequences() });
  } catch (error) {
    return serverError("PUT /api/sequences-email", error);
  }
}
