import "server-only";
import { ImapFlow } from "imapflow";
import { prisma } from "../db";
import { anyOursMissing } from "../domain/message-id";
import { PASSWORD_ENV, readMailConfig } from "./mail";
import { describeImapError, imapMissingFields, readImapConfig } from "./imap";
import { classify, type InboxHeaders } from "../domain/inbox-replies";
import { BLOCK_LABELS } from "../domain/sequence-rules";
import { ANSWERED_OUTCOMES } from "../domain/status";
import { REAL_ACTIVITY } from "./real-activity";
import { logActivity } from "./activities";
import { ownerOrDefault } from "./automation";

/**
 * Le relevé de la boîte de réception — la détection automatique des réponses.
 *
 * C'est l'option B de la note de conception du jalon 38, dont la moitié était
 * déjà payée : la connexion IMAP, le `Message-ID` conservé sur chaque envoi et
 * la copie dans « Envoyés » existaient depuis le jalon 37.
 *
 * Quatre règles portent tout ce fichier :
 *
 * 1. **En-têtes seulement, jamais un corps.** La requête IMAP demande
 *    explicitement sept en-têtes ; le corps n'est ni lu, ni transmis, ni
 *    stocké. La boîte n'est pas recopiée dans le CRM, et rien ici ne pourrait
 *    le faire même par accident.
 * 2. **Correspondance exacte, ou rien.** `In-Reply-To` et `References` contre
 *    nos propres `Message-ID`. Aucune heuristique sur l'expéditeur ni le
 *    sujet : une fausse correspondance consignerait une réponse sur la mauvaise
 *    fiche et arrêterait la mauvaise séquence.
 * 3. **Lecture seule.** `INBOX` est ouverte en `readOnly` et les en-têtes sont
 *    lus avec `BODY.PEEK` : un relevé ne doit pas marquer comme lus des
 *    messages que personne n'a ouverts.
 * 4. **Idempotent par contrainte, pas par vérification.** `EmailReply.
 *    replyMessageId` est unique en base : un second relevé ne peut pas créer
 *    une seconde interaction, même en cas de course.
 */

/** Marge de recouvrement du `SINCE` : `SEARCH` IMAP ne connaît que le jour. */
const OVERLAP_DAYS = 2;

/** Au-delà, un envoi est trop vieux pour qu'on attende encore une réponse. */
const SENT_WINDOW_DAYS = 180;

/** Bornes d'un relevé : au-delà, on s'arrête et on reprendra au suivant. */
const MAX_MESSAGES = 400;

/**
 * Ce qu'un message examiné a donné, et pourquoi.
 *
 * **Des en-têtes de fil, jamais du contenu** : pas de sujet reçu, pas
 * d'expéditeur, pas un mot du corps. Ce détail n'est pas enregistré en base —
 * il vit le temps d'une réponse HTTP, pour qu'on puisse répondre à « lesquels,
 * et pourquoi » sans transformer le CRM en journal de boîte.
 */
export interface ExaminedMessage {
  readonly messageId: string;
  readonly inReplyTo: string;
  readonly references: string;
  readonly verdict: "reply" | "auto" | "bounce" | "unrelated";
  /** Pour un automate : l'en-tête qui a tranché, et sa valeur. */
  readonly autoHeader: string;
  /** Pour une réponse : l'identifiant de **notre** envoi retrouvé. */
  readonly matchedId: string;
  /** Pour un message sans rapport : les identifiants essayés, dans l'ordre. */
  readonly tried: readonly string[];
  /**
   * Un des identifiants cités est-il **des nôtres, sans être en base** ?
   *
   * Ce n'est pas la même panne qu'un fil inconnu, et le jalon 43 les rendait
   * identiques — ce qui a caché la cause du jalon 44 pendant trois relevés. Ici
   * le fil est correct et c'est `email_sends` qui ment : l'identifiant a été
   * écrasé, jamais enregistré, ou perdu.
   */
  readonly oursMissing: boolean;
}

export interface PollReport {
  readonly skipped: string | null;
  readonly examined: number;
  readonly replies: number;
  /** Réponses déjà consignées à la main : reconnues, pas re-consignées. */
  readonly alreadyLogged: number;
  readonly sequencesStopped: number;
  readonly ignoredAuto: number;
  readonly ignoredBounce: number;
  readonly unrelated: number;
  readonly error: string | null;
  /**
   * Le détail message par message.
   *
   * « 9 examinés, 0 rapproché » ne se diagnostique pas : il faut savoir
   * lesquels et pourquoi. Ce champ existe pour cela, et pour rien d'autre.
   */
  readonly messages: readonly ExaminedMessage[];
  /**
   * Combien d'identifiants d'envoi le rapprochement avait à sa disposition.
   *
   * Zéro ici expliquerait tout d'un coup — et sans ce compteur, la cause
   * serait indiscernable d'un problème de boîte ou de fenêtre.
   */
  readonly knownSent: number;
  /** La borne basse du `SEARCH SINCE`, pour vérifier qu'elle couvre la réponse. */
  readonly searchSince: Date | null;
  /** La boîte réellement ouverte — l'identifiant IMAP, pas l'adresse d'envoi. */
  readonly mailbox: string;
  /** Le domaine d'expédition, qui sert à reconnaître un de nos identifiants. */
  readonly sendingDomain: string;
  /**
   * Réponses rapprochées **mais non consignées**, faute de fiche rattachée.
   *
   * C'est le compteur qui manquait au jalon 44 : le relevé annonçait une
   * réponse, `/emails` en affichait zéro, et rien ne reliait les deux. Une
   * détection qui n'aboutit pas doit se compter à part d'une détection qui
   * aboutit — sinon le rapport dit « 1 réponse » là où personne n'a rien reçu.
   */
  readonly unlinked: number;
  /** Les destinataires concernés, pour pouvoir agir plutôt que chercher. */
  readonly unlinkedAddresses: readonly string[];
  /** Réponses restées sans interaction et enfin consignées par ce relevé. */
  readonly repaired: number;
}

const EMPTY: PollReport = {
  messages: [],
  knownSent: 0,
  searchSince: null,
  mailbox: "",
  sendingDomain: "",
  unlinked: 0,
  unlinkedAddresses: [],
  repaired: 0,
  skipped: null,
  examined: 0,
  replies: 0,
  alreadyLogged: 0,
  sequencesStopped: 0,
  ignoredAuto: 0,
  ignoredBounce: 0,
  unrelated: 0,
  error: null,
};

/* --------------------------------------------------------- en-têtes */

/** Les sept en-têtes demandés au serveur, et les seuls. */
export const WANTED_HEADERS = [
  "message-id",
  "in-reply-to",
  "references",
  "auto-submitted",
  "x-autoreply",
  "from",
  "date",
] as const;

/**
 * Découpe un bloc d'en-têtes RFC 822, **replis compris**.
 *
 * `References` dépasse presque toujours 78 colonnes et arrive donc plié sur
 * plusieurs lignes, les suivantes commençant par une espace. Les recoller est
 * la seule façon de lire un fil entier — sans quoi seul le premier identifiant
 * serait vu, et une réponse à un troisième message passerait pour étrangère.
 */
export function readHeaders(raw: string): Map<string, string> {
  const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");
  const found = new Map<string, string>();

  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    // Le premier gagne : un en-tête dupliqué est au mieux une anomalie, et
    // concaténer deux `Message-ID` en fabriquerait un troisième.
    if (!found.has(name)) found.set(name, value);
  }

  return found;
}

/** La date d'un en-tête `Date`, ou `null` si elle est absente ou illisible. */
export function headerDate(value: string | undefined): Date | null {
  if (value === undefined) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseHeaderBlock(raw: string): InboxHeaders {
  const found = readHeaders(raw);
  const date = found.get("date");

  return {
    messageId: found.get("message-id") ?? "",
    inReplyTo: found.get("in-reply-to") ?? "",
    references: found.get("references") ?? "",
    autoSubmitted: found.get("auto-submitted") ?? "",
    xAutoreply: found.get("x-autoreply") ?? "",
    from: found.get("from") ?? "",
    date: headerDate(date),
  };
}

/* ----------------------------------------------------------- relevé */

interface SentRow {
  readonly id: string;
  readonly messageId: string;
  readonly contactId: string | null;
  readonly sentAt: Date;
  readonly subject: string;
  /** Le destinataire : c'est lui qu'on nomme quand la fiche manque. */
  readonly toAddress: string;
}

export async function pollInbox(now = new Date()): Promise<PollReport> {
  // Le secret est lu ici et nulle part ailleurs de ce fichier : il ne voyage
  // pas dans un état, il n'entre dans aucun journal, il n'est jamais rendu.
  const password = process.env[PASSWORD_ENV] ?? "";

  const [config, mail, settings] = await Promise.all([
    readImapConfig(),
    readMailConfig(),
    prisma.settings.findUnique({
      where: { id: "singleton" },
      select: { inboxPollEnabled: true, lastInboxPollAt: true },
    }),
  ]);

  if (settings?.inboxPollEnabled === false) {
    return { ...EMPTY, skipped: "Relevé de la boîte désactivé dans les réglages." };
  }

  const missing = imapMissingFields(config, mail, password !== "");
  if (missing.length > 0) {
    return { ...EMPTY, skipped: `Relevé non configuré : il manque ${missing.join(", ")}.` };
  }

  // Les envois susceptibles de recevoir une réponse, indexés par `Message-ID`.
  // Sans envoi connu, il n'y a rien à rapprocher — et se connecter pour rien
  // consomme une session IMAP que le serveur compte.
  const since = new Date(now);
  since.setDate(since.getDate() - SENT_WINDOW_DAYS);
  const sends = await prisma.emailSend.findMany({
    where: { sentAt: { gte: since }, messageId: { not: "" } },
    select: {
      id: true,
      messageId: true,
      contactId: true,
      sentAt: true,
      subject: true,
      toAddress: true,
    },
  });
  if (sends.length === 0) {
    return {
      ...EMPTY,
      mailbox: mail.user,
      skipped: "Aucun envoi récent : rien à rapprocher.",
    };
  }

  const byMessageId = new Map<string, SentRow>();
  for (const send of sends) byMessageId.set(send.messageId, send);

  // La boîte réellement ouverte est celle de l'identifiant IMAP, qui est celui
  // du SMTP. Si l'adresse d'expédition est un alias posé sur une **autre**
  // boîte, c'est l'autre qui est relevée — et le rapport doit le dire, parce
  // que rien d'autre à l'écran ne le trahirait.
  const mailbox = mail.user;
  // Le domaine de l'**adresse d'expédition** : c'est lui que porte le
  // `Message-ID` que nous fabriquons, donc lui qui permet de reconnaître un de
  // nos identifiants cité par un correspondant.
  const sendingDomain = (mail.from.split("@")[1] ?? "").trim().toLowerCase();

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.encryption === "tls",
    auth: { user: mail.user, pass: password },
    // Le journal d'imapflow porte les commandes IMAP, donc les sujets. Rien de
    // tout cela n'a sa place dans les journaux du service.
    logger: false,
  });

  const examinedDetail: ExaminedMessage[] = [];
  let report: PollReport = { ...EMPTY, knownSent: byMessageId.size, mailbox, sendingDomain };

  try {
    await client.connect();

    // **Lecture seule** : un relevé ne marque pas comme lus les messages de
    // quelqu'un d'autre, et ne touche à aucun drapeau.
    await client.mailboxOpen("INBOX", { readOnly: true });

    // `SEARCH SINCE` ne connaît que le jour : on reprend deux jours avant le
    // dernier relevé réussi. Le recouvrement est sans conséquence — la
    // contrainte d'unicité écarte ce qui a déjà été vu — et il rattrape un
    // message arrivé pendant l'exécution du relevé précédent.
    const from = new Date(settings?.lastInboxPollAt ?? since);
    from.setDate(from.getDate() - OVERLAP_DAYS);

    // `search()` rend `false` quand le serveur refuse la requête : le traiter
    // comme une liste vide masquerait un refus en « rien de nouveau ».
    report = { ...report, searchSince: from };

    const uids = await client.search({ since: from }, { uid: true });
    if (uids === false) {
      return { ...report, error: "Le serveur IMAP a refusé la recherche dans INBOX." };
    }
    const slice = uids.slice(-MAX_MESSAGES);
    if (slice.length === 0) {
      await markPolled(now);
      return report;
    }


    const matched: Array<{ headers: InboxHeaders; send: SentRow }> = [];
    const unlinkedAddresses: string[] = [];

    for await (const message of client.fetch(
      slice,
      // `headers` produit un `BODY.PEEK[HEADER.FIELDS (…)]` : le serveur ne
      // renvoie que ces lignes-là, et `PEEK` n'arme pas le drapeau `\Seen`.
      { uid: true, headers: [...WANTED_HEADERS] },
      { uid: true },
    )) {
      report = { ...report, examined: report.examined + 1 };
      const raw = message.headers?.toString("utf8") ?? "";
      const headers = parseHeaderBlock(raw);

      const known = new Set(byMessageId.keys());
      const verdict = classify(headers, known);

      // Le détail est noté **avant** tout aiguillage : un message écarté est
      // exactement celui sur lequel on veut pouvoir revenir.
      examinedDetail.push({
        messageId: headers.messageId,
        inReplyTo: headers.inReplyTo,
        references: headers.references,
        verdict: verdict.kind,
        autoHeader:
          verdict.kind === "auto" ? `${verdict.header}: ${verdict.value}` : "",
        matchedId: verdict.kind === "reply" ? verdict.matchedId : "",
        tried: verdict.kind === "unrelated" ? verdict.tried : [],
        oursMissing:
          verdict.kind === "unrelated" &&
          anyOursMissing(verdict.tried, known, sendingDomain),
      });

      if (verdict.kind === "auto") {
        report = { ...report, ignoredAuto: report.ignoredAuto + 1 };
        continue;
      }
      if (verdict.kind === "bounce") {
        report = { ...report, ignoredBounce: report.ignoredBounce + 1 };
        continue;
      }
      if (verdict.kind === "unrelated") {
        report = { ...report, unrelated: report.unrelated + 1 };
        continue;
      }

      const send = byMessageId.get(verdict.matchedId);
      if (send !== undefined && headers.messageId.trim() !== "") {
        matched.push({ headers, send });
      }
    }

    // L'écriture se fait **hors de la boucle de lecture** : garder une session
    // IMAP ouverte pendant des écritures en base allonge la connexion pour rien
    // et expose au délai d'inactivité du serveur.
    for (const entry of matched) {
      const outcome = await recordReply(entry.headers, entry.send, now);
      report = {
        ...report,
        replies: report.replies + (outcome.created ? 1 : 0),
        alreadyLogged: report.alreadyLogged + (outcome.alreadyLogged ? 1 : 0),
        unlinked: report.unlinked + (outcome.unlinked ? 1 : 0),
        repaired: report.repaired + (outcome.repaired ? 1 : 0),
        sequencesStopped: report.sequencesStopped + outcome.sequencesStopped,
      };
      if (outcome.unlinked) {
        unlinkedAddresses.push(entry.send.toAddress);
      }
    }

    // Le battement de cœur est écrit **en dernier et seulement en cas de
    // succès**, comme `lastCronAt` : c'est son absence qui doit alerter.
    await markPolled(now);
    return { ...report, messages: examinedDetail, unlinkedAddresses };
  } catch (error) {
    const message = describeImapError(error);
    console.error("[inbox] relevé échoué :", message);
    return { ...report, messages: examinedDetail, error: message };
  } finally {
    try {
      await client.logout();
    } catch {
      // Une fermeture qui échoue n'a rien à dire sur le sort du relevé.
    }
  }
}

async function markPolled(now: Date): Promise<void> {
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { lastInboxPollAt: now },
    create: { id: "singleton", lastInboxPollAt: now },
  });
}

interface ReplyOutcome {
  readonly created: boolean;
  readonly alreadyLogged: boolean;
  /**
   * Rapprochée, mais **impossible à consigner** : l'envoi n'est rattaché à
   * aucune fiche. Rien n'est écrit sur personne, aucune séquence ne s'arrête.
   */
  readonly unlinked: boolean;
  /** Une réponse restée sans interaction a enfin été consignée. */
  readonly repaired: boolean;
  readonly sequencesStopped: number;
}

/**
 * Consigne une réponse détectée, une seule fois.
 *
 * **Ne jamais consigner deux fois.** Deux garde-fous, dans cet ordre :
 *
 * - la ligne `email_replies` porte le `Message-ID` du message reçu, unique en
 *   base : un second relevé bute sur la contrainte, il ne la contourne pas ;
 * - une interaction à issue « répondu » **postérieure à l'envoi rapproché**
 *   signifie que quelqu'un a déjà noté cette réponse à la main. On enregistre
 *   alors la détection sans créer de seconde interaction. L'ancre est l'envoi,
 *   pas « à un moment quelconque » : une réponse à un message plus récent
 *   trouve une ancre plus récente, et sera donc bien consignée.
 */
async function recordReply(
  headers: InboxHeaders,
  send: SentRow,
  now: Date,
): Promise<ReplyOutcome> {
  const existing = await prisma.emailReply.findUnique({
    where: { replyMessageId: headers.messageId },
    select: { id: true, activityId: true },
  });

  // **Une ligne existante n'est pas forcément un travail terminé.** Jusqu'au
  // jalon 45, ce test sortait dès qu'une ligne existait — donc une réponse
  // enregistrée alors que l'envoi n'avait aucune fiche restait sans interaction
  // **pour toujours** : rattacher la fiche ensuite ne changeait rien, puisque
  // le relevé suivant ressortait ici. Le rattrapage était impossible sans
  // toucher la base à la main.
  //
  // On ne ressort donc que si la réponse a **réellement produit** une
  // interaction. Sinon on retente : c'est ce qui rend le relevé auto-réparant.
  if (existing !== null && existing.activityId !== null) {
    return { created: false, alreadyLogged: false, unlinked: false, repaired: false, sequencesStopped: 0 };
  }

  // La date du message reçu fait foi ; à défaut d'en-tête `Date` lisible, celle
  // du relevé — jamais celle de l'envoi, qui daterait la réponse d'avant qu'elle
  // n'existe.
  const receivedAt = headers.date ?? now;

  const manual =
    send.contactId === null
      ? null
      : await prisma.activity.findFirst({
          where: {
            ...REAL_ACTIVITY,
            contactId: send.contactId,
            outcome: { in: [...ANSWERED_OUTCOMES] },
            date: { gte: send.sentAt },
          },
          select: { id: true },
        });

  let activityId: string | null = null;
  if (manual === null && send.contactId !== null) {
    const contact = await prisma.contact.findUnique({
      where: { id: send.contactId },
      select: { owner: true },
    });
    const logged = await logActivity({
      type: "email",
      date: receivedAt,
      outcome: "replied",
      contactId: send.contactId,
      owner: await ownerOrDefault(prisma, contact?.owner ?? ""),
      // Le sujet **de notre envoi**, pas celui de la réponse : c'est ce qu'on a
      // écrit, et c'est la seule chose dont on dispose sans lire le message
      // reçu. Aucun contenu de la réponse n'entre dans le CRM.
      notes: `Réponse détectée automatiquement dans la boîte de réception, à « ${send.subject} ».`,
    });
    activityId = logged.activity.id;
  }

  try {
    if (existing === null) {
      await prisma.emailReply.create({
        data: {
          replyMessageId: headers.messageId,
          sentMessageId: send.messageId,
          emailSendId: send.id,
          contactId: send.contactId,
          receivedAt,
          activityId,
        },
      });
    } else {
      // La ligne existait sans interaction : on la complète plutôt que d'en
      // écrire une seconde — le `Message-ID` reste la clé d'idempotence.
      await prisma.emailReply.update({
        where: { id: existing.id },
        data: { contactId: send.contactId, activityId },
      });
    }
  } catch (error) {
    // Deux relevés simultanés : le second perd la course sur la contrainte
    // d'unicité. Ce n'est pas une panne — c'est la contrainte qui fait son
    // travail.
    console.error("[inbox] réponse déjà enregistrée par un autre relevé :", error);
    return { created: false, alreadyLogged: false, unlinked: false, repaired: false, sequencesStopped: 0 };
  }

  // **Sans fiche, il n'y a rien à consigner et il faut le dire.** La ligne de
  // détection est écrite quand même — elle garde l'idempotence et permet la
  // réparation une fois la fiche rattachée — mais l'appelant doit compter cette
  // réponse comme *non consignée*, jamais comme un succès.
  if (send.contactId === null) {
    return { created: false, alreadyLogged: false, unlinked: true, repaired: false, sequencesStopped: 0 };
  }

  const stopped = await stopSequences(send.contactId);
  return {
    created: manual === null,
    alreadyLogged: manual !== null,
    unlinked: false,
    repaired: existing !== null && manual === null,
    sequencesStopped: stopped,
  };
}

/**
 * Arrête les séquences en cours pour ce contact.
 *
 * C'était **la seule sécurité du système** tant que la détection restait
 * manuelle (jalon 38) : elle devient automatique ici, sans changer de règle.
 * Les départs déjà composés et non envoyés sont écartés avec leur motif — un
 * brouillon en attente sur quelqu'un qui vient de répondre ne doit pas rester
 * envoyable d'un clic.
 */
async function stopSequences(contactId: string): Promise<number> {
  const active = await prisma.sequenceEnrollment.findMany({
    where: { contactId, status: "active" },
    select: { id: true },
  });
  if (active.length === 0) return 0;

  const ids = active.map((enrollment) => enrollment.id);
  await prisma.sequenceEnrollment.updateMany({
    where: { id: { in: ids } },
    data: { status: "stopped", stopReason: BLOCK_LABELS.replied },
  });
  await prisma.sequenceDeparture.updateMany({
    where: { enrollmentId: { in: ids }, status: "pending" },
    data: { status: "skipped", detail: BLOCK_LABELS.replied },
  });
  return ids.length;
}
