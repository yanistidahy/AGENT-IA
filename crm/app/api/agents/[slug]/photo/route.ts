import { badRequest, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { deleteAgentPhoto, readAgentPhoto, storeAgentPhoto } from "@/lib/api/agent-photo";
import { isPhotoSize, MAX_UPLOAD_BYTES } from "@/lib/domain/agent-identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sert un portrait.
 *
 * La route est **privée** : le middleware exige une session comme pour toute
 * autre route, et c'est voulu. Un portrait n'est pas une donnée personnelle de
 * prospect, mais rien ne justifie d'ouvrir une route de plus au monde entier
 * alors que le jalon 9 vient de tout fermer par défaut.
 *
 * Cache : `v=<version>` dans l'URL désigne un contenu **immuable** — remplacer
 * la photo change la version, donc l'URL. On peut donc poser un an de cache
 * sans jamais servir une photo périmée. Sans jeton de version, on retombe sur
 * une revalidation systématique, seule façon honnête de rester frais.
 * `private` parce que la réponse dépend de la session : un cache partagé n'a
 * rien à faire là.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const url = new URL(request.url);

    const requested = url.searchParams.get("size") ?? "portrait";
    if (!isPhotoSize(requested)) {
      return badRequest("Taille inconnue. Utilisez « portrait » ou « thumb ».");
    }

    const acceptsWebp = (request.headers.get("accept") ?? "").includes("image/webp");
    const photo = await readAgentPhoto(slug, requested, acceptsWebp);
    if (photo === null) return notFound("Cet agent n'a pas de portrait.");

    // L'encodage servi fait partie de l'identité de la réponse : deux
    // navigateurs recevant des octets différents ne doivent pas partager un ETag.
    const etag = `"${photo.version}-${requested}-${acceptsWebp ? "webp" : "jpeg"}"`;
    const versioned = url.searchParams.get("v");

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return new Response(new Uint8Array(photo.bytes), {
      status: 200,
      headers: {
        "Content-Type": photo.mime,
        "Content-Length": String(photo.bytes.byteLength),
        ETag: etag,
        Vary: "Accept",
        "Cache-Control":
          versioned === null
            ? "private, no-cache, must-revalidate"
            : "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return serverError("GET /api/agents/[slug]/photo", error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;

    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return badRequest("Aucun fichier reçu. Le champ attendu s'appelle « photo ».");
    }

    // Le poids est vérifié sur l'en-tête du fichier avant de le lire en
    // mémoire : accepter 40 Mo pour les refuser ensuite reviendrait à laisser
    // n'importe qui saturer la mémoire du conteneur.
    if (file.size > MAX_UPLOAD_BYTES) {
      const mo = (file.size / (1024 * 1024)).toFixed(1);
      return badRequest(`Image trop lourde (${mo} Mo). La limite est de 5 Mo.`);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await storeAgentPhoto(slug, file.type, bytes);
    if (!result.ok) return badRequest(result.message);

    return jsonOk({ version: result.version });
  } catch (error) {
    return serverError("POST /api/agents/[slug]/photo", error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    await deleteAgentPhoto(slug);
    return jsonOk({ removed: true });
  } catch (error) {
    return serverError("DELETE /api/agents/[slug]/photo", error);
  }
}
