import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { logActivity } from "./activities";
import { ownerOrDefault } from "./automation";
import { prisma as db } from "../db";
import { readMailStatus, sendMail } from "./mail";
import { sanitizeSubject } from "../domain/email-format";
import { addDays } from "../domain/dates";
import { getReminderDelays } from "./reference";

/**
 * Envoyer un courriel à un contact, et le consigner.
 *
 * **L'envoi et la consignation ne sont pas séparables** : un message parti sans
 * trace fausse l'historique de la fiche *et* le taux de réponse des rapports —
 * qui compte les interactions dont l'issue est connue. C'était la raison d'être
 * de l'exclusion `CORRECTION_OWNER` du jalon 22 ; envoyer sans consigner
 * rouvrirait le même trou par l'autre bout.
 *
 * L'ordre compte, et il n'est pas symétrique : **on envoie d'abord**. Une
 * interaction consignée pour un message que le serveur SMTP a refusé serait un
 * mensonge dans l'historique, et rien ne permettrait de la distinguer d'un envoi
 * réussi. À l'inverse, un envoi réussi dont la consignation échoue laisse un
 * courriel réellement parti et une erreur à l'écran : c'est désagréable, mais
 * c'est vrai. Entre les deux, on choisit celui qui ne ment pas.
 */

export const sendEmailSchema = z.object({
  contactId: z.string().min(1, "Contact requis"),
  subject: z.string().trim().min(1, "L'objet ne peut pas être vide").max(200),
  body: z.string().trim().min(1, "Le message ne peut pas être vide"),
  /** L'interaction d'où part la rédaction, s'il y en a une. Pour le journal. */
  fromActivityId: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

export interface SentEmail {
  readonly to: string;
  readonly contactName: string;
  readonly subject: string;
  readonly activityId: string;
  /** Date pré-remplie de la relance proposée après l'envoi. */
  readonly suggestedReminder: Date;
}

export type SendEmailResult =
  | { readonly ok: true; readonly sent: SentEmail }
  | { readonly ok: false; readonly message: string };

export async function sendEmailToContact(input: SendEmailInput): Promise<SendEmailResult> {
  const contact = await prisma.contact.findUnique({
    where: { id: input.contactId },
    select: { id: true, firstName: true, lastName: true, email: true, owner: true },
  });

  if (contact === null) return { ok: false, message: "Contact introuvable." };

  const to = contact.email.trim();
  if (to === "") {
    return {
      ok: false,
      message: "Ce contact n'a pas d'adresse électronique. Renseignez-la sur sa fiche.",
    };
  }

  const status = await readMailStatus();
  if (!status.ready) {
    return {
      ok: false,
      message: `Messagerie non configurée : il manque ${status.missing.join(", ")}. Voir Réglages → Messagerie.`,
    };
  }

  const subject = sanitizeSubject(input.subject);
  const sent = await sendMail({ to, subject, body: input.body });
  if (!sent.ok) return { ok: false, message: sent.message };

  // Envoyé pour de bon à partir d'ici : la consignation ne peut plus mentir.
  const now = new Date();
  // Un propriétaire vide sortirait cet envoi des tableaux par propriétaire de
  // /rapports : la fiche n'en a pas toujours un, le formulaire d'interaction
  // retombe déjà sur le premier de la liste, et l'envoi doit faire pareil.
  const owner = await ownerOrDefault(db, contact.owner);

  const logged = await logActivity({
    type: "email",
    date: now,
    owner,
    contactId: contact.id,
    // Objet **et** corps : « je lui ai écrit quoi, déjà ? » se répond depuis la
    // chronologie, sans aller chercher dans la messagerie.
    notes: `Objet : ${subject}\n\n${input.body}`,
    // **Pas d'issue.** On vient d'écrire ; on ne sait pas encore si l'on a été
    // lu. Renseigner une issue ferait entrer cet envoi dans le taux de réponse,
    // qui ne compte que les échanges dont le résultat est connu (jalon 20).
  });

  const delays = await getReminderDelays();

  return {
    ok: true,
    sent: {
      to,
      contactName: `${contact.firstName} ${contact.lastName}`.trim(),
      subject,
      activityId: logged.activity.id,
      suggestedReminder: addDays(now, delays.email),
    },
  };
}
