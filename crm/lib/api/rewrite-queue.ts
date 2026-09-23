import "server-only";
import { prisma } from "../db";
import { composeForCampaign, planComposition } from "./compose-now";

/**
 * **Réécrire toute la file, avec les consignes d'aujourd'hui.**
 *
 * Un brouillon en attente a été écrit avec le mail de référence, les notes
 * d'angle, la recherche et la signature tels qu'ils étaient ce matin-là.
 * Quand l'un des quatre change, la file entière devient périmée sans que rien
 * ne le dise : les messages restent lisibles, simplement ils ne portent plus le
 * discours courant. « Écrire les mails » le fait déjà pour **une** campagne
 * (jalon 70, `rewritePending`) ; ici c'est la file, toutes campagnes
 * confondues, depuis l'écran où on la relit.
 *
 * **Rien n'est envoyé**, et c'est la même discipline que partout : la
 * composition remplit la file, la validation part d'un clic.
 */

export interface RewritePlan {
  /** Combien de brouillons seraient réécrits. */
  readonly drafts: number;
  /** Parmi eux, ceux qu'on a retouchés à la main et qui seront remplacés. */
  readonly edited: number;
  readonly micros: number;
  readonly campaigns: number;
  /** Ce qui empêche, le cas échéant : week-end, file vide. */
  readonly blocked: string | null;
}

/**
 * Les campagnes qui ont des départs en attente.
 *
 * La file mélange les campagnes ; la composition, elle, est bornée à une
 * campagne parce que la boîte d'envoi et la signature en dépendent. On énumère
 * donc, et chaque campagne repart avec son propre journal — donc sa propre
 * barre et son propre bouton d'arrêt.
 */
async function campaignsWithPending(): Promise<string[]> {
  const rows = await prisma.sequenceDeparture.findMany({
    where: { status: { in: ["pending", "failed"] } },
    select: { enrollment: { select: { sequence: { select: { campaignId: true } } } } },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    const id = row.enrollment.sequence.campaignId;
    if (id !== null) ids.add(id);
  }
  return [...ids];
}

/** Ce que la réécriture ferait, **sans rien appeler ni rien écrire**. */
export async function planRewriteQueue(now = new Date()): Promise<RewritePlan> {
  const ids = await campaignsWithPending();
  if (ids.length === 0) {
    return { drafts: 0, edited: 0, micros: 0, campaigns: 0, blocked: "La file est vide." };
  }

  let drafts = 0;
  let edited = 0;
  let micros = 0;
  let blocked: string | null = null;

  for (const id of ids) {
    const plan = await planComposition(id, now);
    // Le premier empêchement rencontré vaut pour tout le monde : le week-end
    // est le seul qui soit global, et c'est celui qu'on veut dire.
    if (plan.blocked !== null && blocked === null) blocked = plan.blocked;
    drafts += plan.rewritten;
    edited += plan.edited;
    micros += plan.estimate.micros;
  }

  return { drafts, edited, micros, campaigns: ids.length, blocked: drafts === 0 ? blocked : null };
}

export interface RewriteOutcome {
  readonly campaigns: number;
  readonly blocked: string | null;
}

/**
 * Lance la réécriture, campagne par campagne, en arrière-plan.
 *
 * Chacune ouvre son journal : l'écran montre donc une barre par campagne, et
 * chacune peut être arrêtée séparément. Les attendre ici ferait tenir la
 * requête pendant des minutes pour un travail qui se regarde très bien depuis
 * la file.
 */
export async function rewriteQueue(now = new Date()): Promise<RewriteOutcome> {
  const ids = await campaignsWithPending();
  if (ids.length === 0) return { campaigns: 0, blocked: "La file est vide." };

  for (const id of ids) {
    await composeForCampaign(id, now, "background");
  }
  return { campaigns: ids.length, blocked: null };
}
