import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readMailboxUsage } from "@/lib/api/mailbox-cap";
import { overCapNotice } from "@/lib/domain/mailbox-cap";
import { readJson } from "@/lib/api/request";
import { draftEmail } from "@/lib/agents/email-draft";
import { departureDraft } from "@/lib/api/departures";
import { sendEmailSchema, sendEmailToContact } from "@/lib/api/email-send";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Rédaction et envoi d'un courriel à un contact.
 *
 * Deux modes explicites plutôt que deux routes : `draft` demande le premier
 * brouillon, `send` envoie ce que l'utilisateur a relu.
 *
 * **Il n'y a pas de mode « reprise ».** Depuis le jalon 34, réécrire passe par la
 * conversation avec Alex (`/api/chat`), qui rend le brouillon dans un bloc
 * marqué. Garder ici un second chemin de réécriture aurait fait deux
 * implémentations d'une même chose, dont une seule serait exercée. Nommer le mode évite qu'une
 * requête mal formée déclenche un envoi par accident — même précaution que le
 * champ `operation` de `/api/maintenance`.
 *
 * **L'envoi n'est jamais décidé par le modèle.** Alex propose un texte ; c'est
 * un formulaire, relu par un humain qui voit l'adresse du destinataire, qui
 * déclenche `send`. Aucun outil d'agent ne peut envoyer de courriel.
 */
/**
 * Rouvrir un départ déjà composé — **sans appeler le modèle**.
 *
 * Le brouillon existe et a été payé : le rouvrir doit rendre *ce* texte. Passer
 * par `draft` en écrirait un second, effaçant celui qu'on venait relire.
 */
const departureSchema = z.object({
  mode: z.literal("departure"),
  departureId: z.string().min(1, "Départ requis"),
});

const draftSchema = z.object({
  mode: z.literal("draft"),
  contactId: z.string().min(1, "Contact requis"),
  /** L'échange qui vient d'être consigné, pour que le message s'y réfère. */
  fromActivityId: z.string().optional(),
});

const bodySchema = z.discriminatedUnion("mode", [
  draftSchema,
  departureSchema,
  sendEmailSchema.extend({ mode: z.literal("send") }),
]);

/**
 * L'avertissement de plafond, par boîte, pour le panneau de rédaction.
 *
 * **Un email écrit à la main n'est jamais bloqué** : il répond à quelque chose,
 * et le refuser ferait perdre une conversation pour protéger une moyenne. Il
 * est compté comme les autres, et l'écran prévient quand la boîte est au-delà
 * de son plafond, pour que personne ne découvre après coup pourquoi ses départs
 * de campagne ne partent plus. Vide sous le plafond : une alerte qui sonne
 * toujours n'est plus lue.
 */
async function capNotices(): Promise<Record<string, string>> {
  const usage = await readMailboxUsage();
  const notices: Record<string, string> = {};
  for (const entry of usage) {
    const notice = overCapNotice(entry);
    if (notice !== "") notices[entry.mailboxId] = notice;
  }
  return notices;
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    if (parsed.data.mode === "departure") {
      const result = await departureDraft(parsed.data.departureId);
      if (!result.ok) return badRequest(result.message);
      return jsonOk({ draft: { ...result.draft, capNotices: await capNotices() } });
    }

    if (parsed.data.mode === "draft") {
      const result = await draftEmail(parsed.data.contactId, parsed.data.fromActivityId);
      if (!result.ok) return badRequest(result.message);
      return jsonOk({ draft: { ...result.draft, capNotices: await capNotices() } });
    }

    const result = await sendEmailToContact(parsed.data);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ sent: result.sent });
  } catch (error) {
    return serverError("POST /api/emails", error);
  }
}
