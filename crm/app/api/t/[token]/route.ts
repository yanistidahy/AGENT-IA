import { recordOpen } from "@/lib/api/email-sends";

/**
 * Le pixel de suivi d'ouverture.
 *
 * **Servi depuis notre propre domaine, et par personne d'autre.** Aucun service
 * tiers ne voit qui ouvre quoi : c'est la condition pour que le suivi reste une
 * donnée qu'on maîtrise, qu'on peut purger, et dont on peut répondre.
 *
 * **Publique par nécessité**, et sans rien révéler : la route répond exactement
 * la même image qu'un jeton soit connu, inconnu, déjà purgé ou malformé.
 * Répondre différemment en ferait un oracle permettant d'énumérer les envois.
 * Elle est donc listée dans `PUBLIC_PREFIXES` du middleware — un client de
 * messagerie ne présente aucun cookie de session.
 *
 * **`no-store`** : sans cette en-tête, le proxy d'images de Gmail met le pixel
 * en cache et les ouvertures suivantes ne reviennent jamais. Elle n'empêche pas
 * le cache — Gmail fait ce qu'il veut — mais ne pas la poser garantirait le
 * problème.
 */

/** Un GIF transparent de 1×1, le plus petit fichier image valide. */
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // L'enregistrement est attendu avant de répondre, mais il ne peut pas faire
  // échouer la réponse : `recordOpen()` avale ses propres erreurs. Une image
  // cassée dans la boîte d'un prospect serait un prix absurde pour un compteur.
  await recordOpen(token);

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}
