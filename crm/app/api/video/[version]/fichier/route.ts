import { notFound, serverError } from "@/lib/api/errors";
import { readVideoFile } from "@/lib/api/mail-video";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sert le **fichier vidéo**, quand c'est nous qui l'hébergeons.
 *
 * **Publique par nécessité**, et pour une raison de plus que la vignette : c'est
 * la destination du clic. Le destinataire n'a pas de compte chez nous, et une
 * route privée le renverrait vers un écran de connexion — soit exactement le
 * lien mort qu'on s'interdit.
 *
 * Elle ne compte rien non plus. Un compteur de lectures serait un pistage de
 * clic, c'est-à-dire ce que la demande écarte en refusant qu'un traceur externe
 * voyage avec la vignette : le remplacer par le nôtre ne vaudrait pas mieux.
 * Aucune adresse IP, aucun agent utilisateur — la règle du jalon 37.
 *
 * ## Pourquoi `Range`
 *
 * Un navigateur qui lit une vidéo ne la télécharge pas d'un bloc : il demande
 * des tranches, et **Safari refuse de jouer un fichier servi sans
 * `Accept-Ranges`**. Sans cela, le lien téléchargerait le film au lieu de le
 * jouer, ou ne ferait rien du tout. Une seule plage est gérée : c'est ce que les
 * navigateurs envoient, et une plage multiple demanderait un corps
 * `multipart/byteranges` que rien n'utilise ici.
 *
 * Une plage illisible ou hors bornes rend **416** avec `Content-Range`, comme le
 * veut la spécification : répondre 200 et le fichier entier ferait repartir la
 * lecture au début à chaque saut dans la barre de progression.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ version: string }> },
) {
  try {
    const { version } = await context.params;
    const video = await readVideoFile();
    if (video === null) {
      return notFound("Aucune vidéo n'est hébergée ici.");
    }
    if (video.version !== version) {
      return notFound("Cette version de la vidéo n'existe plus.");
    }

    const total = video.bytes.byteLength;
    const etag = `"${video.version}"`;
    const common = {
      "Content-Type": video.mime === "" ? "video/mp4" : video.mime,
      ETag: etag,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    const range = request.headers.get("range");
    if (range === null) {
      if (request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers: { ETag: etag } });
      }
      return new Response(new Uint8Array(video.bytes), {
        status: 200,
        headers: { ...common, "Content-Length": String(total) },
      });
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    // `bytes=-500` (les 500 derniers octets) est légal ; on le traite plutôt que
    // de rendre 416, parce qu'un lecteur qui cherche l'index d'un MP4 commence
    // souvent par là.
    const rawStart = match?.[1] ?? "";
    const rawEnd = match?.[2] ?? "";
    let start: number;
    let end: number;
    if (match === null || (rawStart === "" && rawEnd === "")) {
      start = NaN;
      end = NaN;
    } else if (rawStart === "") {
      start = Math.max(0, total - Number(rawEnd));
      end = total - 1;
    } else {
      start = Number(rawStart);
      end = rawEnd === "" ? total - 1 : Math.min(Number(rawEnd), total - 1);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { ...common, "Content-Range": `bytes */${total}` },
      });
    }

    return new Response(new Uint8Array(video.bytes.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...common,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(end - start + 1),
      },
    });
  } catch (error) {
    return serverError("GET /api/video/[version]/fichier", error);
  }
}
