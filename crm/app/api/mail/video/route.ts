import { badRequest, jsonOk, serverError } from "@/lib/api/errors";
import { deleteMailVideo, storeMailVideo } from "@/lib/api/mail-video";
import { readVideoPanelState } from "@/lib/api/video-panel";
import { MAX_VIDEO_UPLOAD } from "@/lib/domain/signature-video";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Réglage, téléversement et retrait de la vidéo de démonstration.
 *
 * **Privée**, contrairement aux deux routes qui *servent* la vignette et le
 * fichier : poser une vidéo est un geste d'administration, la charger est un
 * geste de client de messagerie ou de navigateur de destinataire. Les deux ne
 * sauraient partager un régime d'accès — c'est la distinction du jalon 62 entre
 * `/api/mail/logo` et `/api/logo/[version]`.
 *
 * La réponse porte le **verdict de poids de la vignette** plutôt qu'un simple
 * « enregistré » : c'est ici que la décision se prend, et une vignette trop
 * lourde doit se dire au moment où on la choisit.
 */
const state = readVideoPanelState;

export async function GET() {
  try {
    return jsonOk(await state());
  } catch (error) {
    return serverError("GET /api/mail/video", error);
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const kind = String(form.get("kind") ?? "hosted");
    const url = String(form.get("url") ?? "");
    const label = String(form.get("label") ?? "");

    const file = form.get("fichier");
    const poster = form.get("vignette");

    // Le poids est vérifié sur l'en-tête **avant** lecture en mémoire : accepter
    // un fichier de deux gigaoctets pour le refuser ensuite saturerait le
    // conteneur, dont le disque est une allocation fixe.
    if (file instanceof File && file.size > MAX_VIDEO_UPLOAD) {
      const mo = (file.size / (1024 * 1024)).toFixed(0);
      const limite = (MAX_VIDEO_UPLOAD / (1024 * 1024)).toFixed(0);
      return badRequest(
        `Vidéo trop lourde (${mo} Mo). La limite est de ${limite} Mo : au-delà, hébergez-la et collez son adresse.`,
      );
    }

    const stored = await storeMailVideo({
      kind,
      url,
      label,
      file:
        file instanceof File && file.size > 0
          ? {
              bytes: Buffer.from(await file.arrayBuffer()),
              mime: file.type === "" ? "application/octet-stream" : file.type,
            }
          : undefined,
      poster:
        poster instanceof File && poster.size > 0
          ? {
              bytes: Buffer.from(await poster.arrayBuffer()),
              mime: poster.type === "" ? "application/octet-stream" : poster.type,
            }
          : undefined,
    });
    if (!stored.ok) return badRequest(stored.message);

    return jsonOk(await state());
  } catch (error) {
    return serverError("POST /api/mail/video", error);
  }
}

export async function DELETE() {
  try {
    await deleteMailVideo();
    return jsonOk(await state());
  } catch (error) {
    return serverError("DELETE /api/mail/video", error);
  }
}
