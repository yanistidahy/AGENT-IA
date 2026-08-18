import "server-only";
import { ImapFlow } from "imapflow";
import { prisma } from "../db";
import { PASSWORD_ENV, type MailConfig } from "./mail";

/**
 * La copie du message envoyé dans le dossier « Envoyés » de la boîte.
 *
 * **Pourquoi c'est nécessaire.** SMTP envoie ; il ne dépose rien dans la boîte
 * de l'expéditeur. Sans cette copie, un message parti du CRM n'existe nulle part
 * dans la messagerie : l'historique d'envoi vit dans le CRM seul, et une réponse
 * du prospect arrive dans un fil orphelin, sans le message auquel elle répond.
 *
 * **Le même mot de passe, le même identifiant.** IMAP réutilise `SMTP_PASSWORD`
 * et `smtpUser` : c'est la même boîte. Deux jeux d'identifiants seraient deux
 * occasions de se tromper, et un secret de plus à ne pas laisser fuir.
 *
 * **Une copie ratée ne rate jamais l'envoi.** Le courriel est parti ; le
 * rattraper est impossible. L'échec est journalisé, consigné sur l'envoi et
 * affiché — il n'est jamais remonté comme une erreur d'envoi, ce qui ferait
 * croire qu'on peut réessayer.
 */

export interface ImapConfig {
  readonly host: string;
  readonly port: number;
  readonly encryption: "tls" | "starttls";
  /** Repli quand le drapeau `\Sent` n'est trouvé sur aucun dossier. */
  readonly sentMailbox: string;
  readonly enabled: boolean;
}

export interface ImapStatus extends ImapConfig {
  /** Tout est renseigné et la copie peut être tentée. */
  readonly ready: boolean;
  readonly missing: readonly string[];
}

export async function readImapConfig(): Promise<ImapConfig> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: {
      imapHost: true,
      imapPort: true,
      imapEncryption: true,
      imapSentMailbox: true,
      imapCopyEnabled: true,
    },
  });

  return {
    host: row?.imapHost ?? "",
    port: row?.imapPort ?? 993,
    encryption: row?.imapEncryption === "starttls" ? "starttls" : "tls",
    sentMailbox: row?.imapSentMailbox ?? "",
    enabled: row?.imapCopyEnabled ?? true,
  };
}

export function imapMissingFields(config: ImapConfig, mail: MailConfig, hasPassword: boolean) {
  const missing: string[] = [];
  if (config.host.trim() === "") missing.push("l'hôte IMAP");
  if (mail.user.trim() === "") missing.push("l'identifiant (celui du SMTP)");
  if (!hasPassword) missing.push(`le mot de passe (variable ${PASSWORD_ENV})`);
  return missing;
}

export async function readImapStatus(mail: MailConfig, hasPassword: boolean): Promise<ImapStatus> {
  const config = await readImapConfig();
  const missing = imapMissingFields(config, mail, hasPassword);
  return { ...config, ready: missing.length === 0, missing };
}

/**
 * Traduit un échec IMAP en une phrase qui dit quoi faire.
 *
 * Même règle qu'au jalon 16 pour l'API Anthropic et qu'au jalon 32 pour SMTP :
 * **la réponse du serveur est citée**. C'est elle qui distingue « mot de passe
 * refusé » de « hôte inconnu » de « dossier inexistant », et la jeter coûte un
 * aller-retour de débogage entier.
 */
export function describeImapError(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "Échec de la copie IMAP, sans détail.";
  }

  const shaped = error as {
    code?: string;
    responseText?: string;
    serverResponseCode?: string;
    message?: string;
  };
  const parts: string[] = [];
  const code = shaped.code ?? "";
  const server = shaped.serverResponseCode ?? "";

  if (code === "AUTHENTICATIONFAILED" || server === "AUTHENTICATIONFAILED") {
    parts.push("Authentification IMAP refusée : identifiant ou mot de passe incorrect.");
  } else if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    parts.push("Hôte IMAP introuvable : vérifiez le nom du serveur.");
  } else if (code === "ECONNREFUSED" || code === "ECONNRESET") {
    parts.push("Connexion IMAP refusée : vérifiez le port et le mode de chiffrement.");
  } else if (code === "ETIMEDOUT" || code === "ETIMEOUT") {
    parts.push("Le serveur IMAP n'a pas répondu à temps.");
  } else if (server === "TRYCREATE" || code === "NONEXISTENT") {
    parts.push("Le dossier « Envoyés » n'existe pas sous ce nom sur le serveur.");
  } else {
    parts.push("Le serveur IMAP a refusé la copie.");
  }

  const detail = (shaped.responseText ?? shaped.message ?? "").trim();
  if (detail !== "") parts.push(`Réponse du serveur : ${detail.slice(0, 300)}`);
  if (code !== "") parts.push(`(code ${code})`);

  return parts.join(" ");
}

/**
 * Le dossier des envoyés, **trouvé par son drapeau, pas par son nom**.
 *
 * IMAP nomme ce dossier « Sent », « Envoyés », « Sent Items », « INBOX.Sent »
 * ou « [Gmail]/Messages envoyés » selon le serveur, la langue du compte et le
 * séparateur de hiérarchie. Deviner à partir d'une liste de noms marche jusqu'au
 * jour où le compte change de langue.
 *
 * La RFC 6154 (SPECIAL-USE) donne la réponse sans deviner : le serveur marque
 * lui-même le dossier `\Sent`. Le nom réglé n'est qu'un **repli**, et l'absence
 * des deux est dite plutôt que devinée — déposer un message important dans un
 * dossier choisi au hasard serait pire que ne pas le déposer.
 */
export function pickSentMailbox(
  boxes: ReadonlyArray<{ readonly path: string; readonly specialUse?: string }>,
  fallbackName: string,
): { readonly path: string; readonly bySpecialUse: boolean } | null {
  const flagged = boxes.find((box) => box.specialUse === "\\Sent");
  if (flagged !== undefined) return { path: flagged.path, bySpecialUse: true };

  const wanted = fallbackName.trim();
  if (wanted === "") return null;

  // Le repli est comparé sans casse : « sent » et « Sent » désignent le même
  // dossier, et se tromper de casse dans un réglage ne doit pas coûter la copie.
  const named = boxes.find((box) => box.path.toLowerCase() === wanted.toLowerCase());
  return named === undefined ? null : { path: named.path, bySpecialUse: false };
}

export type CopyResult =
  | { readonly ok: true; readonly mailbox: string; readonly bySpecialUse: boolean }
  | { readonly ok: false; readonly message: string };

/**
 * Dépose le message **tel qu'il est parti** dans le dossier des envoyés.
 *
 * `raw` est l'octet pour octet de ce que SMTP a transmis, `Message-ID` compris :
 * c'est ce qui fait qu'une réponse du destinataire se rattache au bon fil dans
 * le client de messagerie. Recomposer un message équivalent produirait un autre
 * `Message-ID`, donc un fil cassé — et le défaut ne se verrait qu'à la réponse.
 */
export async function copyToSent(
  raw: Buffer,
  mail: MailConfig,
  password: string,
  sentAt: Date,
): Promise<CopyResult> {
  const config = await readImapConfig();

  if (!config.enabled) return { ok: false, message: "Copie IMAP désactivée dans les réglages." };

  const missing = imapMissingFields(config, mail, password !== "");
  if (missing.length > 0) {
    return { ok: false, message: `Copie IMAP non configurée : il manque ${missing.join(", ")}.` };
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.encryption === "tls",
    auth: { user: mail.user, pass: password },
    // Le journal d'imapflow est bavard et porte les commandes IMAP, donc les
    // sujets des messages. Rien de tout cela n'a sa place dans les journaux du
    // service : ce qui doit s'y trouver, c'est l'erreur, et elle est traduite.
    logger: false,
  });

  try {
    await client.connect();

    const boxes = await client.list();
    const target = pickSentMailbox(boxes, config.sentMailbox);
    if (target === null) {
      const names = boxes.map((box) => box.path).slice(0, 12).join(", ");
      return {
        ok: false,
        message:
          `Aucun dossier ne porte le drapeau « \\Sent » et le nom de repli ` +
          `${config.sentMailbox.trim() === "" ? "n'est pas renseigné" : `« ${config.sentMailbox} » n'existe pas`}. ` +
          `Dossiers vus sur le serveur : ${names}.`,
      };
    }

    // `\Seen` : un message qu'on vient d'écrire soi-même n'est pas un message
    // non lu. Sans ce drapeau, la boîte affiche un compteur de non-lus qui
    // grandit à chaque envoi.
    await client.append(target.path, raw, ["\\Seen"], sentAt);

    return { ok: true, mailbox: target.path, bySpecialUse: target.bySpecialUse };
  } catch (error) {
    const message = describeImapError(error);
    console.error("[imap] copie refusée :", message);
    return { ok: false, message };
  } finally {
    // `logout()` peut lever si la connexion est déjà tombée ; l'échec de la
    // fermeture n'a rien à dire sur le sort de la copie.
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}
