import "server-only";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { prisma } from "../db";
import {
  formatSender,
  hasBody,
  sanitizeSubject,
  toHtml,
  toPlainText,
  withTrackingPixel,
  type DemoLink,
} from "../domain/email-format";
import { DEFAULT_DEMO, DEFAULT_SIGNATURE } from "../agents/prompts/company";

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
  /** Signature des brouillons : réglable pour que l'associé signe son nom. */
  readonly signName: string;
  readonly signTitle: string;
  /** Lien de démonstration. `demoUrl` vide supprime la phrase entière. */
  readonly demoLabel: string;
  readonly demoUrl: string;
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
      signName: true,
      signTitle: true,
      demoLabel: true,
      demoUrl: true,
    },
  });

  return {
    host: row?.smtpHost ?? "",
    port: row?.smtpPort ?? 587,
    encryption: toEncryption(row?.smtpEncryption ?? "starttls"),
    user: row?.smtpUser ?? "",
    from: row?.smtpFrom ?? "",
    fromName: row?.smtpFromName ?? "",
    signName: row?.signName ?? DEFAULT_SIGNATURE.name,
    signTitle: row?.signTitle ?? DEFAULT_SIGNATURE.title,
    demoLabel: row?.demoLabel ?? DEFAULT_DEMO.label,
    demoUrl: row?.demoUrl ?? DEFAULT_DEMO.url,
  };
}

/** Le lien de démonstration tel que le formateur l'attend. */
export function demoLinkOf(config: MailConfig): DemoLink {
  return { label: config.demoLabel, url: config.demoUrl };
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

/**
 * Normalise les fins de ligne en CRLF.
 *
 * **Trouvé à la vérification, pas à la lecture.** `MailComposer.build()` rend
 * un corps quoted-printable dont les fins de ligne sont des LF nus ; le
 * transport SMTP de nodemailer les convertit en CRLF au moment d'écrire sur le
 * fil. Les octets « construits » et les octets « envoyés » différaient donc de
 * sept caractères sur un message de sept lignes — et c'est la version construite
 * qu'on déposait dans « Envoyés ».
 *
 * Deux conséquences, dont une seule est visible : la copie n'était pas
 * l'original, et surtout la RFC 3501 exige le CRLF dans un `APPEND`. Un serveur
 * tolérant l'accepte, un serveur strict le refuse, et un client de messagerie
 * peut afficher le message d'un bloc.
 *
 * On normalise donc **une fois**, et les deux chemins partent des mêmes octets.
 */
export function toCrlf(raw: Buffer): Buffer {
  // `latin1` : un aller-retour octet pour octet, sans réinterpréter l'UTF-8
  // déjà encodé par le compositeur.
  const text = raw.toString("latin1").replace(/\r?\n/g, "\r\n");
  return Buffer.from(text, "latin1");
}

/**
 * Compose le message MIME, **une seule fois**, en octets définitifs.
 *
 * Exporté parce que deux appelants en ont besoin : l'envoi, et le bouton
 * « Tester la copie » qui dépose sans passer par SMTP. Deux compositions
 * finiraient par diverger sur un en-tête.
 */
export async function buildMime(message: Mail.Options): Promise<Buffer> {
  const built = await new Promise<Buffer>((resolve, reject) => {
    new MailComposer(message).compile().build((error, output) => {
      if (error !== null && error !== undefined) reject(error);
      else resolve(output);
    });
  });
  return toCrlf(built);
}

export interface SendInput {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  /**
   * Adresse du pixel d'ouverture. Vide ou absente = **aucun pixel posé**.
   *
   * Décidé par l'appelant, envoi par envoi : le suivi se coupe pour un message
   * précis comme il se coupe globalement, et dans les deux cas rien n'est
   * inséré — pas d'image chargée puis ignorée, ce qui coûterait la
   * délivrabilité sans rien rapporter.
   */
  readonly trackingUrl?: string;
}

export type SendResult =
  | {
      readonly ok: true;
      readonly messageId: string;
      readonly accepted: readonly string[];
      /**
       * Le message **tel qu'il est parti**, octet pour octet.
       *
       * C'est ce qui est déposé dans « Envoyés » : recomposer un message
       * équivalent produirait un autre `Message-ID`, donc un fil cassé chez
       * l'expéditeur — et le défaut ne se verrait qu'à la première réponse.
       */
      readonly raw: Buffer;
    }
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
  const sentAt = new Date();
  const demo = demoLinkOf(config);
  const html = toHtml(input.body, demo);

  const message = {
    from: formatSender(config.fromName, config.from),
    to: input.to,
    // Les réponses reviennent dans la messagerie de l'utilisateur, pas dans le
    // CRM — la réception est hors périmètre, et l'écran le dit.
    replyTo: config.from,
    subject,
    messageId: id,
    date: sentAt,
    // Le lien passe ici, pas dans le brouillon : le corps stocké reste du
    // texte lisible, et c'est au moment de l'envoi que « Réserver un appel »
    // devient une ancre en HTML et une adresse visible en texte.
    text: toPlainText(input.body, demo),
    html: withTrackingPixel(html, input.trackingUrl ?? ""),
    // `format=fixed` : sans cela, un client peut recoller deux lignes
    // consécutives et détruire une adresse ou une liste tapée à la main.
    textEncoding: "quoted-printable" as const,
  };

  try {
    // **Le MIME est composé une seule fois, puis envoyé tel quel.** Nodemailer
    // sait composer et envoyer en un geste, mais on ne récupère alors que ce
    // qu'il veut bien rendre. Ici on tient les octets exacts : ce sont eux
    // qu'IMAP dépose dans « Envoyés », et l'identité des deux copies est ce qui
    // fait qu'une réponse se rattache au bon fil.
    const raw = await buildMime(message);

    const info = await transport.sendMail({
      envelope: { from: config.from, to: [input.to] },
      raw,
    });

    return {
      ok: true,
      messageId: info.messageId ?? id,
      accepted: info.accepted.map((entry) => (typeof entry === "string" ? entry : entry.address)),
      raw,
    };
  } catch (error) {
    // Jamais la configuration ni le secret dans le journal : seulement la cause.
    console.error("[mail] envoi refusé :", describeSmtpError(error));
    return { ok: false, message: describeSmtpError(error) };
  } finally {
    transport.close();
  }
}
