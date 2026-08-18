import { badRequest, jsonOk, serverError } from "@/lib/api/errors";
import { buildMime, messageId, readMailConfig, readMailStatus, PASSWORD_ENV } from "@/lib/api/mail";
import { copyToSent, readImapStatus } from "@/lib/api/imap";
import { formatSender } from "@/lib/domain/email-format";

export const dynamic = "force-dynamic";

/**
 * « Tester la copie » — dépose un message d'essai dans « Envoyés ».
 *
 * Même motif que « Tester l'envoi » du jalon 32 : **la réponse du serveur est
 * citée telle quelle**. C'est elle qui distingue « mot de passe refusé » de
 * « hôte inconnu » de « aucun dossier ne porte le drapeau \Sent », et ce sont
 * trois gestes différents.
 *
 * Le message d'essai ne passe **pas** par SMTP : il n'est envoyé à personne, il
 * est seulement déposé. C'est ce qui permet de tester la copie sans expédier un
 * courriel de plus à sa propre adresse à chaque essai.
 *
 * `POST` et non `GET` : la route écrit dans une boîte réelle, et une route qui
 * produit un effet ne doit pas répondre à un préchargement de navigateur.
 */
export async function POST() {
  try {
    const mail = await readMailStatus();
    const imap = await readImapStatus(mail, mail.passwordSet);

    if (!imap.ready) {
      return badRequest(`Copie IMAP non configurée : il manque ${imap.missing.join(", ")}.`);
    }

    const config = await readMailConfig();
    const now = new Date();

    const raw = await buildMime({
      from: formatSender(config.fromName, config.from),
      to: config.from,
      subject: "Essai de copie dans « Envoyés » — AuraFLOW",
      messageId: messageId(config.from, now, Math.random().toString(36).slice(2, 10)),
      date: now,
      text:
        "Ce message a été déposé directement dans votre dossier « Envoyés » par le CRM, sans passer par SMTP.\n\nS'il est là, la copie des messages envoyés fonctionne.",
    });

    const result = await copyToSent(raw, config, process.env[PASSWORD_ENV] ?? "", now);
    if (!result.ok) return badRequest(result.message);

    return jsonOk({
      mailbox: result.mailbox,
      // Dire **comment** le dossier a été trouvé : par son drapeau, ou par le
      // nom de repli. Le second cas mérite d'être su, parce qu'il cassera le
      // jour où le compte changera de langue.
      bySpecialUse: result.bySpecialUse,
    });
  } catch (error) {
    return serverError("POST /api/mail/copy-test", error);
  }
}
