import { isClickKind, recordClick } from "@/lib/api/email-sends";
import { clickDestination } from "@/lib/api/mail";

/**
 * La redirection qui enregistre un clic sur un de nos liens.
 *
 * **Servie depuis notre propre domaine, et par personne d'autre** — même règle
 * que le pixel du jalon 37 : aucun tiers ne voit qui clique sur quoi. Elle ne
 * lit ni l'adresse IP ni l'agent utilisateur, et n'écrit qu'une ligne portant
 * le jeton, le lien suivi et l'instant.
 *
 * **Publique par nécessité**, et sans rien révéler : elle redirige vers la même
 * destination qu'un jeton soit connu, inconnu, purgé ou malformé. Répondre
 * différemment en ferait un oracle permettant d'énumérer les envois — et, pire
 * ici, un lien mort chez un prospect qui vient de cliquer.
 *
 * **Un lien mort est le seul échec inacceptable.** D'où l'ordre : la
 * destination est résolue d'abord, l'enregistrement ensuite, et il avale ses
 * propres erreurs. Faute de destination connue — aucune adresse publique,
 * aucune vidéo réglée — on renvoie vers l'accueil du CRM plutôt que vers rien.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; kind: string }> },
) {
  const { token, kind } = await params;
  const destination = isClickKind(kind) ? await clickDestination(kind) : "";
  const target = destination === "" ? new URL("/", request.url).toString() : destination;

  if (isClickKind(kind)) await recordClick(token, kind);

  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      // Un cache poserait deux problèmes : le clic suivant ne serait pas
      // compté, et un changement de destination ne serait pas suivi.
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
