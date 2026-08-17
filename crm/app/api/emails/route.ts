import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { draftEmail, reviseEmail } from "@/lib/agents/email-draft";
import { sendEmailSchema, sendEmailToContact } from "@/lib/api/email-send";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Rédaction et envoi d'un courriel à un contact.
 *
 * Deux modes explicites plutôt que deux routes : `draft` demande un brouillon à
 * Alex, `send` envoie ce que l'utilisateur a relu. Nommer le mode évite qu'une
 * requête mal formée déclenche un envoi par accident — même précaution que le
 * champ `operation` de `/api/maintenance`.
 *
 * **L'envoi n'est jamais décidé par le modèle.** Alex propose un texte ; c'est
 * un formulaire, relu par un humain qui voit l'adresse du destinataire, qui
 * déclenche `send`. Aucun outil d'agent ne peut envoyer de courriel.
 */
const draftSchema = z.object({
  mode: z.literal("draft"),
  contactId: z.string().min(1, "Contact requis"),
  /** L'échange qui vient d'être consigné, pour que le message s'y réfère. */
  fromActivityId: z.string().optional(),
});

/**
 * Reprise d'un brouillon.
 *
 * `subject` et `body` sont ceux **affichés à l'écran**, retouches à la main
 * comprises : c'est le client qui les envoie, pas le serveur qui les relit en
 * base. Le serveur n'a d'ailleurs rien à relire — un brouillon n'existe nulle
 * part tant qu'il n'est pas envoyé, et c'est très bien ainsi.
 */
const reviseSchema = z.object({
  mode: z.literal("revise"),
  contactId: z.string().min(1, "Contact requis"),
  subject: z.string().max(200),
  body: z.string().min(1, "Le message ne peut pas être vide"),
  instruction: z.string().trim().min(1, "Dites ce qu'il faut changer").max(1000),
  fromActivityId: z.string().optional(),
});

const bodySchema = z.discriminatedUnion("mode", [
  draftSchema,
  reviseSchema,
  sendEmailSchema.extend({ mode: z.literal("send") }),
]);

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    if (parsed.data.mode === "draft") {
      const result = await draftEmail(parsed.data.contactId, parsed.data.fromActivityId);
      if (!result.ok) return badRequest(result.message);
      return jsonOk({ draft: result.draft });
    }

    if (parsed.data.mode === "revise") {
      const result = await reviseEmail(
        parsed.data.contactId,
        { subject: parsed.data.subject, body: parsed.data.body },
        parsed.data.instruction,
        parsed.data.fromActivityId,
      );
      if (!result.ok) return badRequest(result.message);
      return jsonOk({ draft: result.draft });
    }

    const result = await sendEmailToContact(parsed.data);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ sent: result.sent });
  } catch (error) {
    return serverError("POST /api/emails", error);
  }
}
