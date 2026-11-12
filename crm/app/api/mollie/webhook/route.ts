import { isMolliePaymentId } from "@/lib/domain/subscriptions";
import { applyPaymentWebhook } from "@/lib/api/subscriptions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * **Le webhook Mollie : public, sans secret, et sûr quand même.**
 *
 * Mollie ne signe pas ses appels : le corps ne porte qu'un identifiant
 * (`id=tr_…`, en formulaire). Ce n'est pas une faille de la route, c'est le
 * contrat — et la défense est ailleurs : `applyPaymentWebhook` **relit le
 * paiement chez Mollie avec notre clé** avant de décider quoi que ce soit. Un
 * appel forgé avec un identifiant inventé reçoit un 404 de Mollie et n'écrit
 * rien ; un identifiant réel ne peut produire que ce que Mollie confirme.
 *
 * ## Les codes de réponse
 *
 * - **200** quand l'appel est traité, et aussi quand l'identifiant est mal formé
 *   ou inconnu : rejouer ne le rendrait pas valide, et un 4xx ferait de cette
 *   route un outil de sondage.
 * - **500** sur un échec transitoire (Mollie injoignable, base indisponible) :
 *   c'est le seul moyen de demander à Mollie de rejouer.
 */
export async function POST(request: Request): Promise<Response> {
  let id = "";
  try {
    const form = await request.formData();
    const raw = form.get("id");
    id = typeof raw === "string" ? raw.trim() : "";
  } catch {
    return new Response(null, { status: 200 });
  }
  if (!isMolliePaymentId(id)) return new Response(null, { status: 200 });

  try {
    const outcome = await applyPaymentWebhook(id);
    return new Response(null, { status: outcome === "retry" ? 500 : 200 });
  } catch (error) {
    console.error("[mollie] webhook", error);
    return new Response(null, { status: 500 });
  }
}
