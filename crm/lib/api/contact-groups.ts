import "server-only";
import { prisma } from "../db";
import {
  CONTACT_GROUPS,
  type ContactGroup,
  classifyTitle,
  isContactGroup,
  isGroupSource,
} from "../domain/contact-group";

/**
 * **Le groupe de fonction, côté base : recalculer, compter, ne jamais écraser.**
 *
 * Tout le jugement vit dans `lib/domain/contact-group.ts` — ce module ne fait
 * que lire des fiches et écrire deux colonnes. Une garde statique impose que
 * l'import, ce recalcul et la fiche appellent **le même** classificateur :
 * trois classements légèrement différents mettraient la même personne dans
 * trois groupes selon la porte d'entrée.
 */

/* ------------------------------------------------------ les compteurs ----- */

export interface GroupCounts {
  /** Le compte par groupe, corrections manuelles comprises. */
  readonly byGroup: Readonly<Record<ContactGroup, number>>;
  /** Les fiches que **personne n'a encore classées** — jamais des « Autre ». */
  readonly unclassified: number;
  readonly total: number;
}

export function emptyCounts(): GroupCounts {
  return { byGroup: { direction: 0, marketing: 0, commercial: 0, autre: 0 }, unclassified: 0, total: 0 };
}

/**
 * Les compteurs sur un ensemble de fiches déjà lues.
 *
 * Pur exprès : l'écran de campagne compte ses inscrits, `/contacts` compte son
 * portefeuille, et les deux doivent additionner de la même façon — deux
 * additions justes chacune de son côté finissent par se contredire (jalon 55).
 */
export function countGroups(
  rows: ReadonlyArray<{ readonly contactGroup: string; readonly groupSetBy: string }>,
): GroupCounts {
  const byGroup: Record<ContactGroup, number> = {
    direction: 0,
    marketing: 0,
    commercial: 0,
    autre: 0,
  };
  let unclassified = 0;

  for (const row of rows) {
    if (row.groupSetBy === "none") {
      unclassified += 1;
      continue;
    }
    const group = isContactGroup(row.contactGroup) ? row.contactGroup : "autre";
    byGroup[group] += 1;
  }

  return { byGroup, unclassified, total: rows.length };
}

/** Les compteurs de tout le portefeuille. */
export async function readGroupCounts(): Promise<GroupCounts> {
  const rows = await prisma.contact.findMany({ select: { contactGroup: true, groupSetBy: true } });
  return countGroups(rows);
}

/** Combien de fiches, parmi ces identifiants, n'ont jamais été classées. */
export async function countUnclassified(contactIds: readonly string[]): Promise<number> {
  if (contactIds.length === 0) return 0;
  return prisma.contact.count({ where: { id: { in: [...contactIds] } , groupSetBy: "none" } });
}

/* ------------------------------------------------------- le recalcul ----- */

export interface RecomputeReport {
  /** Fiches dont le groupe a changé. */
  readonly reclassified: number;
  /** Corrections manuelles laissées intactes. */
  readonly manualKept: number;
  /** Fiches déjà dans le bon groupe automatique. */
  readonly unchanged: number;
  /** Les intitulés rangés par l'ordre de départage, à relire. */
  readonly ambiguous: readonly string[];
}

export function describeRecompute(report: RecomputeReport): string {
  return `${report.reclassified} contacts reclassés, ${report.manualKept} corrections manuelles conservées`;
}

/**
 * Recalcule les groupes **automatiques**, et eux seuls.
 *
 * Une fiche `manual` n'est jamais touchée : c'est un choix humain, et un
 * recalcul qui l'écraserait rendrait la correction inutile — on la referait,
 * puis elle disparaîtrait encore. Une fiche `none` est classée pour la première
 * fois, ce qui compte comme un reclassement : c'est précisément le travail que
 * le bouton existe pour faire.
 */
export async function recomputeContactGroups(): Promise<RecomputeReport> {
  const rows = await prisma.contact.findMany({
    select: { id: true, title: true, contactGroup: true, groupSetBy: true },
  });

  let reclassified = 0;
  let manualKept = 0;
  let unchanged = 0;
  const ambiguous = new Set<string>();

  for (const row of rows) {
    if (row.groupSetBy === "manual") {
      manualKept += 1;
      continue;
    }

    const verdict = classifyTitle(row.title);
    if (verdict.ambiguous) ambiguous.add(row.title.trim());

    if (row.groupSetBy === "auto" && row.contactGroup === verdict.group) {
      unchanged += 1;
      continue;
    }

    await prisma.contact.update({
      where: { id: row.id },
      data: { contactGroup: verdict.group, groupSetBy: "auto" },
    });
    reclassified += 1;
  }

  return { reclassified, manualKept, unchanged, ambiguous: [...ambiguous] };
}

/* ------------------------------------- la correction faite à la main ----- */

/**
 * Pose le groupe d'une fiche à la main. `groupSetBy` passe à `manual`, ce qui la
 * met hors de portée du recalcul.
 */
export async function setContactGroup(contactId: string, group: string): Promise<void> {
  if (!isContactGroup(group)) throw new Error(`Groupe inconnu : ${group}`);
  await prisma.contact.update({
    where: { id: contactId },
    data: { contactGroup: group, groupSetBy: "manual" },
  });
}

/**
 * Rend la fiche au recalcul : le groupe est recalculé tout de suite, et la
 * prochaine passe pourra le corriger. Sans ce geste, une correction à la main
 * serait définitive, même quand la fonction a changé depuis.
 */
export async function clearManualGroup(contactId: string): Promise<ContactGroup> {
  const row = await prisma.contact.findUnique({ where: { id: contactId }, select: { title: true } });
  const group = classifyTitle(row?.title ?? "").group;
  await prisma.contact.update({
    where: { id: contactId },
    data: { contactGroup: group, groupSetBy: "auto" },
  });
  return group;
}

/** Garde de frontière : une valeur venue de la base ou d'une requête. */
export function toGroupSource(value: string): "none" | "auto" | "manual" {
  return isGroupSource(value) ? value : "none";
}

/** Le vocabulaire, pour les écrans qui rendent une liste de choix. */
export const GROUP_CHOICES = CONTACT_GROUPS;
