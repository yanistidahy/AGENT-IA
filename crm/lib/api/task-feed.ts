import "server-only";
import { prisma } from "../db";
import { contactTitle } from "../domain/contact-identity";
import { TERMINAL_LIFECYCLES } from "../domain/lost";
import { toTaskPriority } from "../domain/guards";
import { compareKeys, sortKey } from "../domain/sort-key";
import {
  foldSearch,
  isCallTitle,
  HOT_WINDOW_DAYS,
  type FeedRow,
  type HotSignalKind,
} from "../domain/task-tabs";
import { CORRECTION_OWNER } from "./real-activity";
import { listDepartures } from "./departures";

/**
 * **Une seule lecture, six onglets.**
 *
 * L'écran Tâches range quatre origines de travail dans six onglets. Ce module
 * les assemble **une fois**, en lignes de même forme, et n'écrit rien : pas une
 * colonne d'onglet, pas un statut « traité », pas une ligne de tâche dupliquée.
 * Tout ce qui décide d'un onglet est un fait déjà en base, relu à chaque
 * affichage — c'est la règle « aucune écriture sans clic » du jalon 8 appliquée
 * à un écran de consultation, et c'est aussi la seule façon qu'une pastille ne
 * puisse pas se périmer.
 *
 * Les quatre origines, et leur fichier :
 *
 * | Origine | Lue dans | Onglets |
 * |---|---|---|
 * | `Task` (jalon 4), y compris les tâches miroir des relances (jalon 8) | `lib/api/tasks.ts` | Vos tâches, Appels, Toutes |
 * | `SequenceDeparture` en attente (jalon 38) | `lib/api/departures.ts` — **la même lecture que « Départs du jour »** | À envoyer, Toutes |
 * | `EmailReply` relevée par IMAP (jalon 41) | ici | Réponses des prospects, Toutes |
 * | Signaux d'intérêt : réponse, clic sur un de nos liens (jalon 92), passage en Qualifié (jalon 22) | ici | Prospects chauds |
 *
 * **La file des départs n'est pas recopiée** : `listDepartures()` est la lecture
 * de « Départs du jour », avec ses garde-fous et ses refus nommés (jalon 91).
 * Deux lectures d'une même file finiraient par ne plus dire la même chose, et
 * c'est toujours la seconde qu'on oublie de corriger (jalons 55, 64, 66, 74, 85).
 */

/** Les types d'interaction qui valent « on a donné suite ». */
const OUTGOING_TYPES = ["call", "email", "meeting", "demo", "linkedin", "instagram"] as const;

export interface TaskFeed {
  readonly rows: readonly FeedRow[];
  readonly owners: readonly string[];
}

function windowStart(now: Date): Date {
  return new Date(now.getTime() - HOT_WINDOW_DAYS * 86_400_000);
}

/** Lignes de tâches — l'origine historique de l'écran. */
async function taskRows(): Promise<FeedRow[]> {
  const rows = await prisma.task.findMany({
    where: { done: false },
    orderBy: [{ due: "asc" }],
    select: {
      id: true,
      title: true,
      due: true,
      priority: true,
      owner: true,
      done: true,
      contactId: true,
      contact: { select: { id: true, firstName: true, lastName: true, lifecycle: true } },
      company: { select: { name: true } },
      deal: { select: { name: true } },
    },
  });

  return rows.map((row) => {
    const contactName = row.contact === null ? "" : contactTitle(row.contact);
    const detail =
      contactName !== ""
        ? contactName
        : (row.company?.name ?? row.deal?.name ?? "Sans rattachement");
    return {
      id: `tache:${row.id}`,
      kind: "task" as const,
      title: row.title,
      detail,
      due: row.due,
      done: row.done,
      priority: toTaskPriority(row.priority),
      owner: row.owner,
      contactId: row.contactId,
      contactName,
      href: row.contactId === null ? null : `/contacts?fiche=${row.contactId}`,
      isCall: isCallTitle(row.title),
      pendingSend: false,
      unhandledReply: false,
      hotSignal: null,
      terminal:
        row.contact !== null &&
        TERMINAL_LIFECYCLES.includes(row.contact.lifecycle as (typeof TERMINAL_LIFECYCLES)[number]),
      at: row.due,
      searchText: foldSearch(`${row.title} ${detail} ${row.owner}`),
    };
  });
}

/** Lignes de départs — la file du matin, telle qu'elle est déjà lue. */
async function departureRows(now: Date): Promise<FeedRow[]> {
  const departures = await listDepartures(now);
  return departures.map((departure) => ({
    id: `depart:${departure.id}`,
    kind: "departure" as const,
    title: departure.subject === "" ? "Brouillon non composé" : departure.subject,
    detail: `${departure.contactName} · ${departure.campaignName}`,
    due: null,
    done: false,
    priority: null,
    owner: "",
    contactId: departure.contactId,
    contactName: departure.contactName,
    href: "/departs",
    isCall: false,
    // `pending` seulement : un départ `failed` est un brouillon qui n'a pas été
    // composé, il se répare, il ne s'envoie pas. Il reste visible sous
    // « Toutes les tâches », où il demande une action sans en promettre une.
    pendingSend: departure.status === "pending",
    unhandledReply: false,
    hotSignal: null,
    terminal: false,
    at: departure.createdAt,
    searchText: foldSearch(
      `${departure.subject} ${departure.contactName} ${departure.campaignName} ${departure.to}`,
    ),
  }));
}

interface ReplyRow {
  readonly id: string;
  readonly receivedAt: Date;
  readonly contactId: string | null;
  readonly contact: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly lifecycle: string;
    readonly owner: string;
  } | null;
  readonly activityId: string | null;
}

/**
 * Une réponse **pas encore traitée**, et ce que « traitée » veut dire.
 *
 * Il n'y a **aucune colonne** pour le dire, et ce jalon n'en ajoute pas : la
 * consigne était de calculer les onglets à la lecture. Une réponse est donc
 * traitée quand **on a donné suite** — une interaction sortante consignée sur
 * cette fiche *après* la réponse, l'interaction que le relevé écrit lui-même
 * exceptée (jalon 41), et les notes de correction exclues comme partout depuis
 * le jalon 27.
 *
 * C'est dérivé, donc jamais périmé : rappeler quelqu'un vide l'onglet sans
 * qu'on ait à cocher quoi que ce soit.
 */
async function replyHandled(rows: readonly ReplyRow[]): Promise<Set<string>> {
  const handled = new Set<string>();
  const withContact = rows.filter((row) => row.contactId !== null);
  if (withContact.length === 0) return handled;

  const oldest = withContact.reduce(
    (min, row) => (row.receivedAt < min ? row.receivedAt : min),
    withContact[0]?.receivedAt ?? new Date(),
  );

  const follow = await prisma.activity.findMany({
    where: {
      contactId: { in: withContact.map((row) => row.contactId ?? "") },
      date: { gte: oldest },
      type: { in: [...OUTGOING_TYPES] },
      NOT: { owner: CORRECTION_OWNER },
    },
    select: { id: true, contactId: true, date: true },
  });

  for (const row of withContact) {
    const answered = follow.some(
      (activity) =>
        activity.contactId === row.contactId &&
        activity.id !== row.activityId &&
        activity.date > row.receivedAt,
    );
    if (answered) handled.add(row.id);
  }
  return handled;
}

async function replyRows(now: Date): Promise<{
  readonly rows: FeedRow[];
  readonly hot: readonly ReplyRow[];
}> {
  const replies = await prisma.emailReply.findMany({
    orderBy: { receivedAt: "desc" },
    take: 200,
    select: {
      id: true,
      receivedAt: true,
      contactId: true,
      activityId: true,
      contact: {
        select: { id: true, firstName: true, lastName: true, lifecycle: true, owner: true },
      },
    },
  });

  const handled = await replyHandled(replies);
  const rows = replies.map((reply) => {
    const name = reply.contact === null ? "Fiche introuvable" : contactTitle(reply.contact);
    const terminal =
      reply.contact !== null &&
      TERMINAL_LIFECYCLES.includes(reply.contact.lifecycle as (typeof TERMINAL_LIFECYCLES)[number]);
    return {
      id: `reponse:${reply.id}`,
      kind: "reply" as const,
      title: `${name} a répondu`,
      detail:
        reply.contactId === null
          ? "Envoi sans fiche rattachée — Réglages → Messagerie"
          : (reply.contact?.lifecycle ?? ""),
      due: null,
      done: false,
      priority: null,
      owner: reply.contact?.owner ?? "",
      contactId: reply.contactId,
      contactName: name,
      href: reply.contactId === null ? null : `/contacts?fiche=${reply.contactId}`,
      isCall: false,
      pendingSend: false,
      unhandledReply: !handled.has(reply.id),
      hotSignal: null,
      terminal,
      at: reply.receivedAt,
      searchText: foldSearch(`${name} réponse`),
    };
  });

  const start = windowStart(now);
  return { rows, hot: replies.filter((reply) => reply.receivedAt >= start) };
}

/**
 * Les prospects chauds — **et seulement des signaux qu'on peut défendre**.
 *
 * Trois faits y donnent droit : une réponse reçue, un clic sur l'un de nos
 * propres liens, un passage en Qualifié. Aucun n'est une estimation.
 *
 * **Le pixel d'ouverture n'entre jamais ici** : il surestime par construction
 * (jalons 37 et 43), et une file d'appels alimentée par des relais Apple ferait
 * appeler des gens qui n'ont rien fait. Une garde statique interdit de l'y
 * introduire plus tard.
 *
 * Un cycle de vie terminal exclut la ligne : quelqu'un qui a dit non n'est pas
 * un prospect chaud, même s'il vient de répondre — sa réponse reste dans
 * « Réponses des prospects », où elle demande une lecture, pas un appel.
 */
async function hotRows(now: Date, replies: readonly ReplyRow[]): Promise<FeedRow[]> {
  const start = windowStart(now);

  const [clicks, deals] = await Promise.all([
    prisma.emailLinkClick.findMany({
      where: { at: { gte: start } },
      orderBy: { at: "desc" },
      select: {
        id: true,
        at: true,
        kind: true,
        emailSend: {
          select: {
            contact: {
              select: { id: true, firstName: true, lastName: true, lifecycle: true, owner: true },
            },
          },
        },
      },
    }),
    // `Deal.createdAt` **est** la date de qualification depuis le jalon 22 :
    // l'affaire naît du geste « Qualifier », qui écrit les deux dans la même
    // transaction.
    prisma.deal.findMany({
      where: { createdAt: { gte: start }, contactId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        contact: {
          select: { id: true, firstName: true, lastName: true, lifecycle: true, owner: true },
        },
      },
    }),
  ]);

  interface Signal {
    readonly kind: HotSignalKind;
    readonly at: Date;
    readonly detail: string;
    readonly contact: {
      readonly id: string;
      readonly firstName: string;
      readonly lastName: string;
      readonly lifecycle: string;
      readonly owner: string;
    };
  }

  const signals: Signal[] = [];
  for (const reply of replies) {
    if (reply.contact === null) continue;
    signals.push({
      kind: "reply",
      at: reply.receivedAt,
      detail: "a répondu à un de nos messages",
      contact: reply.contact,
    });
  }
  for (const click of clicks) {
    const contact = click.emailSend.contact;
    if (contact === null) continue;
    signals.push({
      kind: "click",
      at: click.at,
      detail:
        click.kind === "video"
          ? "a cliqué sur la vidéo de démonstration"
          : "a cliqué sur le lien de réservation",
      contact,
    });
  }
  for (const deal of deals) {
    if (deal.contact === null) continue;
    signals.push({
      kind: "qualified",
      at: deal.createdAt,
      detail: `passé en Qualifié — ${deal.name}`,
      contact: deal.contact,
    });
  }

  /*
    **Une ligne par personne, pas une par signal.** Quelqu'un qui répond puis
    clique est un seul prospect à rappeler : deux lignes feraient deux appels, et
    l'onglet compterait des événements là où il doit compter des gens.
  */
  const best = new Map<string, Signal>();
  for (const signal of signals) {
    const current = best.get(signal.contact.id);
    if (current === undefined || signal.at > current.at) best.set(signal.contact.id, signal);
  }

  return [...best.values()]
    .filter(
      (signal) =>
        !TERMINAL_LIFECYCLES.includes(
          signal.contact.lifecycle as (typeof TERMINAL_LIFECYCLES)[number],
        ),
    )
    .map((signal) => {
      const name = contactTitle(signal.contact);
      return {
        id: `chaud:${signal.contact.id}`,
        kind: "hot" as const,
        title: `${name} — ${signal.detail}`,
        detail: signal.contact.lifecycle,
        due: null,
        done: false,
        priority: null,
        owner: signal.contact.owner,
        contactId: signal.contact.id,
        contactName: name,
        href: `/contacts?fiche=${signal.contact.id}`,
        isCall: false,
        pendingSend: false,
        unhandledReply: false,
        hotSignal: signal.kind,
        terminal: false,
        at: signal.at,
        searchText: foldSearch(`${name} ${signal.detail}`),
      };
    });
}

/**
 * Toutes les lignes de l'écran, une fois.
 *
 * Les prédicats des onglets s'appliquent ensuite à **ce** tableau, pour les
 * pastilles comme pour les listes : c'est ce qui rend impossible qu'une pastille
 * et sa liste divergent.
 */
export async function readTaskFeed(now = new Date()): Promise<TaskFeed> {
  const [tasks, departures, replies] = await Promise.all([
    taskRows(),
    departureRows(now),
    replyRows(now),
  ]);
  const hot = await hotRows(now, replies.hot);

  const rows = [...tasks, ...departures, ...replies.rows, ...hot];
  // Alphabétique par la clé pliée du jalon 72, jamais `localeCompare` : celui-ci
  // suit la locale du conteneur, donc l'ordre changerait d'un environnement à
  // l'autre.
  const owners = [...new Set(rows.map((row) => row.owner).filter((owner) => owner !== ""))].sort(
    (a, b) => compareKeys(sortKey([a]), sortKey([b])),
  );
  return { rows, owners };
}
