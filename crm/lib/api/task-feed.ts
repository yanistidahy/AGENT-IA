import "server-only";
import { prisma } from "../db";
import { contactTitle } from "../domain/contact-identity";
import { toTaskPriority } from "../domain/guards";
import { compareKeys, sortKey } from "../domain/sort-key";
import { toTaskKind } from "../domain/task-kind";
import { foldSearch, type TaskBanners, type TaskRow } from "../domain/task-tabs";
import { listDepartures } from "./departures";
import { readHotProspects } from "./hot-prospects";
import { CORRECTION_OWNER } from "./real-activity";

/**
 * **La file ne porte plus que des tâches ; le reste est un bandeau.**
 *
 * Jusqu'au jalon 104, ce module assemblait quatre origines — tâches, départs en
 * attente, réponses relevées, signaux d'intérêt — en lignes de même forme, pour
 * six onglets. Le mélange avait un coût que l'usage a révélé : trois natures
 * d'objet dans une même rangée demandent de se rappeler, onglet par onglet, ce
 * qu'on peut faire de ce qu'on y lit, et un écran dont chaque onglet appelle un
 * geste différent n'a plus d'ordre de lecture.
 *
 * Les trois autres origines ne disparaissent pas : elles deviennent **trois
 * compteurs**, rendus en une ligne chacun au-dessus de la file, et qui mènent là
 * où le travail se fait — la file des départs, les réponses, le vivier. Elles
 * sont lues par **les mêmes fonctions qu'avant** :
 *
 * | Compteur | Lu par | Mène vers |
 * |---|---|---|
 * | départs prêts à partir | `listDepartures()` — **la lecture de « Départs du jour »** | `/departs` |
 * | réponses à traiter | `replyHandled()`, ici | `/emails?etat=repondu` |
 * | prospects chauds | `readHotProspects()` — **la même liste que le filtre** | `/contacts?chauds=1` |
 *
 * **La file des départs n'est toujours pas recopiée** : `listDepartures()` porte
 * ses garde-fous et ses refus nommés (jalon 91). Deux lectures d'une même file
 * finiraient par ne plus dire la même chose, et c'est toujours la seconde qu'on
 * oublie de corriger (jalons 55, 64, 66, 74, 85).
 */

/** Les types d'interaction qui valent « on a donné suite ». */
const OUTGOING_TYPES = ["call", "email", "meeting", "demo", "linkedin", "instagram"] as const;

export interface TaskScreen {
  readonly rows: readonly TaskRow[];
  /** Les personnes à qui des tâches sont assignées, triées alphabétiquement. */
  readonly people: readonly string[];
  readonly banners: TaskBanners;
}

/**
 * Les lignes de l'écran : **des tâches, ouvertes et terminées**.
 *
 * Les terminées sont lues parce qu'un onglet les montre désormais, et bornées
 * aux soixante dernières : on vient y vérifier ce qu'on a fait, pas relire le
 * trimestre. Sans borne, une base d'un an ferait traverser des milliers de
 * lignes à chaque affichage pour en montrer vingt.
 */
async function taskRows(): Promise<TaskRow[]> {
  const [open, done] = await Promise.all([
    prisma.task.findMany({
      where: { done: false },
      orderBy: { due: "asc" },
      select: TASK_SELECT,
    }),
    prisma.task.findMany({
      where: { done: true },
      orderBy: [{ doneAt: "desc" }, { due: "desc" }],
      take: 60,
      select: TASK_SELECT,
    }),
  ]);

  return [...open, ...done].map((row) => {
    const contactName = row.contact === null ? "" : contactTitle(row.contact);
    const detail =
      contactName !== ""
        ? contactName
        : (row.company?.name ?? row.deal?.name ?? "Sans rattachement");
    return {
      id: row.id,
      title: row.title,
      kind: toTaskKind(row.kind),
      due: row.due,
      done: row.done,
      doneAt: row.doneAt,
      priority: toTaskPriority(row.priority),
      assignee: row.owner,
      contactId: row.contactId,
      contactName,
      // Le numéro **tel qu'il est saisi** : le normaliser en base rendrait
      // l'export infidèle à la source (règle du jalon 10). Seul le `href` du
      // bouton d'appel est composé, et il l'est à l'affichage.
      contactPhone: row.contact?.phone ?? "",
      detail,
      href: row.contactId === null ? null : `/contacts?fiche=${row.contactId}`,
      searchText: foldSearch(`${row.title} ${detail} ${row.owner}`),
    };
  });
}

const TASK_SELECT = {
  id: true,
  title: true,
  kind: true,
  due: true,
  priority: true,
  owner: true,
  done: true,
  doneAt: true,
  contactId: true,
  contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
  company: { select: { name: true } },
  deal: { select: { name: true } },
} as const;

/**
 * Une réponse **pas encore traitée**, et ce que « traitée » veut dire.
 *
 * Aucune colonne ne le dit, et ce jalon n'en ajoute pas : une réponse est
 * traitée quand **on a donné suite** — une interaction sortante consignée sur
 * cette fiche *après* la réponse, celle que le relevé écrit lui-même exceptée
 * (jalon 41), et les notes de correction exclues comme partout depuis le
 * jalon 27.
 *
 * C'est dérivé, donc jamais périmé : rappeler quelqu'un éteint le bandeau sans
 * qu'on ait à cocher quoi que ce soit.
 */
async function unhandledReplies(): Promise<number> {
  const replies = await prisma.emailReply.findMany({
    orderBy: { receivedAt: "desc" },
    take: 200,
    select: { id: true, receivedAt: true, contactId: true, activityId: true },
  });

  const withContact = replies.filter((row) => row.contactId !== null);
  if (withContact.length === 0) return 0;

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

  return withContact.reduce((total, row) => {
    const answered = follow.some(
      (activity) =>
        activity.contactId === row.contactId &&
        activity.id !== row.activityId &&
        activity.date > row.receivedAt,
    );
    return answered ? total : total + 1;
  }, 0);
}

/**
 * Tout l'écran, en une lecture.
 *
 * Les prédicats des onglets s'appliquent ensuite aux **tâches** de ce tableau,
 * pour les pastilles comme pour les listes, par un seul appel à `tabView()` :
 * c'est ce qui rend impossible qu'une pastille et sa liste divergent.
 */
export async function readTaskScreen(now = new Date()): Promise<TaskScreen> {
  const [rows, departures, replies, hot] = await Promise.all([
    taskRows(),
    listDepartures(now),
    unhandledReplies(),
    readHotProspects(now),
  ]);

  // Alphabétique par la clé pliée du jalon 72, jamais `localeCompare` : celui-ci
  // suit la locale du conteneur, donc l'ordre changerait d'un environnement à
  // l'autre.
  const people = [
    ...new Set(rows.map((row) => row.assignee).filter((owner) => owner !== "")),
  ].sort((a, b) => compareKeys(sortKey([a]), sortKey([b])));

  return {
    rows,
    people,
    banners: {
      // `pending` seulement : un départ `failed` est un brouillon qui n'a pas
      // été composé, il se répare, il ne s'envoie pas (jalon 96).
      pendingSends: departures.filter((departure) => departure.status === "pending").length,
      unhandledReplies: replies,
      hotProspects: hot.ids.length,
    },
  };
}
