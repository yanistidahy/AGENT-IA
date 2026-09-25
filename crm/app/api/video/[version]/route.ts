import { notFound, serverError } from "@/lib/api/errors";
import { readVideoPoster } from "@/lib/api/mail-video";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sert la **vignette** de la vidéo de démonstration.
 *
 * **Publique par nécessité**, comme le logo du jalon 62 et le pixel du
 * jalon 37 : elle est chargée par le client de messagerie d'un destinataire,
 * qui ne présente aucun cookie. Une route privée rendrait une image cassée dans
 * chaque message.
 *
 * Elle ne divulgue rien : un seul fichier, le même pour tout le monde, celui
 * qu'on a soi-même mis dans ses courriels. Elle ne lit aucune donnée métier, ne
 * distingue pas ses appelants, **et ne compte rien** — compter les chargements
 * d'une vignette reviendrait à mesurer les ouvertures par une seconde porte,
 * sans l'avoir dit. C'est exactement ce que la demande interdisait : « aucun
 * pixel de suivi externe qui voyagerait avec elle ».
 *
 * La version est **dans le chemin** et non en paramètre : elle fait partie de
 * l'identité de la ressource, remplacer la vidéo change l'adresse, et un an de
 * cache ne peut donc jamais servir une vignette périmée. Une version inconnue
 * rend 404 plutôt que l'image courante — servir autre chose que ce qui est
 * demandé ferait mentir le cache de tous les messages déjà partis.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ version: string }> },
) {
  try {
    const { version } = await context.params;
    const poster = await readVideoPoster();
    if (poster === null) return notFound("Aucune vidéo n'est configurée.");
    if (poster.version !== version) {
      return notFound("Cette version de la vignette n'existe plus.");
    }

    const etag = `"${poster.version}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return new Response(new Uint8Array(poster.bytes), {
      status: 200,
      headers: {
        "Content-Type": poster.mime,
        "Content-Length": String(poster.bytes.byteLength),
        ETag: etag,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return serverError("GET /api/video/[version]", error);
  }
}
