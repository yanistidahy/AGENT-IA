import { fetchTeam, hasLemlistKey } from "@/lib/api/lemlist-client";
import { MISSING_KEY_MESSAGE } from "@/lib/domain/lemlist";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * **« Tester la connexion » : un appel, et un verdict.**
 *
 * `GET /api/team?version=v2` est choisi exprès : c'est l'appel le moins bavard
 * de l'API — il ne lit **aucune donnée de prospect** et ne consomme aucun
 * crédit —, et sa seule réussite établit ce qu'on veut savoir. C'est la leçon
 * du bouton de diagnostic du jalon 16 : un bouton qui dit la cause au premier
 * clic vaut une demi-journée de débogage.
 *
 * `POST` et non `GET` : la route dépense un appel chez un tiers, et une route
 * qui consomme un quota ne doit pas répondre à un préchargement de navigateur.
 *
 * **La réponse ne contient jamais la clé**, ni un fragment de celle-ci. Sur un
 * 401 elle rend « clé refusée par lemlist » et s'arrête là : citer le message de
 * l'API, qui répète parfois le début du jeton, ressemblerait à une fuite. C'est
 * l'écart déjà fixé au jalon 16 pour Anthropic, et un test le vérifie sur le
 * corps réellement rendu.
 */
export async function POST() {
  try {
    if (!hasLemlistKey()) {
      return jsonOk({
        ok: false,
        status: "missing_key",
        message: MISSING_KEY_MESSAGE,
        team: "",
      });
    }

    const result = await fetchTeam();
    if (!result.ok) {
      return jsonOk({
        ok: false,
        status: result.error.kind === "refused" ? "refused" : "unknown",
        message: result.error.message,
        team: "",
      });
    }

    return jsonOk({
      ok: true,
      status: "connected",
      // Le nom de l'espace de travail est la preuve utile : il dit **quel**
      // compte la clé ouvre, ce qu'un simple « connecté » ne dit pas.
      message:
        result.data.name === ""
          ? "Connecté à lemlist."
          : `Connecté à lemlist (espace « ${result.data.name} »).`,
      team: result.data.name,
    });
  } catch (error) {
    return serverError("POST /api/lemlist/test", error);
  }
}
