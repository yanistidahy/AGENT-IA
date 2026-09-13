import { notFound, serverError } from "@/lib/api/errors";
import { readMailLogo } from "@/lib/api/mail-logo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sert le logo de la signature.
 *
 * **Publique par nécessité**, comme le pixel de suivi du jalon 37 : elle est
 * chargée par le client de messagerie d'un destinataire, qui ne présente aucun
 * cookie. Une route privée rendrait une image cassée dans chaque message.
 *
 * Elle ne divulgue rien : un seul fichier, le même pour tout le monde, celui
 * qu'on a soi-même mis dans ses courriels. Elle ne lit aucune donnée métier et
 * ne distingue pas ses appelants — pas de compteur, pas de jeton, pas de trace.
 * **Ce n'est pas un pixel de suivi déguisé**, et c'est pour cela qu'on ne
 * compte rien ici : mesurer les chargements d'un logo reviendrait à pister les
 * ouvertures par une seconde porte, sans l'avoir dit.
 *
 * La version est **dans le chemin** et non en paramètre : elle fait partie de
 * l'identité de la ressource, remplacer le logo change l'adresse, et un an de
 * cache ne peut donc jamais servir un logo périmé. Une version inconnue rend
 * 404 plutôt que l'image courante — servir autre chose que ce qui est demandé
 * ferait mentir le cache de tous les messages déjà partis.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ version: string }> },
) {
  try {
    const { version } = await context.params;
    const logo = await readMailLogo();
    if (logo === null) return notFound("Aucun logo n'est configuré.");
    if (logo.version !== version) return notFound("Cette version du logo n'existe plus.");

    const etag = `"${logo.version}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return new Response(new Uint8Array(logo.png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(logo.png.byteLength),
        ETag: etag,
        // `public` : l'image est la même pour tout le monde, et les relais de
        // messagerie — Gmail en tête — la mettent de toute façon en cache.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return serverError("GET /api/logo/[version]", error);
  }
}
