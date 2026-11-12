import {
  renderActivePage,
  renderClosedPage,
  renderConfirmingPage,
  renderPayablePage,
  renderUnknownPage,
} from "@/lib/api/subscription-page";
import { beginCheckout, getPublicView } from "@/lib/api/subscriptions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * **La page de paiement d'un client : publique, et fermée par son jeton.**
 *
 * Publique au sens du middleware — le client n'a pas de session — et privée par
 * un jeton de 256 bits que seule la personne à qui on l'a envoyé connaît. Un
 * jeton inconnu et un jeton mal formé reçoivent la même page 404 : rien n'apprend
 * à un tiers si un jeton existe.
 *
 * ## Deux verbes, deux raisons
 *
 * - `GET` **n'écrit rien** et ne crée rien chez Mollie. Les messageries, les
 *   antivirus et les aperçus de lien ouvrent les adresses avant le destinataire ;
 *   si l'ouverture déclenchait un paiement, chacun en fabriquerait un.
 * - `POST` (le bouton) crée le paiement et redirige vers la page de Mollie.
 */

const HTML = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } as const;

interface Context {
  readonly params: Promise<{ token: string }>;
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: HTML });
}

export async function GET(request: Request, context: Context): Promise<Response> {
  const { token } = await context.params;
  const view = await getPublicView(token);
  if (view === null) return html(renderUnknownPage(), 404);

  const url = new URL(request.url);
  const returned = url.searchParams.get("retour") === "1";
  const failed = url.searchParams.get("erreur") === "1";

  if (view.status === "active" || view.status === "past_due") return html(renderActivePage(view));
  if (view.status === "canceled") return html(renderClosedPage(view.status));

  // En attente : le client revient de chez Mollie, la confirmation n'est peut-être
  // pas encore arrivée. On le dit et la page se rafraîchit seule.
  if (returned && view.paymentStarted) return html(renderConfirmingPage(view));

  return html(renderPayablePage(view, token, failed ? "error" : returned ? "returned" : "none"));
}

export async function POST(_request: Request, context: Context): Promise<Response> {
  const { token } = await context.params;
  const result = await beginCheckout(token);

  switch (result.kind) {
    case "unknown":
      return html(renderUnknownPage(), 404);
    case "not_payable":
      // Déjà payé, ou lien fermé : la page dit où on en est.
      return new Response(null, {
        status: 303,
        headers: { location: `/api/abonnement/${encodeURIComponent(token)}?retour=1`, "cache-control": "no-store" },
      });
    case "error":
      return new Response(null, {
        status: 303,
        headers: { location: `/api/abonnement/${encodeURIComponent(token)}?erreur=1`, "cache-control": "no-store" },
      });
    case "redirect":
      return new Response(null, {
        status: 303,
        headers: { location: result.url, "cache-control": "no-store" },
      });
  }
}
