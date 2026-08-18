import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "../db";

/**
 * Le journal des emails réellement partis, et le suivi d'ouverture.
 *
 * **Distinct de l'interaction consignée.** L'interaction est la trace lisible
 * dans la chronologie d'une fiche ; cette table-ci porte les faits qu'on veut
 * compter. Compter depuis les interactions mélangerait les envois avec les
 * appels et les notes de correction — c'est le piège du jalon 22, déjà payé une
 * fois.
 *
 * ## Ce que le suivi d'ouverture mesure, et ce qu'il ne mesure pas
 *
 * **Le chiffre est systématiquement surestimé, et ce n'est pas un défaut
 * d'implémentation.** Apple Mail Privacy Protection charge *toutes* les images
 * d'un message à la réception, que quiconque l'ait lu ou non ; Gmail les fait
 * passer par un proxy qui les met en cache, ce qui écrase les ouvertures
 * suivantes. Un message compté « ouvert » peut n'avoir jamais été affiché, et
 * un message réellement lu peut n'être jamais compté si les images sont
 * bloquées.
 *
 * C'est pour cela que l'écran écrit « Ouvertures (estimation) » et donne la
 * raison en une ligne. Un nombre auquel on se fie aveuglément vaut moins qu'un
 * nombre qu'on lit avec précaution.
 *
 * ## Ce qui est stocké, et ce qui ne l'est pas
 *
 * **Un jeton opaque, une date, un compteur.** Pas d'adresse IP, pas d'agent
 * utilisateur, pas de service tiers, aucun profil de navigation. Une ouverture
 * est une donnée personnelle au sens du RGPD : elle est conservée le temps
 * réglé — douze mois par défaut — puis purgée, sans que l'envoi lui-même, qui
 * est un fait de gestion, disparaisse.
 */

export interface TrackingConfig {
  readonly enabled: boolean;
  readonly retentionMonths: number;
  /** Base publique des URL de pixel. Vide = suivi impossible, et c'est dit. */
  readonly baseUrl: string;
}

/**
 * L'adresse publique du CRM, pour composer l'URL du pixel.
 *
 * Lue dans l'environnement plutôt que réglée à l'écran : c'est une propriété du
 * déploiement, pas une préférence. Railway renseigne `RAILWAY_PUBLIC_DOMAIN`
 * seul ; `CRM_PUBLIC_URL` permet de la forcer derrière un domaine personnalisé.
 * Sans l'une des deux, **aucun pixel n'est posé** — une URL devinée pointerait
 * vers un hôte qui ne répond pas, et chaque message porterait une image cassée.
 */
export function publicBaseUrl(): string {
  const explicit = (process.env.CRM_PUBLIC_URL ?? "").trim();
  if (explicit !== "") return explicit.replace(/\/+$/, "");

  const railway = (process.env.RAILWAY_PUBLIC_DOMAIN ?? "").trim();
  if (railway !== "") return `https://${railway.replace(/\/+$/, "")}`;

  return "";
}

export async function readTrackingConfig(): Promise<TrackingConfig> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { trackOpens: true, openRetentionMonths: true },
  });

  return {
    enabled: row?.trackOpens ?? true,
    retentionMonths: row?.openRetentionMonths ?? 12,
    baseUrl: publicBaseUrl(),
  };
}

/** Un jeton opaque, non devinable, sans lien avec le destinataire. */
export function newTrackToken(): string {
  return randomBytes(16).toString("hex");
}

export function pixelUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/t/${token}`;
}

export interface RecordSendInput {
  readonly contactId: string;
  readonly toAddress: string;
  readonly subject: string;
  readonly body: string;
  readonly messageId: string;
  readonly signatoryId: string;
  readonly signatoryName: string;
  readonly trackToken: string | null;
  readonly sequenceId: string;
  readonly sequenceName: string;
  readonly sequenceStep: number | null;
  readonly copyStatus: "copied" | "failed" | "disabled" | "unconfigured";
  readonly copyError: string;
}

/**
 * Écrit l'envoi **et** les compteurs de la fiche, dans une seule transaction.
 *
 * Les compteurs sont dénormalisés pour que les colonnes « Emails envoyés » et
 * « Dernier email » soient triables en SQL. Les écrire à côté, hors
 * transaction, les laisserait diverger de la table au premier échec — et une
 * colonne de tri qui ment est pire qu'une colonne absente.
 */
export async function recordSend(input: RecordSendInput, now: Date): Promise<string> {
  const [send] = await prisma.$transaction([
    prisma.emailSend.create({
      data: {
        sentAt: now,
        contactId: input.contactId,
        toAddress: input.toAddress,
        subject: input.subject,
        body: input.body,
        messageId: input.messageId,
        signatoryId: input.signatoryId,
        signatoryName: input.signatoryName,
        tracked: input.trackToken !== null,
        trackToken: input.trackToken,
        sequenceId: input.sequenceId,
        sequenceName: input.sequenceName,
        sequenceStep: input.sequenceStep,
        copyStatus: input.copyStatus,
        copyError: input.copyError,
      },
      select: { id: true },
    }),
    prisma.contact.update({
      where: { id: input.contactId },
      data: { emailCount: { increment: 1 }, lastEmailAt: now },
    }),
  ]);

  return send.id;
}

/**
 * Enregistre une ouverture. Ne lève jamais, ne renvoie rien d'exploitable.
 *
 * **Un jeton inconnu est un non-évènement**, pas une erreur : la route répond
 * la même image dans tous les cas. Répondre différemment selon que le jeton
 * existe transformerait le pixel en oracle permettant d'énumérer les envois.
 */
export async function recordOpen(token: string, now = new Date()): Promise<void> {
  try {
    await prisma.emailSend.updateMany({
      where: { trackToken: token, firstOpenAt: null },
      data: { firstOpenAt: now },
    });
    await prisma.emailSend.updateMany({
      where: { trackToken: token },
      data: { lastOpenAt: now, openCount: { increment: 1 } },
    });
  } catch (error) {
    console.error("[suivi] ouverture non consignée", error);
  }
}

/**
 * Purge les données d'ouverture au-delà de la durée de conservation.
 *
 * **L'envoi reste, le suivi part.** L'envoi est un fait de gestion — savoir
 * qu'on a écrit à quelqu'un le 12 mars fait partie de la relation commerciale.
 * L'ouverture est une donnée de comportement, et rien ne justifie de la garder
 * indéfiniment. Le jeton est effacé avec elle : sans jeton, un pixel encore
 * chargé quelque part ne peut plus être rattaché à personne.
 */
export async function purgeOpens(now = new Date()): Promise<number> {
  const config = await readTrackingConfig();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - config.retentionMonths);

  const result = await prisma.emailSend.updateMany({
    where: { sentAt: { lt: cutoff }, purgedAt: null, tracked: true },
    data: {
      trackToken: null,
      firstOpenAt: null,
      lastOpenAt: null,
      openCount: 0,
      purgedAt: now,
    },
  });

  return result.count;
}

export interface ContactEmail {
  readonly id: string;
  readonly sequenceName: string;
  readonly sequenceStep: number | null;
  readonly sentAt: Date;
  readonly subject: string;
  readonly signatoryName: string;
  readonly tracked: boolean;
  readonly firstOpenAt: Date | null;
  readonly openCount: number;
  readonly copyStatus: string;
  readonly copyError: string;
}

/** Les emails envoyés à une fiche, du plus récent au plus ancien. */
export async function listContactEmails(contactId: string): Promise<ContactEmail[]> {
  return prisma.emailSend.findMany({
    where: { contactId },
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      sequenceName: true,
      sequenceStep: true,
      sentAt: true,
      subject: true,
      signatoryName: true,
      tracked: true,
      firstOpenAt: true,
      openCount: true,
      copyStatus: true,
      copyError: true,
    },
  });
}
