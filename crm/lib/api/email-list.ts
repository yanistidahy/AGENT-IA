import "server-only";
import { prisma } from "../db";
import { daysBetween, startOfDay } from "../domain/dates";
import { optedOut, TERMINAL_LIFECYCLES } from "../domain/lost";
import { signatoryName } from "../domain/email-stats";
import { readReplyFacts } from "./email-replies";
import { toLifecycle } from "../domain/guards";

/**
 * La liste de ce qui est parti, et la liste de ceux qui n'ont pas répondu.
 *
 * **C'est ce qui manquait le plus à cet écran.** Deux graphiques disent le
 * volume ; aucun ne répond à « qui n'a pas répondu ? », qui est la question
 * pour laquelle on ouvre cette page. Le premier tableau est un journal, le
 * second est une file de travail — et le second est celui qui a de la valeur.
 *
 * **Le tri et les filtres s'appliquent en mémoire, après lecture, et c'est
 * assumé.** Les colonnes qui comptent — « a répondu », « a ouvert » — sont
 * dérivées : elles n'existent pas en base et ne peuvent donc pas être triées
 * par PostgreSQL. Lire la fenêtre entière coûte moins qu'une règle qu'on ne
 * pourrait pas vérifier, exactement comme pour `/clients` au jalon 12. À
 * plusieurs dizaines de milliers d'envois il faudrait matérialiser ces colonnes,
 * au prix de la portabilité du schéma ; ce n'est pas le volume d'aujourd'hui, et
 * le code ne prétend pas le contraire.
 */

/** Même fenêtre que les chiffres de l'entête : deux fenêtres se contrediraient. */
export const LIST_WINDOW_DAYS = 90;

export const SENT_SORTS = [
  "date",
  "contact",
  "societe",
  "objet",
  "ouvertures",
  "signataire",
  "sequence",
] as const;
export type SentSort = (typeof SENT_SORTS)[number];

export const SENT_STATES = ["repondu", "sans-reponse", "ouvert"] as const;
export type SentState = (typeof SENT_STATES)[number];

export interface SentQuery {
  readonly sort?: SentSort;
  readonly dir?: "asc" | "desc";
  readonly signatory?: string;
  readonly sequence?: string;
  readonly state?: SentState;
}

/**
 * Lit la requête depuis l'URL, en ignorant ce qu'elle ne reconnaît pas.
 *
 * **Tout l'état de la liste vit dans l'URL** — une vue filtrée se met en favori,
 * se partage et survit à un rechargement, comme les filtres de colonne du jalon
 * 10. Une valeur inconnue est ignorée plutôt que refusée : un lien vieilli doit
 * ouvrir la liste, pas une page d'erreur.
 */
export function parseSentQuery(raw: Record<string, string | string[] | undefined>): SentQuery {
  const one = (key: string): string | undefined => {
    const value = raw[key];
    const text = Array.isArray(value) ? value[0] : value;
    return text === undefined || text.trim() === "" ? undefined : text.trim();
  };

  const sort = one("tri");
  const dir = one("sens");
  const state = one("etat");

  return {
    sort: SENT_SORTS.find((candidate) => candidate === sort),
    dir: dir === "asc" || dir === "desc" ? dir : undefined,
    signatory: one("signataire"),
    sequence: one("sequence"),
    state: SENT_STATES.find((candidate) => candidate === state),
  };
}

export interface SentRow {
  readonly id: string;
  readonly sentAt: Date;
  readonly contactId: string | null;
  readonly contactName: string;
  readonly company: string;
  readonly subject: string;
  readonly tracked: boolean;
  readonly openCount: number;
  readonly openedAt: Date | null;
  readonly replied: boolean;
  readonly signatory: string;
  readonly sequence: string;
  readonly step: number | null;
  readonly copyFailed: boolean;
}

export interface SentList {
  readonly rows: readonly SentRow[];
  /** Total avant filtre — « 12 sur 31 » ne se dit pas sans lui. */
  readonly total: number;
  readonly signatories: readonly string[];
  readonly sequences: readonly string[];
}

function windowStart(now: Date): Date {
  const since = new Date(now);
  since.setDate(since.getDate() - LIST_WINDOW_DAYS);
  return since;
}

export async function readSentEmails(query: SentQuery, now = new Date()): Promise<SentList> {
  const sends = await prisma.emailSend.findMany({
    where: { sentAt: { gte: windowStart(now) } },
    select: {
      id: true,
      sentAt: true,
      contactId: true,
      toAddress: true,
      subject: true,
      tracked: true,
      openCount: true,
      firstOpenAt: true,
      signatoryName: true,
      sequenceName: true,
      sequenceStep: true,
      copyStatus: true,
      contact: { select: { firstName: true, lastName: true, company: { select: { name: true } } } },
    },
    orderBy: { sentAt: "desc" },
  });

  const firstSend = new Map<string, Date>();
  for (const send of sends) {
    if (send.contactId === null) continue;
    const known = firstSend.get(send.contactId);
    if (known === undefined || send.sentAt < known) firstSend.set(send.contactId, send.sentAt);
  }
  const facts = await readReplyFacts(firstSend);

  const rows: SentRow[] = sends.map((send) => {
    const reply = send.contactId === null ? undefined : facts.get(send.contactId)?.repliedAt;
    return {
      id: send.id,
      sentAt: send.sentAt,
      contactId: send.contactId,
      // Une fiche supprimée laisse son envoi : l'adresse reste la seule trace
      // de qui l'a reçu, et vaut mieux qu'une ligne anonyme.
      contactName:
        send.contact === null
          ? send.toAddress
          : `${send.contact.firstName} ${send.contact.lastName}`.trim(),
      company: send.contact?.company?.name ?? "",
      subject: send.subject,
      tracked: send.tracked,
      openCount: send.openCount,
      openedAt: send.firstOpenAt,
      // **La réponse est postérieure à ce message-ci**, pas seulement au
      // premier : une réponse d'avant-hier ne répond pas au message de ce
      // matin, et marquer la ligne « répondu » ferait sortir de la file de
      // relance quelqu'un qu'on vient de relancer.
      replied: reply !== undefined && reply !== null && reply >= send.sentAt,
      signatory: signatoryName(send.signatoryName),
      sequence: send.sequenceName.trim(),
      step: send.sequenceStep,
      copyFailed: send.copyStatus === "failed",
    };
  });

  const signatories = [...new Set(rows.map((row) => row.signatory))].sort((a, b) =>
    a.localeCompare(b),
  );
  const sequences = [...new Set(rows.map((row) => row.sequence))]
    .filter((name) => name !== "")
    .sort((a, b) => a.localeCompare(b));

  const filtered = rows.filter((row) => {
    if (query.signatory !== undefined && row.signatory !== query.signatory) return false;
    if (query.sequence !== undefined && row.sequence !== query.sequence) return false;
    if (query.state === "repondu" && !row.replied) return false;
    if (query.state === "sans-reponse" && row.replied) return false;
    if (query.state === "ouvert" && row.openedAt === null) return false;
    return true;
  });

  return { rows: sortRows(filtered, query), total: rows.length, signatories, sequences };
}

function sortRows(rows: readonly SentRow[], query: SentQuery): SentRow[] {
  const sort = query.sort ?? "date";
  // Le défaut est antichronologique : le dernier message parti est celui dont
  // on se souvient, et celui sur lequel on revient.
  const direction = query.dir ?? (sort === "date" ? "desc" : "asc");
  const sign = direction === "desc" ? -1 : 1;

  const compare = (a: SentRow, b: SentRow): number => {
    switch (sort) {
      case "contact":
        return a.contactName.localeCompare(b.contactName);
      case "societe":
        return a.company.localeCompare(b.company);
      case "objet":
        return a.subject.localeCompare(b.subject);
      case "ouvertures":
        return a.openCount - b.openCount;
      case "signataire":
        return a.signatory.localeCompare(b.signatory);
      case "sequence":
        return `${a.sequence}${a.step ?? ""}`.localeCompare(`${b.sequence}${b.step ?? ""}`);
      default:
        return a.sentAt.getTime() - b.sentAt.getTime();
    }
  };

  // À égalité, la date tranche : sans second critère, deux lignes du même
  // signataire changeraient d'ordre d'un rafraîchissement à l'autre.
  return [...rows].sort(
    (a, b) => sign * compare(a, b) || b.sentAt.getTime() - a.sentAt.getTime(),
  );
}

/* ------------------------------------------------------- sans réponse */

export interface SilentRow {
  readonly contactId: string;
  readonly name: string;
  readonly company: string;
  readonly email: string;
  readonly phone: string;
  readonly lastSentAt: Date;
  readonly silentDays: number;
  readonly messages: number;
  readonly lastSubject: string;
}

/**
 * Les personnes écrites qui n'ont pas répondu, du plus long silence au plus
 * court.
 *
 * Trois populations en sont exclues, et pour la même raison : **on ne relance
 * pas quelqu'un à qui l'on n'a plus rien à demander.** Une fiche terminale
 * (`Perdu`, `Ancien Client`) a été close ; une opposition ferme au démarchage
 * est une obligation, pas une préférence ; et quelqu'un qui a répondu n'est
 * plus silencieux — c'est même exactement ce que ce tableau cherche.
 */
export async function readSilentContacts(now = new Date()): Promise<readonly SilentRow[]> {
  const sends = await prisma.emailSend.findMany({
    where: { sentAt: { gte: windowStart(now) }, contactId: { not: null } },
    select: {
      sentAt: true,
      contactId: true,
      subject: true,
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          lifecycle: true,
          lostReason: true,
          company: { select: { name: true } },
        },
      },
    },
    orderBy: { sentAt: "asc" },
  });

  const firstSend = new Map<string, Date>();
  for (const send of sends) {
    if (send.contactId === null) continue;
    const known = firstSend.get(send.contactId);
    if (known === undefined || send.sentAt < known) firstSend.set(send.contactId, send.sentAt);
  }
  const facts = await readReplyFacts(firstSend);

  const rows = new Map<string, SilentRow>();
  const today = startOfDay(now);

  for (const send of sends) {
    const contact = send.contact;
    if (contact === null) continue;
    if (facts.get(contact.id)?.repliedAt != null) continue;

    const lifecycle = toLifecycle(contact.lifecycle);
    if (TERMINAL_LIFECYCLES.includes(lifecycle)) continue;
    if (optedOut({ lostReason: contact.lostReason })) continue;

    const known = rows.get(contact.id);
    const messages = (known?.messages ?? 0) + 1;
    // Les envois arrivent du plus ancien au plus récent : le dernier vu est le
    // dernier parti, et c'est lui qui date le silence.
    rows.set(contact.id, {
      contactId: contact.id,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      company: contact.company?.name ?? "",
      email: contact.email,
      phone: contact.phone,
      lastSentAt: send.sentAt,
      silentDays: daysBetween(startOfDay(send.sentAt), today),
      messages,
      lastSubject: send.subject,
    });
  }

  return [...rows.values()].sort(
    (a, b) => b.silentDays - a.silentDays || a.name.localeCompare(b.name),
  );
}
