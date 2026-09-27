import "server-only";
import { prisma } from "../db";
import { isContactGroup } from "../domain/contact-group";
import { isWrittenVariant, type StepVariant } from "../domain/step-variants";
import { STEP_ONE_SEEDS } from "../domain/step-variant-seeds";

/**
 * **Les variantes d'étape, côté base.**
 *
 * Le choix du texte vit dans `lib/domain/step-variants.ts` — ce module ne fait
 * que lire et écrire. Une variante vide est **supprimée** plutôt qu'enregistrée
 * à blanc : « aucune variante » et « une variante vide » doivent se comporter
 * pareil, et deux états pour une même intention finissent par diverger (la
 * seconde ferait partir un message sans objet).
 */

export async function readStepVariants(stepId: string): Promise<StepVariant[]> {
  const rows = await prisma.emailStepVariant.findMany({ where: { stepId } });
  return rows
    .filter((row) => isContactGroup(row.group))
    .map((row) => ({
      group: row.group as StepVariant["group"],
      subject: row.subject,
      body: row.body,
    }));
}

/** Les variantes de plusieurs étapes, en une requête. */
export async function readVariantsByStep(
  stepIds: readonly string[],
): Promise<Map<string, StepVariant[]>> {
  if (stepIds.length === 0) return new Map();
  const rows = await prisma.emailStepVariant.findMany({
    where: { stepId: { in: [...stepIds] } },
  });
  const byStep = new Map<string, StepVariant[]>();
  for (const row of rows) {
    if (!isContactGroup(row.group)) continue;
    const list = byStep.get(row.stepId) ?? [];
    list.push({ group: row.group, subject: row.subject, body: row.body });
    byStep.set(row.stepId, list);
  }
  return byStep;
}

/**
 * Remplace les variantes d'une étape par celles qu'on lui donne.
 *
 * Écrite d'un bloc, comme les étapes elles-mêmes (jalon 38) : l'écran envoie
 * l'état complet, et une variante absente de l'envoi est une variante retirée.
 */
export async function writeStepVariants(
  stepId: string,
  variants: readonly StepVariant[],
): Promise<void> {
  const written = variants.filter(isWrittenVariant);
  const keep = written.map((variant) => variant.group);

  await prisma.$transaction(async (tx) => {
    await tx.emailStepVariant.deleteMany({
      where: { stepId, ...(keep.length > 0 ? { group: { notIn: keep } } : {}) },
    });
    for (const variant of written) {
      await tx.emailStepVariant.upsert({
        where: { stepId_group: { stepId, group: variant.group } },
        create: { stepId, group: variant.group, subject: variant.subject, body: variant.body },
        update: { subject: variant.subject, body: variant.body },
      });
    }
  });
}

/**
 * Pré-remplit les variantes d'une étape 1 qui n'en a aucune.
 *
 * **N'écrase jamais rien** : une seule variante déjà écrite suffit à laisser
 * l'étape intacte. Le pré-remplissage est un point de départ offert, pas une
 * remise à l'état d'usine.
 */
export async function seedStepOneVariants(stepId: string): Promise<number> {
  const existing = await prisma.emailStepVariant.count({ where: { stepId } });
  if (existing > 0) return 0;

  const seeds = Object.entries(STEP_ONE_SEEDS)
    .filter(([, seed]) => isWrittenVariant(seed))
    .map(([group, seed]) => ({ stepId, group, subject: seed.subject, body: seed.body }));

  await prisma.emailStepVariant.createMany({ data: seeds, skipDuplicates: true });
  return seeds.length;
}
