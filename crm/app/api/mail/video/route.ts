import { badRequest, jsonOk, serverError } from "@/lib/api/errors";
import { deleteMailVideo, storeMailVideo } from "@/lib/api/mail-video";
import { readVideoPanelState } from "@/lib/api/video-panel";
import {
  MAX_VIDEO_UPLOAD,
  describeBodyFailure,
  describeOversize,
} from "@/lib/domain/signature-video";

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
    /*
      **Le poids se lit sur l'en-tête, avant de toucher au corps.**

      C'était le défaut de la première version : elle lisait `file.size`, qui
      n'existe qu'**après** `request.formData()`. Or c'est précisément cette
      analyse qui échoue quand le fichier est trop gros — le cadre a tronqué le
      corps, la frontière de fin manque, et le parseur lève. Le contrôle arrivait
      donc après la panne qu'il devait expliquer, et l'écran ne montrait qu'un
      500 muet.

      `Content-Length` est disponible avant toute lecture, il porte l'enveloppe
      multipart entière, et il suffit à rendre un refus qui nomme le poids réel et
      le geste à faire.
    */
    const declared = Number(request.headers.get("content-length") ?? "");
    const length = Number.isFinite(declared) ? declared : null;
    if (length !== null && length > MAX_VIDEO_UPLOAD) {
      return badRequest(describeOversize(length));
    }

    /*
      Le corps peut encore être illisible : requête sans `Content-Length`
      (transfert par morceaux), ou coupée par un intermédiaire — le proxy d'un
      hébergeur applique ses propres limites, que ce code ne connaît pas. On dit
      alors la cause probable plutôt que de laisser remonter un 500 générique.
    */
    let form: FormData;
    try {
      form = await request.formData();
    } catch (error) {
      console.error("[api] POST /api/mail/video — corps illisible", error);
      return badRequest(describeBodyFailure(length));
    }

    const kind = String(form.get("kind") ?? "hosted");
    const url = String(form.get("url") ?? "");
    const label = String(form.get("label") ?? "");

    const file = form.get("fichier");
    const poster = form.get("vignette");

    // Second filet, sur la taille réelle du fichier : une requête sans
    // `Content-Length` a traversé le contrôle précédent, et un multipart peut
    // porter plusieurs parties. Même phrase, une seule définition.
    if (file instanceof File && file.size > MAX_VIDEO_UPLOAD) {
      return badRequest(describeOversize(file.size));
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
