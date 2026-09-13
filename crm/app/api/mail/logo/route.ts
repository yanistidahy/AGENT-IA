import { badRequest, jsonOk, serverError } from "@/lib/api/errors";
import {
  deleteMailLogo,
  MAX_LOGO_UPLOAD,
  readLogoSummary,
  storeMailLogo,
} from "@/lib/api/mail-logo";
import { logoWeight } from "@/lib/domain/signature-logo";
import { publicBaseUrl } from "@/lib/api/email-sends";
import { logoUrl } from "@/lib/domain/signature-logo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Téléversement et retrait du logo de signature.
 *
 * **Privée**, contrairement à la route qui *sert* le logo : poser un logo est
 * un geste d'administration, le charger est un geste de client de messagerie.
 * Les deux ne sauraient partager un régime d'accès.
 *
 * La réponse porte le **verdict de poids** plutôt qu'un simple « enregistré » :
 * c'est ici que la décision se prend, et un logo trop lourd doit se dire au
 * moment où on le choisit, pas se découvrir dans les statistiques de
 * délivrabilité trois semaines plus tard.
 */
async function state() {
  const summary = await readLogoSummary();
  if (summary === null) {
    return { logo: null, url: "", warnings: [] as readonly string[] };
  }

  // Le corps n'est pas connu ici : le verdict ne porte donc que sur le poids
  // absolu. La part « le message est trop court » se calcule à la rédaction,
  // où le texte existe.
  const verdict = logoWeight({ logoBytes: summary.bytes, bodyChars: 0 });
  return {
    logo: {
      version: summary.version,
      width: summary.width,
      bytes: summary.bytes,
      updatedAt: summary.updatedAt,
    },
    // Vide quand aucune adresse publique n'est connue : l'écran doit pouvoir
    // dire que le logo ne partira pas, plutôt que d'afficher un lien mort.
    url: logoUrl(publicBaseUrl(), summary.version),
    warnings: verdict.reasons,
  };
}

export async function GET() {
  try {
    return jsonOk(await state());
  } catch (error) {
    return serverError("GET /api/mail/logo", error);
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) {
      return badRequest("Aucun fichier reçu. Le champ attendu s'appelle « logo ».");
    }

    // Le poids est vérifié sur l'en-tête avant lecture en mémoire : accepter
    // 40 Mo pour les refuser ensuite laisserait saturer le conteneur.
    if (file.size > MAX_LOGO_UPLOAD) {
      const mo = (file.size / (1024 * 1024)).toFixed(1);
      return badRequest(`Image trop lourde (${mo} Mo). La limite est de 5 Mo.`);
    }

    const stored = await storeMailLogo(
      Buffer.from(await file.arrayBuffer()),
      file.type === "" ? "application/octet-stream" : file.type,
    );
    if (!stored.ok) return badRequest(stored.message);

    return jsonOk(await state());
  } catch (error) {
    return serverError("POST /api/mail/logo", error);
  }
}

export async function DELETE() {
  try {
    await deleteMailLogo();
    return jsonOk(await state());
  } catch (error) {
    return serverError("DELETE /api/mail/logo", error);
  }
}
