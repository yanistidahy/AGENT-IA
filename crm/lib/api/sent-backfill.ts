import "server-only";
import { ImapFlow } from "imapflow";
import { prisma } from "../db";
import { readMailConfig, PASSWORD_ENV } from "./mail";
import { describeImapError, imapMissingFields, pickSentMailbox, readImapConfig } from "./imap";
import { headerDate, readHeaders } from "./inbox";
import { planBackfill, type BackfillPlan, type SendLike, type SentHeaderLike } from "../domain/sent-match";

/**
 * Réparer le passé depuis le dossier « Envoyés ».
 *
 * **Le défaut du jalon 44 a laissé des identifiants faux en base.** Le
 * correctif empêche la suite ; il ne répare rien de ce qui est parti. Or les
 * messages réellement envoyés existent toujours, avec leur vrai `Message-ID`,
 * dans le dossier « Envoyés » du compte — c'est même la raison d'être de la
 * copie du jalon 37.
 *
 * ## Pourquoi c'est solide
 *
 * L'identifiant n'est pas déduit, ni reconstruit : il est **lu dans le message
 * lui-même**, tel que le serveur l'a reçu. C'est la même source que celle que
 * le destinataire cite dans sa réponse — donc, par construction, celle qui fera
 * correspondre le rapprochement.
 *
 * ## Les garanties, dans l'ordre où elles comptent
 *
 * 1. **Simulation d'abord.** Sans `apply`, rien n'est écrit — même contrat que
 *    les reports de feuille des jalons 11, 21 et 25.
 * 2. **Une seule colonne touchée** : `messageId`. Ni le sujet, ni le corps, ni
 *    les dates, ni les compteurs.
 * 3. **En-têtes seuls.** `BODY.PEEK[HEADER.FIELDS (…)]` sur quatre en-têtes :
 *    la promesse du jalon 41 — le CRM ne lit aucun corps — vaut aussi pour
 *    notre propre dossier.
 * 4. **Lecture seule** (`readOnly: true`) : aucun drapeau touché, rien de
 *    marqué comme lu.
 * 5. **L'ambiguïté n'est jamais tranchée.** Voir `lib/domain/sent-match.ts`.
 * 6. **Idempotent** : un envoi dont l'identifiant est déjà juste est compté
 *    « déjà correct » et n'est pas réécrit.
 */

const WANTED_HEADERS = ["message-id", "to", "date", "subject"] as const;

/** Fenêtre de rattrapage. Au-delà, une réponse n'arrivera plus. */
const WINDOW_DAYS = 180;
const MAX_MESSAGES = 500;

export interface BackfillReport extends BackfillPlan {
  readonly applied: number;
  readonly mailbox: string;
  readonly error: string | null;
  /** Combien de lignes `email_sends` entraient dans la fenêtre. */
  readonly knownSent: number;
}

const EMPTY: BackfillReport = {
  fixes: [],
  already: 0,
  unknown: 0,
  ambiguous: [],
  examined: 0,
  applied: 0,
  mailbox: "",
  error: null,
  knownSent: 0,
};

export async function backfillMessageIds(
  apply: boolean,
  now = new Date(),
): Promise<BackfillReport> {
  const mail = await readMailConfig();
  const config = await readImapConfig();
  const password = process.env[PASSWORD_ENV] ?? "";

  const missing = imapMissingFields(config, mail, password !== "");
  if (missing.length > 0) {
    return { ...EMPTY, error: `Relevé non configuré : il manque ${missing.join(", ")}.` };
  }

  const since = new Date(now);
  since.setDate(since.getDate() - WINDOW_DAYS);

  const rows = await prisma.emailSend.findMany({
    where: { sentAt: { gte: since } },
    select: { id: true, toAddress: true, sentAt: true, messageId: true, subject: true },
    orderBy: { sentAt: "desc" },
  });
  const sends: SendLike[] = rows.map((row) => ({ ...row }));

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.encryption === "tls",
    auth: { user: mail.user, pass: password },
    // Même raison qu'ailleurs : le journal d'imapflow porterait les sujets.
    logger: false,
  });

  const headers: SentHeaderLike[] = [];
  let mailbox = "";

  try {
    await client.connect();

    const boxes = await client.list();
    const target = pickSentMailbox(boxes, config.sentMailbox);
    if (target === null) {
      return {
        ...EMPTY,
        knownSent: sends.length,
        error: "Aucun dossier « Envoyés » trouvé : ni drapeau « \\Sent », ni nom de repli valide.",
      };
    }
    mailbox = target.path;

    await client.mailboxOpen(target.path, { readOnly: true });

    const uids = await client.search({ since }, { uid: true });
    if (uids === false) {
      return {
        ...EMPTY,
        mailbox,
        knownSent: sends.length,
        error: "Le serveur IMAP a refusé la recherche dans « Envoyés ».",
      };
    }

    for await (const message of client.fetch(
      uids.slice(-MAX_MESSAGES),
      { uid: true, headers: [...WANTED_HEADERS] },
      { uid: true },
    )) {
      const found = readHeaders(message.headers?.toString("utf8") ?? "");
      headers.push({
        messageId: found.get("message-id") ?? "",
        to: found.get("to") ?? "",
        date: headerDate(found.get("date")),
      });
    }
  } catch (error) {
    const message = describeImapError(error);
    console.error("[envoyés] rattrapage interrompu :", message);
    return { ...EMPTY, mailbox, knownSent: sends.length, error: message };
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }

  const plan = planBackfill(headers, sends);
  if (!apply) return { ...plan, applied: 0, mailbox, error: null, knownSent: sends.length };

  let applied = 0;
  for (const fix of plan.fixes) {
    // La condition porte sur la **valeur relue**, pas sur une lecture
    // antérieure : si un envoi a été corrigé entre la simulation et le clic,
    // il est ignoré plutôt qu'écrasé. Même garde qu'à l'acceptation des
    // domaines du jalon 26.
    const result = await prisma.emailSend.updateMany({
      where: { id: fix.sendId, messageId: fix.stored },
      data: { messageId: fix.real },
    });
    applied += result.count;
  }

  return { ...plan, applied, mailbox, error: null, knownSent: sends.length };
}

export interface RelinkReport {
  readonly orphans: number;
  readonly relinked: number;
  readonly unmatched: number;
  /**
   * Les adresses qu'on n'a pas su rattacher, **et pourquoi**.
   *
   * Un compteur seul ne se traite pas : « 3 non rattachés » n'indique ni qui,
   * ni s'il faut créer une fiche ou fusionner un doublon. Les deux causes
   * demandent des gestes opposés, donc elles sont nommées séparément.
   */
  readonly missing: readonly string[];
  readonly duplicated: readonly string[];
}

/**
 * Re-rattacher les envois dont la fiche a été supprimée.
 *
 * **Trouvé en diagnostiquant le jalon 44, et distinct du `Message-ID`.**
 * `EmailSend.contactId` est en `SetNull` (jalon 3, pour que supprimer une fiche
 * n'efface pas l'historique commercial). Or `restoreBackup()` **supprime tous
 * les contacts** avant de les recréer : après une restauration, chaque envoi
 * antérieur porte donc `contactId: null`, avec de nouveaux identifiants côté
 * fiches.
 *
 * La conséquence est silencieuse et grave : `recordReply()` n'écrit **aucune
 * interaction** et n'arrête **aucune séquence** quand `contactId` est nul
 * (`lib/api/inbox.ts`). Une réponse serait « détectée » sans que rien
 * n'apparaisse sur la fiche — exactement le genre de panne muette que le jalon
 * 38 s'interdit.
 *
 * Le rattachement se fait par **adresse électronique**, la seule clé stable au
 * travers d'une restauration. Une adresse portée par deux fiches est laissée
 * telle quelle : deviner laquelle attribuerait une réponse au hasard.
 */
export async function relinkOrphanSends(apply: boolean): Promise<RelinkReport> {
  const orphans = await prisma.emailSend.findMany({
    where: { contactId: null },
    select: { id: true, toAddress: true },
  });
  if (orphans.length === 0) {
    return { orphans: 0, relinked: 0, unmatched: 0, missing: [], duplicated: [] };
  }

  const addresses = [...new Set(orphans.map((send) => send.toAddress.trim().toLowerCase()))];
  const contacts = await prisma.contact.findMany({
    where: { email: { in: addresses, mode: "insensitive" } },
    select: { id: true, email: true },
  });

  // Une adresse portée par deux fiches ne désigne personne : elle est écartée.
  // **Le rapprochement se fait en mémoire**, sur des adresses normalisées, et
  // pas seulement par la clause SQL : c'est la règle du jalon 6 pour les noms de
  // société, et elle vaut ici pour la même raison — une comparaison qu'on ne
  // peut pas relire est une comparaison qu'on ne peut pas corriger.
  const byEmail = new Map<string, string | null>();
  for (const contact of contacts) {
    const key = (contact.email ?? "").trim().toLowerCase();
    if (key === "") continue;
    byEmail.set(key, byEmail.has(key) ? null : contact.id);
  }

  let relinked = 0;
  const missing = new Set<string>();
  const duplicated = new Set<string>();

  for (const send of orphans) {
    const key = send.toAddress.trim().toLowerCase();
    const contactId = byEmail.get(key) ?? null;
    if (contactId === null) {
      // `has` sans valeur = l'adresse existe sur **plusieurs** fiches. Le geste
      // à faire est alors une fusion, pas une création.
      if (byEmail.has(key)) duplicated.add(send.toAddress);
      else missing.add(send.toAddress);
      continue;
    }
    if (apply) {
      await prisma.emailSend.update({ where: { id: send.id }, data: { contactId } });
    }
    relinked += 1;
  }

  return {
    orphans: orphans.length,
    relinked,
    unmatched: missing.size + duplicated.size,
    missing: [...missing],
    duplicated: [...duplicated],
  };
}
