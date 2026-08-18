import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { prisma } from "@/lib/db";
import { readMailStatus } from "@/lib/api/mail";
import { readImapStatus } from "@/lib/api/imap";
import { readTrackingConfig } from "@/lib/api/email-sends";

export const dynamic = "force-dynamic";

/**
 * La copie « Envoyés » et le suivi d'ouverture — leur propre route.
 *
 * **Séparée de `PATCH /api/mail`, et ce n'est pas de la dispersion.** Les deux
 * formulaires s'éditent indépendamment à l'écran ; un seul corps de requête
 * ferait écraser les modifications non enregistrées de l'un par
 * l'enregistrement de l'autre. Chaque formulaire pose ce qu'il gouverne, et
 * rien de plus.
 *
 * Ni identifiant ni mot de passe : IMAP réutilise ceux du SMTP. C'est la même
 * boîte, et un second jeu d'identifiants serait une seconde occasion de se
 * tromper plus un secret de plus à ne pas laisser fuir.
 */
const schema = z.object({
  imapHost: z.string().trim().max(200),
  imapPort: z.number().int().min(1).max(65535),
  imapEncryption: z.enum(["tls", "starttls"], { error: "Mode de chiffrement inconnu" }),
  /** Repli quand aucun dossier ne porte le drapeau special-use. Vide accepté. */
  imapSentMailbox: z.string().trim().max(200),
  imapCopyEnabled: z.boolean(),

  trackOpens: z.boolean(),
  /**
   * Une ouverture est une donnée de comportement : la garder indéfiniment n'est
   * pas défendable. Le maximum est bas volontairement — au-delà de cinq ans, ce
   * n'est plus une durée de conservation, c'est une absence de durée.
   */
  openRetentionMonths: z
    .number()
    .int()
    .min(1, "Au moins un mois")
    .max(60, "Cinq ans au maximum"),
});

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });

    const mail = await readMailStatus();
    return jsonOk({
      imap: await readImapStatus(mail, mail.passwordSet),
      tracking: await readTrackingConfig(),
    });
  } catch (error) {
    return serverError("PATCH /api/mail/imap", error);
  }
}
