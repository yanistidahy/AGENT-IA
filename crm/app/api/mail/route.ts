import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { prisma } from "@/lib/db";
import { readMailStatus, sendMail, PASSWORD_ENV } from "@/lib/api/mail";
import { listSignatories } from "@/lib/api/signatories";
import { listMailboxViews, mailboxesSchema, saveMailboxes } from "@/lib/api/mailboxes";
import { readImapStatus } from "@/lib/api/imap";
import { readTrackingConfig } from "@/lib/api/email-sends";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Configuration de la messagerie sortante, et essai d'envoi.
 *
 * `GET` rend l'état — **jamais le mot de passe**, seulement s'il est défini.
 * `PATCH` enregistre la configuration. `POST` envoie un message d'essai à sa
 * propre adresse d'expédition.
 *
 * L'essai est un `POST` et non un `GET` : il envoie un vrai courriel, et une
 * route qui produit un effet ne doit pas répondre à un préchargement de
 * navigateur. Même raison que le diagnostic d'API du jalon 16.
 */
const configSchema = z.object({
  demoLabel: z.string().trim().max(80),
  /**
   * Vide **est** une valeur valide : elle demande à Alex de supprimer la phrase
   * de démonstration. Exiger une URL forcerait à en inventer une.
   */
  demoUrl: z.union([z.literal(""), z.url("Adresse du lien invalide")]),

});

/** L'état complet lu par le panneau — jamais un secret, seulement son existence. */
async function mailState() {
  const mail = await readMailStatus();
  return {
    mail,
    passwordEnv: PASSWORD_ENV,
    // Chaque boîte avec la variable qui porte son secret : c'est ce que le
    // panneau affiche à côté du champ, pour qu'on sache quoi poser sur Railway.
    mailboxes: await listMailboxViews(),
    signatories: await listSignatories(),
    imap: await readImapStatus(mail, mail.passwordSet),
    tracking: await readTrackingConfig(),
  };
}

export async function GET() {
  try {
    return jsonOk(await mailState());
  } catch (error) {
    return serverError("GET /api/mail", error);
  }
}

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = configSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const data = {
      demoLabel: parsed.data.demoLabel,
      demoUrl: parsed.data.demoUrl,
    };

    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });

    return jsonOk(await mailState());
  } catch (error) {
    return serverError("PATCH /api/mail", error);
  }
}

/**
 * La liste des boîtes, remplacée d'un bloc.
 *
 * `PUT` et non `PATCH` : c'est la liste entière qui est posée — l'écran la
 * manipule complète. Le service, lui, met à jour **par identifiant** (le slug
 * ne bouge jamais) et refuse de supprimer une boîte tenue par une campagne, en
 * la nommant.
 */
export async function PUT(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = mailboxesSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const saved = await saveMailboxes(parsed.data);
    if (!saved.ok) return badRequest(saved.message);
    return jsonOk(await mailState());
  } catch (error) {
    return serverError("PUT /api/mail", error);
  }
}

const testSchema = z.object({ mailboxId: z.string().optional() });

export async function POST(request: Request) {
  const body = await readJson(request);
  const parsed = testSchema.safeParse(body.ok ? body.value : {});
  const mailboxId = parsed.success ? parsed.data.mailboxId : undefined;

  try {
    const status = await readMailStatus(mailboxId);
    if (!status.ready) {
      // La boîte est nommée : à trois boîtes, « configuration incomplète » sans
      // dire laquelle ferait vérifier les deux mauvaises d'abord.
      return badRequest(
        `Boîte « ${status.label} » incomplète : il manque ${status.missing.join(", ")}.`,
      );
    }

    const now = new Date();
    const result = await sendMail({
      mailboxId: status.mailboxId,
      to: status.from,
      subject: "Essai d'envoi depuis AuraFLOW",
      // Deux paragraphes séparés d'une ligne vide : le message d'essai vérifie
      // aussi la mise en forme, pas seulement la connexion. Recevoir un pavé
      // compact ici voudrait dire que le reste arrivera compact aussi.
      body: `Cet essai confirme que la messagerie du CRM sait envoyer.\n\nSi ce message vous parvient en deux paragraphes séparés par une ligne vide, la mise en forme est correcte. Envoyé le ${now.toLocaleString("fr-FR")}.`,
    });

    if (!result.ok) return badRequest(result.message);
    return jsonOk({ sentTo: status.from, mailboxLabel: status.label, messageId: result.messageId });
  } catch (error) {
    return serverError("POST /api/mail", error);
  }
}
