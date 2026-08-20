import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { logActivity } from "./activities";
import { ownerOrDefault } from "./automation";
import { prisma as db } from "../db";
import { readMailConfig, readMailStatus, sendMail, PASSWORD_ENV } from "./mail";
import { copyToSent } from "./imap";
import {
  newTrackToken,
  pixelUrl,
  readTrackingConfig,
  recordSend,
} from "./email-sends";
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
  /** Le signataire retenu, pour que le journal sache qui a écrit. */
  signatoryId: z.string().optional(),
  signatoryName: z.string().optional(),
  /**
   * De quelle séquence vient ce message, s'il en vient une.
   *
   * Recopié sur la ligne d'envoi **et** dans l'interaction : quand un prospect
   * finit par répondre, il faut savoir à quoi il répond, et « séquence
   * Prospection froide, étape 2 » ne se reconstitue pas après coup.
   */
  sequenceId: z.string().optional(),
  sequenceName: z.string().optional(),
  sequenceStep: z.number().int().min(1).max(3).optional(),
  /**
   * Suivi d'ouverture pour **cet** envoi.
   *
   * Absent vaut « suis le réglage global ». Un pixel rend le message
   * détectable comme de la prospection en masse et peut coûter la
   * délivrabilité : le choix se fait donc message par message, en plus de
   * l'interrupteur global.
   */
  track: z.boolean().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

export interface SentEmail {
  readonly to: string;
  readonly contactName: string;
  readonly subject: string;
  readonly activityId: string;
  /** Date pré-remplie de la relance proposée après l'envoi. */
  readonly suggestedReminder: Date;
  /** Le message a-t-il été déposé dans « Envoyés » ? */
  readonly copied: boolean;
  /**
   * L'erreur de copie, s'il y en a une.
   *
   * **Elle n'empêche jamais l'envoi de réussir.** Le courriel est parti ; le
   * rattraper est impossible. Remonter l'échec comme une erreur d'envoi ferait
   * croire qu'on peut réessayer, et un second message partirait.
   */
  readonly copyError: string | null;
  /** Le suivi d'ouverture a-t-il été posé sur ce message ? */
  readonly tracked: boolean;
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

  // Le jeton est **émis avant l'envoi**, parce que l'URL du pixel doit se
  // trouver dans le message lui-même. Il n'est écrit en base qu'après un envoi
  // réussi : un jeton orphelin ne servirait qu'à compter des ouvertures d'un
  // message jamais parti.
  const tracking = await readTrackingConfig();
  const wanted = input.track ?? tracking.enabled;
  const trackToken =
    wanted && tracking.enabled && tracking.baseUrl !== "" ? newTrackToken() : null;

  const sent = await sendMail({
    to,
    subject,
    body: input.body,
    trackingUrl: trackToken === null ? "" : pixelUrl(tracking.baseUrl, trackToken),
  });
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
    notes: `${
      input.sequenceName === undefined || input.sequenceName === ""
        ? ""
        : `[Séquence « ${input.sequenceName} », étape ${input.sequenceStep ?? "?"}]\n`
    }Objet : ${subject}\n\n${input.body}`,
    // **Pas d'issue.** On vient d'écrire ; on ne sait pas encore si l'on a été
    // lu. Renseigner une issue ferait entrer cet envoi dans le taux de réponse,
    // qui ne compte que les échanges dont le résultat est connu (jalon 20).
  });

  // **La copie « Envoyés » vient après**, et son échec ne remonte jamais comme
  // un échec d'envoi. Le message est parti : ce qui reste à faire, c'est le
  // dire.
  const config = await readMailConfig();
  // **La copie déposée ne porte pas le pixel** (jalon 43) : sans quoi ouvrir son
  // propre dossier « Envoyés » compterait comme une ouverture du prospect.
  const copy = await copyToSent(sent.rawForArchive, config, process.env[PASSWORD_ENV] ?? "", now);

  await recordSend(
    {
      contactId: contact.id,
      toAddress: to,
      subject,
      body: input.body,
      messageId: sent.messageId,
      signatoryId: input.signatoryId ?? "",
      signatoryName: input.signatoryName ?? "",
      trackToken,
      sequenceId: input.sequenceId ?? "",
      sequenceName: input.sequenceName ?? "",
      sequenceStep: input.sequenceStep ?? null,
      copyStatus: copy.ok ? "copied" : "failed",
      copyError: copy.ok ? "" : copy.message,
    },
    now,
  );

  const delays = await getReminderDelays();

  return {
    ok: true,
    sent: {
      to,
      contactName: `${contact.firstName} ${contact.lastName}`.trim(),
      subject,
      activityId: logged.activity.id,
      suggestedReminder: addDays(now, delays.email),
      copied: copy.ok,
      copyError: copy.ok ? null : copy.message,
      tracked: trackToken !== null,
    },
  };
}
