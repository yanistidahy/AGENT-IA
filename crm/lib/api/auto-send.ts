import { readMailboxUsage } from "./mailbox-cap";
import { capReached, sortByPriority, describeCappedBoxes } from "../domain/mailbox-cap";
import "server-only";
import { prisma } from "../db";
import { contactTitle } from "../domain/contact-identity";
import { sendDeparture } from "./departures";
import {
  DEFAULT_AUTO_SEND,
  MAX_FAILURES,
  describePlan,
  estimatedEnd,
  insideWindow,
  lateBy,
  nextSlot,
  pushIntoWindow,
  validateSettings,
  type AutoSendPlan,
  type AutoSendSettings,
} from "../domain/auto-send";

/**
 * **L'envoi automatique, côté serveur.**
 *
 * Ce fichier n'envoie rien lui-même : il décide *quand*, puis appelle
 * `sendDeparture` — la fonction du bouton « Envoyer » (jalon 91), avec ses
 * refus nommés, sa résolution de boîte et ses zéro appel au modèle. Un second
 * chemin d'envoi aurait deux jeux de garde-fous, et ce serait le second qui
 * oublierait la fiche passée en « Perdu » depuis l'inscription.
 */

const ROW_ID = "singleton";

interface StateRow extends AutoSendSettings {
  readonly dueAt: Date | null;
  readonly lastSendAt: Date | null;
  readonly lastTickAt: Date | null;
  readonly failures: number;
  readonly stoppedReason: string;
}

/**
 * La ligne de réglages, créée à la première lecture.
 *
 * `upsert` plutôt qu'un `findUnique` suivi d'un `create` : deux instances qui
 * démarrent en même temps créeraient deux lignes, et la clé primaire fixe rend
 * la course inoffensive.
 */
async function readRow(): Promise<StateRow> {
  const row = await prisma.autoSend.upsert({
    where: { id: ROW_ID },
    update: {},
    create: { id: ROW_ID },
  });
  return {
    enabled: row.enabled,
    intervalSeconds: row.intervalSeconds,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    vary: row.vary,
    dueAt: row.dueAt,
    lastSendAt: row.lastSendAt,
    lastTickAt: row.lastTickAt,
    failures: row.failures,
    stoppedReason: row.stoppedReason,
  };
}

function settingsOf(row: StateRow): AutoSendSettings {
  return {
    enabled: row.enabled,
    intervalSeconds: row.intervalSeconds,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    vary: row.vary,
  };
}

/* ------------------------------------------------------------- la file ----- */

/**
 * Les départs que l'ordonnanceur peut envoyer, du plus ancien au plus récent.
 *
 * **Jamais un brouillon « non composé ».** Un départ dont l'objet ou le corps
 * est vide n'a pas de message : l'envoyer partirait vide chez quelqu'un. La
 * campagne en pause est écartée ici *et* revérifiée par `sendDeparture` — ce
 * n'est pas une duplication de règle mais une lecture : le compte affiché à
 * l'écran ne doit pas promettre des envois que la fonction refusera.
 */
async function queue(
  now = new Date(),
): Promise<readonly { readonly id: string; readonly label: string }[]> {
  const rows = await prisma.sequenceDeparture.findMany({
    where: {
      status: "pending",
      subject: { not: "" },
      body: { not: "" },
      enrollment: { status: "active", sequence: { active: true } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      step: true,
      createdAt: true,
      enrollment: {
        select: {
          sequence: { select: { campaign: { select: { mailboxId: true } } } },
          contact: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              instagram: true,
              company: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  /*
    **Une boîte pleine est sautée, l'ordonnanceur continue avec les autres.**

    L'écarter ici plutôt que de laisser `sendDeparture` refuser n'est pas une
    duplication de règle : sans cela, le premier départ d'une boîte pleine
    occuperait le créneau du tour, `tick` refuserait, et l'envoi automatique
    s'arrêterait pour tout le monde au lieu de continuer ailleurs. Le refus
    reste au même endroit — c'est la lecture qui apprend à regarder plus loin.
  */
  const usage = await readMailboxUsage(now);
  const full = new Set(usage.filter((entry) => capReached(entry)).map((entry) => entry.mailboxId));

  const open = rows.filter((row) => {
    const box = row.enrollment.sequence.campaign?.mailboxId ?? "";
    return box === "" || !full.has(box);
  });

  /*
    **Le même ordre que « Départs du jour ».** Les relances d'abord, puis le
    plus ancien : les deux surfaces dépensent les derniers créneaux du jour sur
    les mêmes départs, et une garde statique vérifie qu'elles ne cessent pas de
    partager cette fonction.
  */
  return sortByPriority(open).map((row) => {
    const contact = row.enrollment.contact;
    const name = contactTitle(contact);
    const house = contact.company?.name ?? "";
    return { id: row.id, label: house === "" ? name : `${name} (${house})` };
  });
}

/* --------------------------------------------------------- le verrou ------- */

/**
 * Réclame le créneau dû, et rend `true` si c'est nous qui l'avons pris.
 *
 * **C'est la ligne qui sert de verrou.** `updateMany` conditionné sur `dueAt`
 * est atomique : deux instances, ou une instance et son remplaçante pendant un
 * redéploiement, ne peuvent pas obtenir toutes les deux `count: 1`. Une
 * vérification applicative — lire puis écrire — serait contournable par la
 * course qu'elle prétend empêcher (jalon 8). C'est aussi ce qui donne la
 * reprise après redémarrage sans rien de plus : l'échéance vit en base.
 */
async function claimSlot(
  now: Date,
  settings: AutoSendSettings,
  random = Math.random(),
): Promise<boolean> {
  const claimed = await prisma.autoSend.updateMany({
    where: { id: ROW_ID, enabled: true, dueAt: { lte: now } },
    data: { dueAt: nextSlot(now, settings, random), lastSendAt: now },
  });
  return claimed.count === 1;
}

/* ----------------------------------------------------------- un tour ------- */

export interface TickReport {
  /** Ce qui a été tenté, en une phrase — pour le journal du serveur. */
  readonly detail: string;
  readonly sent: boolean;
}

/**
 * Un tour de boucle : au plus **un** envoi.
 *
 * Un tour qui viderait la file d'un coup annulerait l'espacement, qui est toute
 * la raison d'être de ce jalon.
 */
export async function tick(now = new Date()): Promise<TickReport> {
  const row = await readRow();
  await prisma.autoSend.update({ where: { id: ROW_ID }, data: { lastTickAt: now } });

  if (!row.enabled) return { detail: "éteint", sent: false };
  const settings = settingsOf(row);

  if (!insideWindow(now, settings)) {
    /*
      Hors fenêtre, on replace l'échéance à la réouverture plutôt que de la
      laisser derrière nous : sinon toute la file partirait d'un coup lundi
      matin, c'est-à-dire exactement la rafale que l'espacement évite.
    */
    if (row.dueAt === null || row.dueAt < now) {
      await prisma.autoSend.update({
        where: { id: ROW_ID },
        data: { dueAt: pushIntoWindow(now, settings) },
      });
    }
    return { detail: "hors de la fenêtre d'envoi", sent: false };
  }

  if (row.dueAt === null) {
    // Premier tour depuis l'allumage : le premier envoi part tout de suite.
    await prisma.autoSend.update({ where: { id: ROW_ID }, data: { dueAt: now } });
    return { detail: "premier créneau posé", sent: false };
  }
  if (row.dueAt > now) return { detail: "pas encore l'heure", sent: false };

  const pending = await queue(now);
  const next = pending[0];
  if (next === undefined) return { detail: "aucun départ en attente", sent: false };

  if (!(await claimSlot(now, settings))) {
    return { detail: "créneau déjà pris par une autre instance", sent: false };
  }

  const outcome = await sendDeparture(next.id, "scheduler", now);
  if (outcome.ok) {
    await prisma.autoSend.update({ where: { id: ROW_ID }, data: { failures: 0 } });
    return { detail: outcome.message, sent: true };
  }

  /*
    **Un envoi refusé n'est jamais silencieux**, et tous les refus ne se valent
    pas. Ceux qui retirent le départ de la file — fiche close, réponse arrivée,
    campagne en pause — sont le travail normal de l'ordonnanceur : les compter
    comme des pannes couperait l'envoi automatique sur une file parfaitement
    saine. Ce qui compte comme panne, c'est un refus qui laisse le départ en
    place, donc qui se reproduira au créneau suivant.
  */
  const stillQueued = await prisma.sequenceDeparture.count({
    where: { id: next.id, status: "pending" },
  });
  if (stillQueued === 0) {
    await prisma.autoSend.update({ where: { id: ROW_ID }, data: { failures: 0 } });
    return { detail: `départ écarté : ${outcome.message}`, sent: false };
  }

  const failures = row.failures + 1;
  if (failures >= MAX_FAILURES) {
    await prisma.autoSend.update({
      where: { id: ROW_ID },
      data: { enabled: false, failures, stoppedReason: outcome.message },
    });
    return { detail: `arrêt après ${failures} échecs : ${outcome.message}`, sent: false };
  }
  await prisma.autoSend.update({ where: { id: ROW_ID }, data: { failures } });
  return { detail: `échec ${failures}/${MAX_FAILURES} : ${outcome.message}`, sent: false };
}

/* ------------------------------------------------------------ l'écran ------ */

export interface AutoSendStatus {
  readonly settings: AutoSendSettings;
  readonly sentence: string;
  readonly plan: AutoSendPlan;
  readonly endAt: Date | null;
  readonly lastTickAt: Date | null;
  /**
   * Ce que l'ordonnanceur a retiré de la file aujourd'hui, et pourquoi.
   *
   * **Un départ écarté quitte la file** — c'est la règle du jalon 91, et elle est
   * juste : une carte qui reste au-dessus d'un motif définitif se relit tous les
   * matins pour rien. Mais un retrait qui n'apparaît nulle part serait un envoi
   * qui n'a pas eu lieu en silence : le panneau les nomme, avec leur cause.
   */
  readonly dropped: readonly { readonly name: string; readonly reason: string }[];
  /**
   * Les boîtes qui ont atteint leur plafond du jour, nommées.
   *
   * L'ordonnanceur ne s'arrête pas pour autant : il saute ces départs et
   * continue avec les autres boîtes. Sans cette phrase, la file paraîtrait
   * bloquée alors qu'elle avance ailleurs, et « fin estimée » ne compterait
   * qu'une partie des départs sans dire pourquoi.
   */
  readonly capNotice: string;
}

/** Les départs écartés depuis `since`, nommés avec leur motif. */
async function droppedSince(since: Date): Promise<AutoSendStatus["dropped"]> {
  const rows = await prisma.sequenceDeparture.findMany({
    where: { status: "skipped", decidedAt: { gte: since }, detail: { not: "" } },
    orderBy: { decidedAt: "desc" },
    take: 5,
    select: {
      detail: true,
      enrollment: {
        select: {
          contact: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              instagram: true,
              company: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  return rows.map((row) => ({
    name: contactTitle(row.enrollment.contact),
    reason: row.detail,
  }));
}

/** Ce que le panneau affiche. Aucune écriture. */
export async function readAutoSendStatus(now = new Date()): Promise<AutoSendStatus> {
  const row = await readRow();
  const settings = settingsOf(row);
  const pending = await queue(now);
  const plan: AutoSendPlan = {
    enabled: row.enabled,
    dueAt: row.dueAt,
    remaining: pending.length,
    nextLabel: pending[0]?.label ?? "",
    lateSeconds: row.enabled ? lateBy(now, row.dueAt, settings) : 0,
    stoppedReason: row.stoppedReason,
  };
  return {
    settings,
    plan,
    sentence: describePlan(plan, settings, now),
    endAt:
      pending.length === 0 ? null : estimatedEnd(row.dueAt ?? now, pending.length, settings),
    lastTickAt: row.lastTickAt,
    dropped: await droppedSince(new Date(now.getTime() - 24 * 3600 * 1000)),
    capNotice: describeCappedBoxes(await readMailboxUsage(now)),
  };
}

export type SettingsOutcome =
  | { readonly ok: true; readonly status: AutoSendStatus }
  | { readonly ok: false; readonly message: string };

/**
 * Écrit les réglages.
 *
 * **Allumer efface la cause d'arrêt et remet le compteur d'échecs à zéro** :
 * c'est le geste par lequel quelqu'un dit « j'ai corrigé ». **Éteindre efface
 * l'échéance**, donc rien de déjà programmé ne part : le prochain tour ne
 * trouve plus de créneau à réclamer, et il n'y a aucun envoi en vol à
 * rattraper puisqu'un tour n'en fait qu'un.
 */
export async function writeAutoSend(
  input: AutoSendSettings,
  now = new Date(),
): Promise<SettingsOutcome> {
  const verdict = validateSettings(input);
  if (!verdict.ok) return { ok: false, message: verdict.message };

  const previous = await readRow();
  const turningOn = input.enabled && !previous.enabled;
  await prisma.autoSend.update({
    where: { id: ROW_ID },
    data: {
      ...verdict.settings,
      ...(input.enabled
        ? {
            dueAt: turningOn ? pushIntoWindow(now, verdict.settings) : previous.dueAt,
            ...(turningOn ? { failures: 0, stoppedReason: "" } : {}),
          }
        : { dueAt: null }),
    },
  });
  return { ok: true, status: await readAutoSendStatus(now) };
}

export { DEFAULT_AUTO_SEND };
