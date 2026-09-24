import { jsonOk, serverError } from "@/lib/api/errors";
import { sampleContacts } from "@/lib/api/manual-step";

export const dynamic = "force-dynamic";

/**
 * Les valeurs de fusion de quelques inscrits, pour l'aperçu en direct.
 *
 * La route rend **les valeurs, pas le texte rendu** : la substitution vit dans
 * `lib/domain/merge-tags`, et l'éditeur l'applique lui-même à chaque frappe.
 * Deux bénéfices, dont un seul est visible : l'aperçu est instantané et ne
 * demande aucun aller-retour, et surtout **c'est la même fonction que la
 * composition**. Un aperçu calculé par le serveur avec son propre rendu aurait
 * fini par montrer autre chose que ce qui part.
 *
 * `GET`, et non `POST` : elle ne lit que des fiches et n'écrit rien.
 */
export async function GET(request: Request) {
  const sequenceId = new URL(request.url).searchParams.get("sequenceId") ?? "";
  try {
    return jsonOk({ samples: sequenceId === "" ? [] : await sampleContacts(sequenceId) });
  } catch (error) {
    return serverError("GET /api/sequences-email/preview", error);
  }
}
