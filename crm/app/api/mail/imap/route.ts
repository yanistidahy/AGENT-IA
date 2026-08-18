import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { prisma } from "@/lib/db";
import { readMailStatus } from "@/lib/api/mail";
import { readImapStatus } from "@/lib/api/imap";
import { readTrackingConfig } from "@/lib/api/email-sends";
import { readLimits } from "@/lib/api/send-rate";

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

  /**
   * Plafonds d'envoi. Le maximum accepté reste bas volontairement : au-delà,
   * ce n'est plus de la prospection, c'est de l'emailing de masse, et ce n'est
   * pas ce que cette boîte est faite pour porter.
   */
  sendPerHour: z.number().int().min(1, "Au moins un envoi par heure").max(500),
  sendPerDay: z.number().int().min(1, "Au moins un envoi par jour").max(2000),
});

async function currentHourlyCeiling(): Promise<number> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { sendPerHour: true },
  });
  return row?.sendPerHour ?? 30;
}

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    // **Relever le plafond à la main acquitte le bandeau.** C'est le seul
    // geste qui vaut « j'ai compris ce que le serveur m'a opposé » ; l'effacer
    // tout seul au bout d'un moment le ferait disparaître sans qu'on l'ait lu.
    const clearing =
      parsed.data.sendPerHour > (await currentHourlyCeiling())
        ? { sendLimitNotice: "", sendLimitNoticeAt: null }
        : {};

    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: { ...parsed.data, ...clearing },
      create: { id: "singleton", ...parsed.data },
    });

    const mail = await readMailStatus();
    return jsonOk({
      imap: await readImapStatus(mail, mail.passwordSet),
      tracking: await readTrackingConfig(),
      limits: await readLimits(),
    });
  } catch (error) {
    return serverError("PATCH /api/mail/imap", error);
  }
}
