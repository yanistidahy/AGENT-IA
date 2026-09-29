import "server-only";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { noteRateRefusal } from "./send-rate";
import type Mail from "nodemailer/lib/mailer";
import { prisma } from "../db";
import {
  defaultMailbox,
  getMailbox,
  listMailboxes,
  mailboxPassword,
  passwordEnvFor,
  type Mailbox,
} from "./mailboxes";
import {
  formatSender,
  hasBody,
  sanitizeSubject,
  toHtml,
  toPlainText,
  withSignatureLogo,
  withOurSiteLink,
  withTrackingPixel,
  videoHtml,
  type DemoLink,
  type SignatureLogo,
} from "../domain/email-format";
import { logoUrl } from "../domain/signature-logo";
import {
  isUsableVideo,
  posterUrl,
  videoDestination,
  type VideoLink,
} from "../domain/signature-video";
import { readLogoSummary } from "./mail-logo";
import { readVideoSummary } from "./mail-video";
import { clickUrl, publicBaseUrl, type ClickKind } from "./email-sends";
import { DEFAULT_DEMO, DEFAULT_SIGNATURE, type Signature } from "../agents/prompts/company";
import { DEFAULT_OUR_SITE_URL, ourSiteLink, type OurSiteLink } from "../domain/our-site";
import {
  DEFAULT_VIDEO_DISPLAY,
  toVideoDisplay,
  type VideoDisplay,
} from "../domain/video-display";

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
  /** La boîte dont vient cette configuration. Vide = aucune boîte en base. */
  readonly mailboxId: string;
  readonly slug: string;
  readonly label: string;
  readonly host: string;
  readonly port: number;
  readonly encryption: "tls" | "starttls";
  readonly user: string;
  readonly from: string;
  readonly fromName: string;
  /** Signature des brouillons : réglable pour que l'associé signe son nom. */
  readonly signName: string;
  readonly signTitle: string;
  /**
   * Le téléphone de la signature. Vide = une ligne de moins, pas une ligne
   * blanche. L'adresse, elle, n'a pas de champ : c'est `from`, celle d'où le
   * message part réellement (voir `Signature` dans prompts/company.ts).
   */
  readonly signPhone: string;
  /** Lien de démonstration. `demoUrl` vide supprime la phrase entière. */
  readonly demoLabel: string;
  readonly demoUrl: string;
  /**
   * L'adresse de **notre** site, celle que `{notresite}` rend cliquable.
   *
   * Pas de libellé à côté : il est dérivé de l'adresse par `ourSiteLabel`. Vide
   * supprime la phrase entière, comme `demoUrl`.
   */
  readonly ourSiteUrl: string;
  /**
   * Comment la vidéo se montre : un lien texte, ou une vignette.
   *
   * Un réglage global, comme le logo et la vidéo elle-même : c'est la forme du
   * message, pas la propriété d'une boîte. `videoHtml` est le seul lecteur.
   */
  readonly videoDisplay: VideoDisplay;
}

/** Ce que l'écran a le droit de savoir du mot de passe : s'il existe. */
export interface MailStatus extends MailConfig {
  readonly passwordSet: boolean;
  /** Tout est renseigné et l'envoi peut être tenté. */
  readonly ready: boolean;
  /** Ce qui manque, nommé, pour que le panneau soit actionnable. */
  readonly missing: readonly string[];
}

/**
 * Conservée pour les messages d'aide : c'est la variable historique, devenue le
 * **repli** de la boîte « principale ». Chaque boîte a la sienne — voir
 * `passwordEnvFor` dans lib/api/mailboxes.ts.
 */
export const PASSWORD_ENV = "SMTP_PASSWORD";

function password(config: Pick<MailConfig, "slug">): string {
  return mailboxPassword(config);
}

function toEncryption(value: string): "tls" | "starttls" {
  return value === "tls" ? "tls" : "starttls";
}

/**
 * Les réglages globaux du corps du message : le lien de démonstration et notre
 * site. **Globaux, pas des propriétés de boîte** — ce sont ceux de
 * l'entreprise, et deux boîtes qui pointeraient deux sites se liraient comme
 * deux sociétés (l'argument du logo au jalon 62).
 */
async function readGlobalLinks(): Promise<{
  demo: { label: string; url: string };
  ourSiteUrl: string;
  videoDisplay: VideoDisplay;
}> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: {
      demoLabel: true,
      demoUrl: true,
      ourSiteUrl: true,
      videoDisplay: true,
    },
  });
  return {
    demo: {
      label: row?.demoLabel ?? DEFAULT_DEMO.label,
      url: row?.demoUrl ?? DEFAULT_DEMO.url,
    },
    ourSiteUrl: row?.ourSiteUrl ?? DEFAULT_OUR_SITE_URL,
    videoDisplay:
      row === null ? DEFAULT_VIDEO_DISPLAY : toVideoDisplay(row.videoDisplay),
  };
}

/** La configuration d'envoi d'une boîte, prête pour le transport. */
export function configOf(
  mailbox: Mailbox,
  demo: { readonly label: string; readonly url: string },
  ourSiteUrl: string = DEFAULT_OUR_SITE_URL,
  videoDisplay: VideoDisplay = DEFAULT_VIDEO_DISPLAY,
): MailConfig {
  return {
    mailboxId: mailbox.id,
    slug: mailbox.slug,
    label: mailbox.label,
    host: mailbox.smtpHost,
    port: mailbox.smtpPort,
    encryption: toEncryption(mailbox.smtpEncryption),
    user: mailbox.smtpUser,
    from: mailbox.smtpFrom,
    fromName: mailbox.smtpFromName,
    signName: mailbox.signName === "" ? DEFAULT_SIGNATURE.name : mailbox.signName,
    signTitle: mailbox.signTitle === "" ? DEFAULT_SIGNATURE.title : mailbox.signTitle,
    signPhone: mailbox.signPhone,
    demoLabel: demo.label,
    demoUrl: demo.url,
    ourSiteUrl,
    videoDisplay,
  };
}

/**
 * La configuration d'une boîte — celle demandée, sinon la boîte par défaut.
 *
 * Les lectures qui ne dépendent d'aucune boîte précise (le lien de démo, le
 * repli sans aucune boîte en base) rendent une configuration vide : elle échoue
 * en nommant ce qui manque, jamais en levant.
 */
export async function readMailConfig(mailboxId?: string): Promise<MailConfig> {
  const { demo, ourSiteUrl, videoDisplay } = await readGlobalLinks();
  const mailbox =
    mailboxId === undefined || mailboxId === ""
      ? await defaultMailbox()
      : await getMailbox(mailboxId);

  if (mailbox === null) {
    return {
      mailboxId: "",
      slug: "",
      label: "",
      host: "",
      port: 587,
      encryption: "starttls",
      user: "",
      from: "",
      fromName: "",
      signName: DEFAULT_SIGNATURE.name,
      signTitle: DEFAULT_SIGNATURE.title,
      signPhone: "",
      demoLabel: demo.label,
      demoUrl: demo.url,
      ourSiteUrl,
      videoDisplay,
    };
  }

  return configOf(mailbox, demo, ourSiteUrl, videoDisplay);
}

/**
 * Le logo à poser sur la partie HTML, ou `undefined`.
 *
 * Deux façons de n'en poser aucun, et les deux sont volontaires : aucun logo
 * téléversé, ou **aucune adresse publique connue**. Dans ce second cas, une
 * URL devinée produirait une image cassée dans chaque message — c'est la règle
 * du pixel de suivi du jalon 37, appliquée telle quelle.
 */
export async function signatureLogo(): Promise<SignatureLogo | undefined> {
  const summary = await readLogoSummary();
  if (summary === null) return undefined;

  const url = logoUrl(publicBaseUrl(), summary.version);
  if (url === "") return undefined;

  return { url, width: summary.width };
}

/**
 * La vidéo à poser sur la partie HTML, ou `undefined`.
 *
 * Trois façons de n'en poser aucune, et les trois sont volontaires : aucune
 * vidéo réglée, **aucune adresse publique connue** (une URL devinée produirait
 * une image cassée dans chaque message — règle du pixel du jalon 37 et du logo
 * du jalon 62), ou une destination qu'on ne sait pas composer.
 *
 * Les trois morceaux sont **solidaires** : `isUsableVideo` refuse un lien dont
 * la vignette ou la destination manque. Sans vignette on n'aurait qu'un lien nu,
 * sans destination qu'une image inerte — et dans les deux cas la phrase qui
 * portait `{video}` a déjà disparu du gabarit, puisque `mergeValuesOf` n'a alors
 * rien à substituer. Les deux décisions viennent de la même lecture, donc elles
 * ne peuvent pas se contredire.
 */
export async function signatureVideo(): Promise<VideoLink | undefined> {
  const summary = await readVideoSummary();
  if (summary === null) return undefined;

  const base = publicBaseUrl();
  const link: VideoLink = {
    label: summary.label,
    url: videoDestination(
      { kind: summary.kind, url: summary.url, version: summary.version },
      base,
    ),
    posterUrl: posterUrl(base, summary.version),
    posterWidth: summary.posterWidth,
  };

  return isUsableVideo(link) ? link : undefined;
}

/** Le lien de démonstration tel que le formateur l'attend. */
export function demoLinkOf(config: MailConfig): DemoLink {
  return { label: config.demoLabel, url: config.demoUrl };
}

/**
 * Notre site tel que le formateur l'attend, ou `undefined`.
 *
 * **Une seule lecture décide de l'adresse et du libellé**, appelée par l'envoi
 * comme par l'aperçu : deux résolutions finiraient par afficher un texte qui ne
 * décrit pas le `href`, ce qu'un lecteur attentif lit comme une usurpation.
 */
export function ourSiteLinkOf(config: MailConfig): OurSiteLink | undefined {
  return ourSiteLink(config.ourSiteUrl) ?? undefined;
}

/**
 * L'adresse de notre site, telle que la balise la substitue, ou `""`.
 *
 * C'est la valeur que `mergeValuesOf` met dans `notresite` : l'adresse entière,
 * pas le libellé — voir `lib/domain/our-site.ts`. Vide quand rien n'est réglé,
 * donc la phrase qui la cite disparaît.
 */
export async function ourSiteUrlValue(): Promise<string> {
  return ourSiteLinkOf(await readMailConfig())?.url ?? "";
}

/**
 * Où mène un clic, une fois le passage enregistré.
 *
 * **Une seule lecture décide de la destination**, appelée par la redirection
 * comme par la composition du message : deux résolutions finiraient par ne plus
 * pointer au même endroit, et le prospect atterrirait ailleurs que là où la
 * vignette le promettait.
 */
export async function clickDestination(kind: ClickKind): Promise<string> {
  if (kind === "video") return (await signatureVideo())?.url ?? "";
  return (await readMailConfig()).demoUrl;
}

/**
 * La signature d'une boîte, ses quatre champs réunis.
 *
 * **L'adresse vient de `from`**, jamais d'une saisie séparée : c'est celle de
 * l'en-tête `From` du message, et une signature qui en afficherait une autre se
 * lirait comme une usurpation. Une seule fonction la compose, pour que le
 * prompt d'Alex, la garde de signature et le rendu HTML ne puissent pas
 * décrire trois signataires différents.
 */
export function signatureOf(config: MailConfig): Signature {
  return {
    name: config.signName,
    title: config.signTitle,
    phone: config.signPhone,
    email: config.from,
  };
}

/** Ce qui empêche d'envoyer, nommé champ par champ. */
export function missingFields(config: MailConfig, hasPassword: boolean): string[] {
  const missing: string[] = [];
  if (config.host.trim() === "") missing.push("l'hôte SMTP");
  if (config.user.trim() === "") missing.push("l'identifiant");
  if (config.from.trim() === "") missing.push("l'adresse d'expédition");
  if (!hasPassword) {
    // La variable de **cette** boîte, pas la variable historique : trois boîtes,
    // trois secrets, et un message qui nomme le mauvais coûte un aller-retour.
    // **Nommer la variable ne suffit pas : il faut dire où la poser.** Le refus
    // se lit dans la file des départs, à des écrans de l'endroit où l'on agit.
    missing.push(
      `le mot de passe — ajoutez la variable ${passwordEnvFor(config.slug)} dans les variables du service (Railway), puis redéployez`,
    );
  }
  return missing;
}

export async function readMailStatus(mailboxId?: string): Promise<MailStatus> {
  const config = await readMailConfig(mailboxId);
  const passwordSet = password(config) !== "";
  const missing = missingFields(config, passwordSet);

  return { ...config, passwordSet, ready: missing.length === 0, missing };
}

/** L'état de **chaque** boîte, pour le panneau — jamais un secret, son existence. */
export async function readMailboxStatuses(): Promise<MailStatus[]> {
  const { demo, ourSiteUrl, videoDisplay } = await readGlobalLinks();
  const mailboxes = await listMailboxes();
  return mailboxes.map((mailbox) => {
    const config = configOf(mailbox, demo, ourSiteUrl, videoDisplay);
    const passwordSet = password(config) !== "";
    const missing = missingFields(config, passwordSet);
    return { ...config, passwordSet, ready: missing.length === 0, missing };
  });
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
  /** La boîte qui envoie. Absente = la boîte par défaut. */
  readonly mailboxId?: string;
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
  /**
   * Jeton de suivi, quand il y en a un. Absent = **liens nus**.
   *
   * C'est le même jeton que celui du pixel : un clic et une ouverture
   * appartiennent au même envoi, et en émettre deux ne servirait qu'à croire
   * qu'on mesure deux choses indépendantes.
   */
  readonly trackToken?: string;
}

export type SendResult =
  | {
      readonly ok: true;
      readonly messageId: string;
      readonly accepted: readonly string[];
      /** Le message **tel qu'il est parti**, octet pour octet. */
      readonly raw: Buffer;
      /**
       * La même chose, **sans le pixel de suivi**, pour le dossier « Envoyés ».
       *
       * Défaut trouvé au jalon 43 : la copie archivée portait le pixel, si bien
       * qu'ouvrir son propre dossier « Envoyés » comptait comme une ouverture du
       * prospect. C'est la première cause d'un taux d'ouverture à 87 %.
       *
       * **Le compromis, dit clairement.** Le jalon 37 déposait les octets exacts
       * de l'envoi, et cette identité-là est perdue. Ce qui rattache la réponse
       * au fil est conservé : `Message-ID`, `Date`, `From`, `To`, `Subject` et
       * le corps sont identiques — seule l'image invisible en fin de HTML
       * disparaît. Le message archivé est donc celui que le destinataire lit,
       * amputé de ce qui ne le regardait pas.
       *
       * Sans suivi, les deux tampons sont identiques et le sont restés.
       */
      readonly rawForArchive: Buffer;
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
  const config = await readMailConfig(input.mailboxId);
  if (config.mailboxId === "") {
    return { ok: false, message: "Aucune boîte d'envoi n'est configurée. Réglages → Messagerie." };
  }
  const secret = password(config);
  const missing = missingFields(config, secret !== "");

  if (missing.length > 0) {
    // La boîte est nommée : « incomplète » sans dire laquelle, à trois boîtes,
    // ferait vérifier les deux mauvaises d'abord.
    return {
      ok: false,
      message: `Boîte « ${config.label} » incomplète : il manque ${missing.join(", ")}.`,
    };
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
  /*
    **Les deux adresses passent par notre redirection, ou pas du tout.**

    Un seul point de substitution, ici : `demo` et `video` sont résolus une fois
    et traversent ensuite le formateur texte comme le formateur HTML. Réécrire
    l'adresse plus loin, dans l'un des deux rendus, ferait que le lien de la
    version texte et celui de la version HTML ne mènent pas au même endroit —
    donc qu'un clic soit compté ou non selon le client de messagerie.

    Sans jeton — suivi coupé pour ce message ou globalement, ou aucune adresse
    publique connue — **le lien reste celui de l'hébergeur** : rien n'est
    mesurable, et c'est un interrupteur, pas un masquage d'affichage (jalon 37).
  */
  const base = publicBaseUrl();
  const token = input.trackToken ?? "";
  const measurable = token !== "" && base !== "";
  const through = (kind: ClickKind, url: string): string =>
    measurable && url !== "" ? clickUrl(base, token, kind) : url;

  const plainDemo = demoLinkOf(config);
  const demo: DemoLink = { ...plainDemo, url: through("demo", plainDemo.url) };
  const plainVideo = await signatureVideo();
  const video =
    plainVideo === undefined
      ? undefined
      : { ...plainVideo, url: through("video", plainVideo.url) };
  // **Logo, puis vignette, puis pixel — et l'ordre est une contrainte.** Le
  // pixel doit rester la toute dernière chose du corps (jalon 43 : un client qui
  // tronque coupe par la fin). Le logo prend le dernier paragraphe pour en faire
  // la cellule droite d'un tableau (jalon 65), il doit donc voir un corps encore
  // intact. La vignette, elle, remplace un libellé au milieu du texte : posée
  // avant le logo, son balisage pourrait se retrouver dans la cellule de
  // signature si le libellé était écrit dans le dernier paragraphe.
  // L'ancre de notre site vient après le logo, pour la même raison que la
  // vignette : le logo doit voir un corps encore intact. Le texte, lui, n'a rien
  // à développer, la balise ayant déjà substitué l'adresse entière (jalon 98).
  const html = withOurSiteLink(
    videoHtml(
      withSignatureLogo(toHtml(input.body, demo), await signatureLogo()),
      video,
      config.videoDisplay,
    ),
    ourSiteLinkOf(config),
  );

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
    text: toPlainText(input.body, demo, video),
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

    // La copie d'archive est composée à partir du **même objet**, pixel retiré :
    // mêmes en-têtes, même `Message-ID`, même date, même corps. Recomposer un
    // message « équivalent » à la main produirait un autre identifiant, donc un
    // fil cassé — c'est ce que le jalon 37 avait appris.
    const tracked = message.html !== html;
    const rawForArchive = tracked ? await buildMime({ ...message, html }) : raw;

    const info = await transport.sendMail({
      envelope: { from: config.from, to: [input.to] },
      raw,
    });

    return {
      ok: true,
      // **`id`, jamais `info.messageId`.** Défaut trouvé au jalon 44, et il a
      // coûté la détection des réponses pendant trois jalons.
      //
      // En envoi `raw`, nodemailer ne relit pas les en-têtes du tampon : son
      // `MimeNode` n'a pas de `Message-ID`, donc `messageId()`
      // (`mime-node/index.js:952`) en **fabrique un** — une forme UUID
      // `<8-4-4-4-12@domaine>` — et le rend dans `info.messageId`. Cet
      // identifiant n'apparaît dans aucun message : il n'a pas été écrit dans
      // le MIME, qui était déjà composé. On stockait donc un identifiant
      // fantôme pendant que le vrai partait sur le fil, et le rapprochement
      // des réponses comparait des identifiants qui n'avaient jamais existé.
      messageId: id,
      accepted: info.accepted.map((entry) => (typeof entry === "string" ? entry : entry.address)),
      raw,
      rawForArchive,
    };
  } catch (error) {
    // Jamais la configuration ni le secret dans le journal : seulement la cause.
    console.error("[mail] envoi refusé :", describeSmtpError(error));

    // **Un refus de débit s'apprend, il ne se subit pas.** Traité ici plutôt
    // que chez l'appelant : tous les chemins d'envoi passent par cette fonction,
    // et le plafond doit descendre quel que soit celui qui a rencontré la
    // limite — un envoi de séquence comme un message écrit à la main.
    await noteRateRefusal(error);

    return { ok: false, message: describeSmtpError(error) };
  } finally {
    transport.close();
  }
}
