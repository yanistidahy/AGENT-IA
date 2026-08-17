import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "../db";
import {
  formatSender,
  hasBody,
  sanitizeSubject,
  toHtml,
  toPlainText,
} from "../domain/email-format";

/**
 * Envoi de courriels, par SMTP.
 *
 * **Le mot de passe ne quitte jamais le serveur, et n'entre jamais en base.**
 * Il vit dans `SMTP_PASSWORD`, comme `ANTHROPIC_API_KEY` : `import "server-only"`
 * en tête fait échouer le build si un composant client importe cette chaîne, et
 * aucune fonction d'ici ne rend la valeur. Le panneau de réglages apprend
 * seulement si elle est **définie**, jamais ce qu'elle vaut. La conséquence
 * voulue : une sauvegarde JSON, un export ou un `SELECT * FROM settings` ne
 * peuvent pas le contenir.
 *
 * SMTP et non OAuth, comme demandé : un hôte, un port, un identifiant, un mot
 * de passe. C'est ce que IONOS expose, et cela n'implique aucun jeton à
 * rafraîchir.
 *
 * **Réception hors périmètre.** Ce module envoie. Rien ne lit de boîte, rien ne
 * rattache une réponse à une fiche, et l'écran le dit — pour qu'on n'attende pas
 * dans le CRM des réponses qui arrivent dans la messagerie.
 */

export interface MailConfig {
  readonly host: string;
  readonly port: number;
  readonly encryption: "tls" | "starttls";
  readonly user: string;
  readonly from: string;
  readonly fromName: string;
}

/** Ce que l'écran a le droit de savoir du mot de passe : s'il existe. */
export interface MailStatus extends MailConfig {
  readonly passwordSet: boolean;
  /** Tout est renseigné et l'envoi peut être tenté. */
  readonly ready: boolean;
  /** Ce qui manque, nommé, pour que le panneau soit actionnable. */
  readonly missing: readonly string[];
}

export const PASSWORD_ENV = "SMTP_PASSWORD";

function password(): string {
  return process.env[PASSWORD_ENV] ?? "";
}

function toEncryption(value: string): "tls" | "starttls" {
  return value === "tls" ? "tls" : "starttls";
}

export async function readMailConfig(): Promise<MailConfig> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpEncryption: true,
      smtpUser: true,
      smtpFrom: true,
      smtpFromName: true,
    },
  });

  return {
    host: row?.smtpHost ?? "",
    port: row?.smtpPort ?? 587,
    encryption: toEncryption(row?.smtpEncryption ?? "starttls"),
    user: row?.smtpUser ?? "",
    from: row?.smtpFrom ?? "",
    fromName: row?.smtpFromName ?? "",
  };
}

/** Ce qui empêche d'envoyer, nommé champ par champ. */
export function missingFields(config: MailConfig, hasPassword: boolean): string[] {
  const missing: string[] = [];
  if (config.host.trim() === "") missing.push("l'hôte SMTP");
  if (config.user.trim() === "") missing.push("l'identifiant");
  if (config.from.trim() === "") missing.push("l'adresse d'expédition");
  if (!hasPassword) missing.push(`le mot de passe (variable ${PASSWORD_ENV})`);
  return missing;
}

export async function readMailStatus(): Promise<MailStatus> {
  const config = await readMailConfig();
  const passwordSet = password() !== "";
  const missing = missingFields(config, passwordSet);

  return { ...config, passwordSet, ready: missing.length === 0, missing };
}

/**
 * Un identifiant de message stable et conforme.
 *
 * Le domaine est celui de l'adresse d'expédition : un `Message-ID` dont le
 * domaine ne correspond pas à l'expéditeur est un signal négatif pour les
 * filtres anti-spam. Nodemailer en génère un, mais avec le nom d'hôte de la
 * machine — donc, sur Railway, un identifiant de conteneur.
 */
export function messageId(from: string, now: Date, random: string): string {
  const domain = from.split("@")[1] ?? "localhost";
  return `<${now.getTime()}.${random}@${domain}>`;
}

export interface SendInput {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export type SendResult =
  | { readonly ok: true; readonly messageId: string; readonly accepted: readonly string[] }
  | { readonly ok: false; readonly message: string };

/**
 * Traduit un échec SMTP en une phrase qui dit quoi faire.
 *
 * **Le message du serveur est repris tel quel**, comme pour le diagnostic de
 * l'API Anthropic au jalon 16 : c'est lui qui distingue « mot de passe refusé »
 * de « hôte injoignable » de « expéditeur non autorisé », et jeter cette
 * information coûte un aller-retour de débogage entier. Le code SMTP est cité
 * parce qu'il est ce qu'on retrouve dans la documentation du fournisseur.
 */
export function describeSmtpError(error: unknown): string {
  if (typeof error !== "object" || error === null) return "Échec de l'envoi, sans détail.";

  const shaped = error as { code?: string; responseCode?: number; response?: string; message?: string };
  const parts: string[] = [];

  if (shaped.code === "EAUTH" || shaped.responseCode === 535) {
    parts.push("Authentification refusée par le serveur : identifiant ou mot de passe incorrect.");
  } else if (shaped.code === "ECONNECTION" || shaped.code === "ESOCKET") {
    parts.push("Connexion au serveur impossible : vérifiez l'hôte, le port et le mode de chiffrement.");
  } else if (shaped.code === "ETIMEDOUT") {
    parts.push("Le serveur n'a pas répondu à temps.");
  } else if (shaped.responseCode === 550 || shaped.responseCode === 553) {
    parts.push("Le serveur a refusé l'adresse : l'expéditeur doit être une adresse de votre compte.");
  } else {
    parts.push("Le serveur SMTP a refusé l'envoi.");
  }

  // La réponse brute du serveur, qui nomme la vraie cause.
  const detail = (shaped.response ?? shaped.message ?? "").trim();
  if (detail !== "") parts.push(`Réponse du serveur : ${detail.slice(0, 300)}`);
  if (shaped.code !== undefined) parts.push(`(code ${shaped.code})`);

  return parts.join(" ");
}

/**
 * Envoie, et rend l'erreur exacte si le serveur refuse.
 *
 * Ne lève pas : l'appelant est une route qui doit rendre un message français à
 * l'écran, pas une trace d'exécution.
 */
export async function sendMail(input: SendInput): Promise<SendResult> {
  const config = await readMailConfig();
  const secret = password();
  const missing = missingFields(config, secret !== "");

  if (missing.length > 0) {
    return { ok: false, message: `Messagerie incomplète : il manque ${missing.join(", ")}.` };
  }

  const subject = sanitizeSubject(input.subject);
  if (subject === "") return { ok: false, message: "L'objet ne peut pas être vide." };
  if (!hasBody(input.body)) return { ok: false, message: "Le corps du message est vide." };

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // `secure` vaut TLS dès la connexion (port 465). Sinon on ouvre en clair
    // puis on **exige** STARTTLS : sans `requireTLS`, un serveur qui ne
    // l'annonce pas ferait passer le mot de passe en clair sans rien dire.
    secure: config.encryption === "tls",
    requireTLS: config.encryption === "starttls",
    auth: { user: config.user, pass: secret },
  });

  const id = messageId(config.from, new Date(), Math.random().toString(36).slice(2, 10));

  try {
    const info = await transport.sendMail({
      from: formatSender(config.fromName, config.from),
      to: input.to,
      // Les réponses reviennent dans la messagerie de l'utilisateur, pas dans le
      // CRM — la réception est hors périmètre, et l'écran le dit.
      replyTo: config.from,
      subject,
      messageId: id,
      date: new Date(),
      text: toPlainText(input.body),
      html: toHtml(input.body),
      // `format=fixed` : sans cela, un client peut recoller deux lignes
      // consécutives et détruire une adresse ou une liste tapée à la main.
      textEncoding: "quoted-printable",
    });

    return {
      ok: true,
      messageId: info.messageId ?? id,
      accepted: info.accepted.map((entry) => (typeof entry === "string" ? entry : entry.address)),
    };
  } catch (error) {
    // Jamais la configuration ni le secret dans le journal : seulement la cause.
    console.error("[mail] envoi refusé :", describeSmtpError(error));
    return { ok: false, message: describeSmtpError(error) };
  } finally {
    transport.close();
  }
}
