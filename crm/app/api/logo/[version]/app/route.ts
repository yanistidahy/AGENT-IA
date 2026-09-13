import { notFound, serverError } from "@/lib/api/errors";
import { readChromeLogo } from "@/lib/api/mail-logo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sert le logo à l'interface : rail, favicon, page de connexion.
 *
 * **Même source que la signature, autre rendu.** Le logo est téléversé une
 * fois ; ce qui diffère ici, ce sont les contraintes — plus large, non
 * palettisé, sans le plafond de 20 Ko qui existe pour la délivrabilité et non
 * pour notre propre écran (jalon 63).
 *
 * **Publique, comme sa voisine, et pour une raison de plus.** `/login` s'affiche
 * par définition sans session : un logo privé y laisserait un trou, sur l'écran
 * qui doit justement dire où l'on arrive. La favicon, elle, est demandée par le
 * navigateur hors de tout rendu de page. Et il n'y a rien à divulguer : c'est la
 * même image que celle déjà partie dans chaque courriel.
 *
 * Comme sa voisine, elle **ne compte rien** — pas de jeton, pas de trace — et
 * rend 404 sur une version inconnue plutôt que l'image courante.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ version: string }> },
) {
  try {
    const { version } = await context.params;
    const logo = await readChromeLogo();
    if (logo === null) return notFound("Aucun logo n'est configuré.");
    if (logo.version !== version) return notFound("Cette version du logo n'existe plus.");

    // L'étiquette distingue les deux rendus : ils partagent une version mais
    // pas leurs octets, et un ETag commun ferait servir l'un pour l'autre.
    const etag = `"${logo.version}-app"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return new Response(new Uint8Array(logo.png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(logo.png.byteLength),
        ETag: etag,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return serverError("GET /api/logo/[version]/app", error);
  }
}
