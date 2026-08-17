import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { prisma } from "@/lib/db";
import { readMailStatus, sendMail, PASSWORD_ENV } from "@/lib/api/mail";
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
  host: z.string().trim().max(200),
  port: z.number().int().min(1).max(65535),
  encryption: z.enum(["tls", "starttls"], { error: "Mode de chiffrement inconnu" }),
  user: z.string().trim().max(200),
  from: z.union([z.literal(""), z.email("Adresse d'expédition invalide")]),
  fromName: z.string().trim().max(120),
});

export async function GET() {
  try {
    return jsonOk({ mail: await readMailStatus(), passwordEnv: PASSWORD_ENV });
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
      smtpHost: parsed.data.host,
      smtpPort: parsed.data.port,
      smtpEncryption: parsed.data.encryption,
      smtpUser: parsed.data.user,
      smtpFrom: parsed.data.from,
      smtpFromName: parsed.data.fromName,
    };

    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });

    return jsonOk({ mail: await readMailStatus(), passwordEnv: PASSWORD_ENV });
  } catch (error) {
    return serverError("PATCH /api/mail", error);
  }
}

export async function POST() {
  try {
    const status = await readMailStatus();
    if (!status.ready) {
      return badRequest(`Configuration incomplète : il manque ${status.missing.join(", ")}.`);
    }

    const now = new Date();
    const result = await sendMail({
      to: status.from,
      subject: "Essai d'envoi depuis AuraFLOW",
      // Deux paragraphes séparés d'une ligne vide : le message d'essai vérifie
      // aussi la mise en forme, pas seulement la connexion. Recevoir un pavé
      // compact ici voudrait dire que le reste arrivera compact aussi.
      body: `Cet essai confirme que la messagerie du CRM sait envoyer.\n\nSi ce message vous parvient en deux paragraphes séparés par une ligne vide, la mise en forme est correcte. Envoyé le ${now.toLocaleString("fr-FR")}.`,
    });

    if (!result.ok) return badRequest(result.message);
    return jsonOk({ sentTo: status.from, messageId: result.messageId });
  } catch (error) {
    return serverError("POST /api/mail", error);
  }
}
