import "server-only";
import { prisma } from "../db";
import { composeDepartures } from "./departures";
import { renderManualStep } from "./manual-step";
import { readStepVariants } from "./step-variants";
import { templateFingerprint, type ResyncReport } from "../domain/departure-content";
import { toStepMode } from "../domain/merge-tags";

/**
 * **Enregistrer une séquence remet sa file à jour.**
 *
 * Le jalon 70 avait débranché la composition de l'enregistrement, et la raison
 * tenait : un enregistrement ne doit ni facturer ni écraser un brouillon qu'on
 * relit. Mais elle ne vaut que pour une étape **rédigée par Alex**, dont chaque
 * brouillon est un appel au modèle. Une étape **écrite à la main** ne coûte
 * rien, et laisser la file porter le texte d'avant l'enregistrement n'est alors
 * pas une précaution : c'est un écran qui montre autre chose que ce qui partira,
 * et c'est exactement ce que le jalon 96 a passé sa journée à rendre visible.
 *
 * Trois gestes, dans cet ordre, et l'ordre est le sujet :
 *
 * 1. **réécrire** les départs en attente d'une étape manuelle, y compris ceux
 *    qui n'ont **aucune empreinte** (composés avant le jalon 96) — ce sont
 *    justement les plus vieux, donc les plus sûrement périmés ;
 * 2. **conserver** ceux qu'on a retouchés à la main. `editedAt` est posé par
 *    `saveDeparture`, donc par le geste lui-même : deviner une retouche en
 *    comparant le texte au gabarit confondrait « corrigé par quelqu'un » avec
 *    « composé depuis une autre version », qui est précisément l'autre cas ;
 * 3. **créer** ce qui manque, par `composeDepartures` avec la portée
 *    `manualOnly` — donc avec tous les garde-fous de la composition (fiche
 *    close, opposition, réponse reçue, délai, week-end) et sans réécrire un
 *    seul appel au modèle.
 *
 * **Rien n'est envoyé**, et rien ne touche un départ déjà parti : la file se
 * valide toujours à la main, ou par l'ordonnanceur (jalon 93).
 */
export async function resyncManualDepartures(
  sequenceId: string,
  now = new Date(),
): Promise<ResyncReport> {
  const sequence = await prisma.emailSequence.findUnique({
    where: { id: sequenceId },
    select: {
      active: true,
      steps: { select: { id: true, position: true, mode: true, subject: true, body: true } },
      campaign: { select: { mailboxId: true, otherRouting: true } },
    },
  });
  if (sequence === null) return { updated: 0, created: 0, kept: 0, blocked: null };

  const manual = sequence.steps.filter((step) => toStepMode(step.mode) === "manual");
  if (manual.length === 0) {
    // Une séquence entièrement rédigée par Alex n'a rien à resynchroniser : ses
    // départs gardent le marqueur « composé avant votre dernière modification »
    // (jalon 96), et leur réécriture reste un geste explicite et facturé.
    return { updated: 0, created: 0, kept: 0, blocked: null };
  }

  let updated = 0;
  let kept = 0;

  for (const step of manual) {
    const variants = await readStepVariants(step.id);
    const fingerprint = templateFingerprint({
      mode: "manual",
      subject: step.subject,
      body: step.body,
      variants: variants.map((variant) => ({ ...variant })),
    });

    const pending = await prisma.sequenceDeparture.findMany({
      // `pending` seulement : un départ envoyé est un fait, un départ écarté est
      // une décision, et aucun des deux ne se réécrit.
      where: {
        status: "pending",
        step: step.position,
        enrollment: { sequenceId },
      },
      select: { id: true, editedAt: true, enrollment: { select: { contactId: true } } },
    });

    for (const departure of pending) {
      if (departure.editedAt !== null) {
        kept += 1;
        continue;
      }

      const written = await renderManualStep(
        departure.enrollment.contactId,
        { subject: step.subject, body: step.body },
        sequence.campaign?.mailboxId,
        variants,
        sequence.campaign?.otherRouting ?? "default",
      );
      // La fiche a disparu entre la lecture et le rendu : rare, et rien à
      // inventer.
      if (written === null) continue;

      await prisma.sequenceDeparture.update({
        where: { id: departure.id },
        data: {
          subject: written.subject,
          body: written.body,
          templateHash: fingerprint,
          // La cause d'un refus précédent ne décrit plus ce texte-ci.
          detail: "",
        },
      });
      updated += 1;
    }
  }

  /*
    **Ce qui manque est créé par la composition, pas par une boucle d'ici.**
    Décider soi-même qui est dû reviendrait à réécrire `nextStep`, et c'est la
    fonction qui porte les garde-fous : une seconde version en oublierait un, et
    ce serait celui de la fiche close ou de l'opposition au démarchage.
  */
  const composed = await composeDepartures(now, { sequenceId, manualOnly: true });

  return {
    updated,
    created: composed.composed,
    kept,
    // Le week-end et la pause de campagne empêchent la **création**, jamais la
    // mise à jour : réécrire un texte n'est pas l'envoyer.
    blocked:
      composed.skipped ??
      (sequence.active ? null : "La campagne est en pause : aucun nouveau départ n'a été composé."),
  };
}
