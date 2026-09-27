/**
 * **L'envoi automatique : quand le prochain départ peut partir, et pourquoi.**
 *
 * Module pur — la fenêtre, la gigue, le retard et l'autodésactivation se
 * testent sans base, sans serveur SMTP et sans attendre dix minutes. L'horloge
 * est injectée, et le hasard aussi : une cadence qui varie ne doit pas rendre
 * ses propres tests indéterministes.
 *
 * **Ce jalon n'ajoute pas un second mécanisme d'envoi.** Il ajoute un
 * *ordonnanceur* devant celui qui existe depuis le jalon 38 : c'est toujours
 * `sendDeparture` qui envoie, avec ses refus nommés (jalon 91). Ce fichier ne
 * décide que d'une chose — **l'instant**.
 */

/**
 * **Qui décide d'un envoi.** Trois valeurs, parce que deux ne suffisaient plus.
 *
 * - `"human"` — un clic sur la carte. La règle du week-end ne s'applique pas :
 *   la personne lit l'ancienneté de la dernière interaction, son clic *est* la
 *   décision (jalon 91).
 * - `"compose"` — l'envoi enchaîné à la composition du matin, derrière le
 *   double verrou par séquence du jalon 38.
 * - `"scheduler"` — la boucle de ce jalon. La règle du week-end s'applique,
 *   **mais pas le double verrou** : celui-ci protège d'un envoi que personne
 *   n'a demandé, alors qu'ici quelqu'un a armé l'interrupteur après avoir relu
 *   sa file. L'exiger rendrait la fonctionnalité morte-née sur toute campagne
 *   manuelle, qui n'atteindra jamais ses vingt départs validés.
 */
export type SendMode = "human" | "compose" | "scheduler";

/** Le fuseau du produit. Les deux personnes qui l'utilisent travaillent à Paris. */
export const AUTO_TIMEZONE = "Europe/Paris";

/** Un envoi par minute au plus : en dessous, ce n'est plus une cadence, c'est une rafale. */
export const MIN_INTERVAL_SECONDS = 60;

/** La gigue, en part de l'intervalle. ±30 % : assez pour ne pas être régulier. */
export const JITTER_RATIO = 0.3;

/**
 * Trois échecs d'affilée coupent l'envoi automatique.
 *
 * Un mot de passe absent ou un serveur qui refuse ne se corrige pas tout seul :
 * continuer à essayer toutes les trois minutes produirait des centaines de
 * tentatives refusées, et surtout **un écran qui prétend travailler**. Trois
 * plutôt qu'un, parce qu'une coupure réseau d'une seconde n'est pas une panne.
 */
export const MAX_FAILURES = 3;

export interface AutoSendSettings {
  readonly enabled: boolean;
  readonly intervalSeconds: number;
  /** Fenêtre d'envoi, en minutes depuis minuit, heure de Paris. */
  readonly startMinute: number;
  readonly endMinute: number;
  readonly vary: boolean;
}

export const DEFAULT_AUTO_SEND: AutoSendSettings = {
  enabled: false,
  intervalSeconds: 210,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
  vary: true,
};

/* ------------------------------------------------------- l'heure de Paris */

interface Wall {
  /** 0 = dimanche, 6 = samedi — comme `Date.getDay()`, mais à Paris. */
  readonly weekday: number;
  readonly minute: number;
}

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: AUTO_TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * L'heure murale à Paris, lue par `Intl` plutôt que calculée.
 *
 * **Le serveur tourne en UTC** (Railway) : `getDay()` et `getHours()` y
 * décrivent une autre journée que celle de l'utilisateur, et un décalage
 * saisonnier codé en dur serait faux la moitié de l'année. `Intl` porte la base
 * de fuseaux ; personne n'a à se souvenir du dernier dimanche de mars.
 */
export function parisWall(date: Date): Wall {
  const parts = PARTS.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number.parseInt(value("hour"), 10) % 24;
  return {
    weekday: Math.max(0, WEEKDAYS.indexOf(value("weekday"))),
    minute: hour * 60 + Number.parseInt(value("minute"), 10),
  };
}

export function isParisWeekend(date: Date): boolean {
  const day = parisWall(date).weekday;
  return day === 0 || day === 6;
}

/** Dans la fenêtre : jour ouvré **et** heure comprise, à Paris. */
export function insideWindow(date: Date, settings: AutoSendSettings): boolean {
  const wall = parisWall(date);
  if (wall.weekday === 0 || wall.weekday === 6) return false;
  return wall.minute >= settings.startMinute && wall.minute < settings.endMinute;
}

/* --------------------------------------------------------------- les créneaux */

/** L'écart jusqu'au prochain envoi, en secondes, gigue comprise. */
export function jitteredGap(settings: AutoSendSettings, random: number): number {
  if (!settings.vary) return settings.intervalSeconds;
  const swing = settings.intervalSeconds * JITTER_RATIO;
  const gap = Math.round(settings.intervalSeconds - swing + random * 2 * swing);
  // Le plancher reste le plancher : une gigue ne doit pas passer sous la minute.
  return Math.max(MIN_INTERVAL_SECONDS, gap);
}

const DAY = 86_400_000;

/**
 * Le prochain instant où un envoi est permis, à partir de `candidate`.
 *
 * **Avancer jusqu'à l'ouverture, jamais reculer** : un créneau tombé à 18 h 10
 * devient 9 h 00 le prochain jour ouvré, et un créneau tombé à 7 h 00 devient
 * 9 h 00 le jour même. Rendre le créneau tel quel ferait partir la file entière
 * à la réouverture — c'est-à-dire exactement la rafale que l'espacement existe
 * pour éviter.
 */
export function pushIntoWindow(candidate: Date, settings: AutoSendSettings): Date {
  let cursor = new Date(candidate.getTime());
  for (let guard = 0; guard < 14; guard += 1) {
    const wall = parisWall(cursor);
    const open = wall.weekday !== 0 && wall.weekday !== 6;

    if (open && wall.minute < settings.startMinute) {
      return new Date(cursor.getTime() + (settings.startMinute - wall.minute) * 60_000);
    }
    if (open && wall.minute < settings.endMinute) return cursor;

    // Fermé : on se place au lendemain, à l'ouverture, et on reteste — le
    // lendemain peut être un samedi, et le surlendemain un dimanche.
    const wallAfter = parisWall(new Date(cursor.getTime() + DAY));
    cursor = new Date(
      cursor.getTime() + DAY + (settings.startMinute - wallAfter.minute) * 60_000,
    );
  }
  return cursor;
}

/** Le créneau suivant : l'écart, puis la fenêtre. */
export function nextSlot(from: Date, settings: AutoSendSettings, random: number): Date {
  return pushIntoWindow(new Date(from.getTime() + jitteredGap(settings, random) * 1000), settings);
}

/* ------------------------------------------------------------------ retard */

/**
 * L'ordonnanceur est-il en retard ?
 *
 * Au-delà de **deux fois l'intervalle**, ce n'est plus de la gigue : le
 * processus dort, a été redéployé, ou la boucle est morte. Le dire plutôt que
 * d'afficher une heure de prochain envoi déjà dépassée — un écran qui annonce
 * 10 h 42 à 11 h 15 est un écran qui ment.
 */
export function lateBy(now: Date, dueAt: Date | null, settings: AutoSendSettings): number {
  if (dueAt === null) return 0;
  const late = Math.floor((now.getTime() - dueAt.getTime()) / 1000);
  return late > settings.intervalSeconds * 2 ? late : 0;
}

/* ------------------------------------------------------------------ phrases */

const HOUR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: AUTO_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_NAME = new Intl.DateTimeFormat("fr-FR", { timeZone: AUTO_TIMEZONE, weekday: "long" });

export function parisHour(date: Date): string {
  return HOUR.format(date).replace(":", " h ");
}

export function parisDayName(date: Date): string {
  return DAY_NAME.format(date);
}

export interface AutoSendPlan {
  readonly enabled: boolean;
  readonly dueAt: Date | null;
  readonly remaining: number;
  /** Le destinataire du prochain envoi, déjà nommé par la couche de service. */
  readonly nextLabel: string;
  readonly lateSeconds: number;
  readonly stoppedReason: string;
}

/**
 * Ce que le panneau dit, en une phrase.
 *
 * Quatre situations, et elles n'appellent pas le même geste : arrêté par le
 * produit (il faut corriger la cause), éteint, en retard (l'ordonnanceur ne
 * tourne pas), hors fenêtre (il n'y a rien à faire qu'attendre).
 */
export function describePlan(
  plan: AutoSendPlan,
  settings: AutoSendSettings,
  now: Date,
): string {
  if (plan.stoppedReason !== "") return `Envoi automatique arrêté : ${plan.stoppedReason}`;
  if (!plan.enabled) return "Envoi automatique éteint : les départs attendent votre clic.";
  if (plan.remaining === 0) return "Envoi automatique actif : aucun départ en attente.";

  if (plan.lateSeconds > 0) {
    const minutes = Math.round(plan.lateSeconds / 60);
    return `Envoi automatique en retard de ${minutes} min : l'ordonnanceur n'a pas tourné depuis ${
      plan.dueAt === null ? "un moment" : parisHour(plan.dueAt)
    }. ${plan.remaining} départ${plan.remaining > 1 ? "s" : ""} en attente.`;
  }

  if (!insideWindow(now, settings)) {
    const resume = plan.dueAt ?? pushIntoWindow(now, settings);
    return `Envoi automatique en veille : hors de la fenêtre ${windowLabel(settings)}. Reprendra ${parisDayName(resume)} à ${parisHour(resume)}, ${plan.remaining} départ${plan.remaining > 1 ? "s" : ""} en attente.`;
  }

  const end = estimatedEnd(plan.dueAt ?? now, plan.remaining, settings);
  return `Envoi automatique actif : prochain mail vers ${parisHour(plan.dueAt ?? now)}${
    plan.nextLabel === "" ? "" : ` à ${plan.nextLabel}`
  }, ${plan.remaining} restant${plan.remaining > 1 ? "s" : ""}, fin estimée vers ${parisHour(end)}.`;
}

export function windowLabel(settings: AutoSendSettings): string {
  const fmt = (minute: number) =>
    `${Math.floor(minute / 60)} h${minute % 60 === 0 ? "" : ` ${String(minute % 60).padStart(2, "0")}`}`;
  return `${fmt(settings.startMinute)} – ${fmt(settings.endMinute)}`;
}

/**
 * La fin estimée : l'intervalle **nominal**, sans gigue.
 *
 * La gigue est symétrique, donc sa moyenne est l'intervalle : l'ajouter à une
 * estimation ne la rendrait pas plus juste, seulement moins lisible. Les
 * fermetures de fenêtre, elles, comptent — une file de deux cents départs
 * finit demain, et le dire est tout l'intérêt du chiffre.
 */
export function estimatedEnd(from: Date, remaining: number, settings: AutoSendSettings): Date {
  let cursor = pushIntoWindow(from, settings);
  for (let index = 1; index < Math.max(1, remaining); index += 1) {
    cursor = pushIntoWindow(new Date(cursor.getTime() + settings.intervalSeconds * 1000), settings);
  }
  return cursor;
}

/* --------------------------------------------------------------- validation */

export type SettingsVerdict =
  | { readonly ok: true; readonly settings: AutoSendSettings }
  | { readonly ok: false; readonly message: string };

/**
 * Les réglages proposés tiennent-ils debout ?
 *
 * Refusé plutôt que corrigé en silence : un intervalle ramené de 10 s à 60 s
 * sans le dire ferait croire à une cadence qu'on n'a pas.
 */
export function validateSettings(input: AutoSendSettings): SettingsVerdict {
  if (input.intervalSeconds < MIN_INTERVAL_SECONDS) {
    return { ok: false, message: "L'intervalle ne peut pas descendre sous une minute." };
  }
  if (input.startMinute < 0 || input.endMinute > 24 * 60) {
    return { ok: false, message: "La fenêtre d'envoi doit tenir dans la journée." };
  }
  if (input.endMinute - input.startMinute < 1) {
    return { ok: false, message: "La fin de la fenêtre doit suivre son début." };
  }
  return { ok: true, settings: input };
}
