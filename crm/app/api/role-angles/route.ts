import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { readRoleCoverage, roleAnglesSchema, saveRoleAngles } from "@/lib/api/role-angles";

export const dynamic = "force-dynamic";

/**
 * Les rôles destinataires et leurs notes d'angle.
 *
 * `GET` rend les rôles **avec le nombre de fiches que chacun couvre**, la liste
 * des fonctions qu'aucun rôle ne reconnaît, et le nombre de fiches sans
 * fonction. Les trois ensemble : sans le second, on ne sait pas quelles
 * étiquettes ajouter ; sans le troisième, on chercherait une étiquette pour une
 * information qui n'existe pas.
 *
 * `PUT` remplace la liste entière — c'est un éditeur de liste, pas un
 * formulaire par ligne, et le panneau envoie ce qu'il affiche.
 *
 * Privée par le middleware, comme tout `/api/*` depuis le jalon 9.
 */
export async function GET() {
  try {
    return jsonOk(await readRoleCoverage());
  } catch (error) {
    return serverError("role-angles.read", error);
  }
}

export async function PUT(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Le corps de la requête n'est pas du JSON valide.");

  const parsed = roleAnglesSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const saved = await saveRoleAngles(parsed.data);
    // Un conflit d'étiquette n'est pas une panne : c'est une correction à faire
    // à l'écran, et le message nomme les deux rôles en cause.
    if (!saved.ok) return badRequest(saved.message);
    return jsonOk(await readRoleCoverage());
  } catch (error) {
    return serverError("role-angles.save", error);
  }
}
