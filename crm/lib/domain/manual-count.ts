/**
 * **Le compteur de messages manuels : son vocabulaire et ses bornes.**
 *
 * Pur, sans Prisma et sans React : les cinq canaux, ce que chacun écrit dans le
 * journal du jalon 109, et les trois refus qui bornent une saisie.
 *
 * ## Pourquoi ce compteur existe, et ce qu'il ne refait pas
 *
 * Trois chemins écrivent déjà des messages envoyés, et aucun ne couvre ce
 * cas-là :
 *
 * 1. **le journal des envois** (jalon 32) — les emails partis du CRM ;
 * 2. **la synchronisation lemlist** (jalon 111) — tout ce que lemlist envoie ;
 * 3. **`logActivity`** (jalon 4) — une interaction consignée sur une fiche, qui
 *    écrit déjà son événement `message_sent` par `eventForActivity`.
 *
 * Le troisième est le plus proche, et c'est pour cela qu'il faut dire ce qui
 * manque : il **exige une fiche** (sans rattachement il répond 400), il ne
 * connaît pas WhatsApp — `ACTIVITY_TYPES` n'a que `call`, `email`, `meeting`,
 * `demo`, `linkedin`, `instagram`, `note` —, il ne sait pas compter cinq
 * messages d'un geste, et il crée une tâche de prochaine action. Pour cocher
 * trois DM envoyés depuis un téléphone, c'est trop lourd et incomplet.
 *
 * **Le compteur n'écrit donc que dans le journal d'événements.** Il ne consigne
 * **pas** d'interaction sur la fiche : écrire les deux doublerait le message
 * (l'interaction produit déjà son événement), et c'est exactement le double
 * compte que le jalon 109 interdit. Conséquence à dire, et elle est réelle : un
 * message compté ici n'apparaît pas dans la chronologie de la fiche, et
 * n'avance pas sa date de dernière touche. Pour cela, « Consigner un appel »
 * reste le geste, et il compte déjà.
 *
 * ## `manualDone` de lemlist n'entre dans rien
 *
 * lemlist émet `manualDone` quand une tâche manuelle est achevée dans son
 * interface. Le jalon 111 l'a rangé dans `other`, donc hors de tout indicateur,
 * et `lib/domain/__tests__/lemlist.test.ts` vérifie la **conséquence** : la
 * ligne que la synchronisation écrirait, passée à `messagesSent`, rend un
 * tableau vide. Un même geste ne peut donc pas compter deux fois, une fois
 * cliqué ici et une fois importé de là.
 */

import type { OutreachChannel, OutreachType } from "./outreach";

/* ----------------------------------------------------------- les canaux ---- */

/**
 * Les cinq canaux du compteur, dans l'ordre d'usage réel : LinkedIn d'abord,
 * puis ce qui part du téléphone.
 *
 * Ce sont des **clés de saisie**, pas les canaux du journal : `instagram`
 * s'écrit sur le canal `other` parce que les six canaux du jalon 109 sont ceux
 * de lemlist, et en ajouter un septième que la synchronisation ne connaît pas
 * se paierait au prochain jalon. Le détail, lui, nomme le vrai canal.
 */
export const MANUAL_CHANNELS = [
  "linkedin_dm",
  "linkedin_invite",
  "whatsapp",
  "instagram_dm",
  "call",
] as const;
export type ManualChannel = (typeof MANUAL_CHANNELS)[number];

export function isManualChannel(value: string): value is ManualChannel {
  return (MANUAL_CHANNELS as readonly string[]).includes(value);
}

/** Ce qu'un canal de saisie écrit dans le journal. */
export interface ManualShape {
  /** Le libellé du bouton. Court : il doit tenir sur 390 px de large. */
  readonly label: string;
  readonly channel: OutreachChannel;
  readonly type: OutreachType;
  /** Recopié dans `detail`, pour relire la ligne six mois plus tard. */
  readonly detail: string;
}

/**
 * **La table, et la seule décision qu'elle porte.**
 *
 * `linkedin_invite` écrit `linkedin_invite_sent` et non `message_sent` : une
 * invitation n'est pas un message, et le jalon 109 leur a donné deux types
 * exprès — ils ont des taux d'acceptation qui n'ont rien à voir. Les quatre
 * autres écrivent `message_sent`, qui est la définition de « messages
 * envoyés » (`SENT_TYPES` les réunit tous les deux, donc l'invitation compte
 * aussi dans la pastille, comme pour lemlist).
 */
export const MANUAL_SHAPES: Readonly<Record<ManualChannel, ManualShape>> = {
  linkedin_dm: {
    label: "DM LinkedIn",
    channel: "linkedin_message",
    type: "message_sent",
    detail: "Message LinkedIn envoyé à la main",
  },
  linkedin_invite: {
    label: "Invitation LinkedIn",
    channel: "linkedin_invite",
    type: "linkedin_invite_sent",
    detail: "Invitation LinkedIn envoyée à la main",
  },
  whatsapp: {
    label: "WhatsApp",
    channel: "whatsapp",
    type: "message_sent",
    detail: "Message WhatsApp envoyé à la main",
  },
  instagram_dm: {
    label: "DM Instagram",
    channel: "other",
    type: "message_sent",
    detail: "DM Instagram envoyé à la main",
  },
  call: {
    label: "Appel",
    channel: "call",
    type: "message_sent",
    detail: "Appel passé, consigné au compteur",
  },
};

export function manualShape(channel: ManualChannel): ManualShape {
  return MANUAL_SHAPES[channel];
}

/* ------------------------------------------------------------ les bornes --- */

/**
 * Le plus gros lot acceptable d'un seul geste.
 *
 * Vingt : une session de prospection manuelle en produit quelques dizaines au
 * plus, et un nombre non borné transformerait une faute de frappe — « 500 » au
 * lieu de « 5 » — en cinq cents lignes à retrouver une par une. L'annulation
 * existe, mais une borne qui empêche la bêtise vaut mieux qu'un bouton qui la
 * répare.
 */
export const MAX_BATCH = 20;

/**
 * La profondeur de l'antidatage : sept jours.
 *
 * On consigne le soir ce qu'on a envoyé le matin, et parfois le lundi ce qu'on
 * a fait vendredi. Au-delà d'une semaine, la mémoire ne vaut plus le chiffre —
 * et surtout un message antidaté de trois semaines déplacerait un fait dans une
 * période déjà lue et commentée. **Jamais dans le futur** : compter un message
 * qui n'est pas parti est le seul mensonge que ce compteur pourrait produire.
 */
export const MAX_BACKDATE_DAYS = 7;

export type QuantityVerdict =
  | { readonly ok: true; readonly quantity: number }
  | { readonly ok: false; readonly message: string };

/**
 * Lit une quantité saisie à la main.
 *
 * Refuse plutôt que de corriger : un « 0 » ramené à 1 écrirait un message que
 * personne n'a demandé, et un « 50 » ramené à 20 en écrirait vingt sans le
 * dire. Les deux sont des décisions prises à la place de l'utilisateur.
 */
export function readQuantity(raw: unknown): QuantityVerdict {
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, message: "Indiquez un nombre entier de messages." };
  }
  if (value < 1) return { ok: false, message: "Il faut au moins un message." };
  if (value > MAX_BATCH) {
    return { ok: false, message: `Au plus ${MAX_BATCH} messages d'un seul geste.` };
  }
  return { ok: true, quantity: value };
}

export type DateVerdict =
  | { readonly ok: true; readonly at: Date }
  | { readonly ok: false; readonly message: string };

/**
 * Lit la date d'une saisie, bornée à la semaine écoulée.
 *
 * Une date absente vaut maintenant : c'est le cas courant — on compte juste
 * après avoir envoyé.
 */
export function readEntryDate(raw: unknown, now: Date): DateVerdict {
  if (raw === undefined || raw === null || raw === "") return { ok: true, at: now };

  const at = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(at.getTime())) return { ok: false, message: "Date illisible." };

  if (at.getTime() > now.getTime() + 60_000) {
    // Une minute de tolérance : l'horloge du téléphone n'est pas celle du
    // serveur, et refuser « maintenant » pour trente secondes d'avance serait
    // incompréhensible.
    return { ok: false, message: "On ne compte pas un message qui n'est pas encore parti." };
  }

  const floor = now.getTime() - MAX_BACKDATE_DAYS * 86_400_000;
  if (at.getTime() < floor) {
    return {
      ok: false,
      message: `Le compteur remonte à ${MAX_BACKDATE_DAYS} jours au plus. Au-delà, consignez une interaction sur la fiche.`,
    };
  }
  return { ok: true, at };
}

/* ------------------------------------------------------- l'identifiant ----- */

/**
 * **Un lot est annulable d'un geste parce que ses lignes partagent une clé.**
 *
 * Un « +5 » écrit cinq événements — le jalon le demande, et c'est juste : cinq
 * messages sont cinq faits. Mais « Annuler » doit les retirer **tous les
 * cinq**, sinon le geste d'annulation ne défait pas le geste de saisie.
 *
 * Plutôt qu'une colonne de regroupement, l'identifiant externe porte le lot :
 * `manual-count:<lot>:<rang>`. Le préfixe est donc une clé de lot, et un
 * `deleteMany` sur `startsWith` défait exactement une saisie. Aucune colonne
 * ajoutée, et la contrainte `(source, externalId)` continue de rendre un rejeu
 * inoffensif ligne à ligne.
 */
export const MANUAL_COUNT_PREFIX = "manual-count:";

export function entryPrefix(entryId: string): string {
  return `${MANUAL_COUNT_PREFIX}${entryId}:`;
}

export function manualCountKey(entryId: string, index: number): string {
  return `${entryPrefix(entryId)}${index}`;
}

/** Le lot auquel appartient un identifiant externe, ou `null`. */
export function entryIdOf(externalId: string | null): string | null {
  if (externalId === null || !externalId.startsWith(MANUAL_COUNT_PREFIX)) return null;
  const rest = externalId.slice(MANUAL_COUNT_PREFIX.length);
  const cut = rest.indexOf(":");
  if (cut <= 0) return null;
  return rest.slice(0, cut);
}

/* --------------------------------------------------------- l'agrégation ---- */

export interface ManualTally {
  readonly channel: ManualChannel;
  readonly label: string;
  readonly count: number;
}

/** Ce qu'une ligne du journal apporte au décompte du jour. */
export interface CountedRow {
  readonly channel: string;
  readonly type: string;
  readonly detail: string;
}

/**
 * Le décompte du jour, canal par canal, **dans l'ordre des boutons**.
 *
 * L'ordre vient de `MANUAL_CHANNELS` et non du nombre : une ligne qui se
 * réordonne à chaque clic se relit mal, et on veut pouvoir vérifier d'un coup
 * d'œil le canal sur lequel on vient de cliquer.
 *
 * Les canaux à zéro sont **conservés** : « 0 appel aujourd'hui » est une
 * information, et une ligne qui apparaît et disparaît fait sauter la mise en
 * page sous le bloc.
 */
export function tally(rows: readonly CountedRow[]): ManualTally[] {
  const counts = new Map<ManualChannel, number>();
  for (const channel of MANUAL_CHANNELS) counts.set(channel, 0);
  for (const row of rows) {
    const channel = channelOfRow(row);
    if (channel === null) continue;
    counts.set(channel, (counts.get(channel) ?? 0) + 1);
  }
  return MANUAL_CHANNELS.map((channel) => ({
    channel,
    label: MANUAL_SHAPES[channel].label,
    count: counts.get(channel) ?? 0,
  }));
}

/**
 * Retrouve le canal de saisie d'une ligne écrite par le compteur.
 *
 * Le couple `(channel, type)` suffit pour quatre des cinq ; `instagram_dm` et
 * les autres `other` se départagent sur `detail`, qui est la seule trace du
 * vrai canal — c'est le prix d'avoir refusé un septième canal au jalon 109, et
 * il est payé ici plutôt que dans le schéma.
 */
export function channelOfRow(row: CountedRow): ManualChannel | null {
  for (const channel of MANUAL_CHANNELS) {
    const shape = MANUAL_SHAPES[channel];
    if (row.channel !== shape.channel || row.type !== shape.type) continue;
    if (shape.channel === "other" && row.detail !== shape.detail) continue;
    return channel;
  }
  return null;
}

/**
 * Le total du jour, **dans le domaine et pas dans l'écran**.
 *
 * La garde statique du jalon 109 refuse une addition dans un fichier de
 * pilotage, et elle a raison : un total calculé dans la vue est une seconde
 * définition de « combien aujourd'hui », et c'est ainsi qu'une campagne et la
 * page des emails ont fini par afficher deux nombres sur les mêmes gens (jalon
 * 54). Le bloc affiche donc ce que cette fonction rend.
 */
export function tallyTotal(rows: readonly { readonly count: number }[]): number {
  let total = 0;
  for (const row of rows) total += row.count;
  return total;
}
