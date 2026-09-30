import "server-only";
import { prisma } from "../db";
import { composeDepartures } from "./departures";
import { renderManualStep } from "./manual-step";
import { readStepVariants } from "./step-variants";
import { threadTemplate } from "../domain/step-variants";
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
  const rewritten = await rewriteManualDepartures(sequenceId);
  if (rewritten === null) return { updated: 0, created: 0, kept: 0, blocked: null };

  /*
    **Ce qui manque est créé par la composition, pas par une boucle d'ici.**
    Décider soi-même qui est dû reviendrait à réécrire `nextStep`, et c'est la
    fonction qui porte les garde-fous : une seconde version en oublierait un, et
    ce serait celui de la fiche close ou de l'opposition au démarchage.
  */
  const composed = await composeDepartures(now, { sequenceId, manualOnly: true });

  return {
    updated: rewritten.updated,
    created: composed.composed,
    kept: rewritten.kept,
    // Le week-end et la pause de campagne empêchent la **création**, jamais la
    // mise à jour : réécrire un texte n'est pas l'envoyer.
    blocked:
      composed.skipped ??
      (rewritten.active
        ? null
        : "La campagne est en pause : aucun nouveau départ n'a été composé."),
  };
}

/**
 * La seule moitié qui réécrit : aucun départ créé, aucun appel au modèle.
 *
 * Séparée de la création parce que les deux appelants n'en veulent pas autant.
 * L'enregistrement d'une séquence veut les deux ; un réglage global veut la
 * réécriture seule, sinon enregistrer un libellé écrirait un premier message à
 * qui se trouve dû ce matin. `null` quand la séquence n'existe pas.
 */
async function rewriteManualDepartures(sequenceId: string): Promise<{
  readonly updated: number;
  readonly kept: number;
  readonly active: boolean;
} | null> {
  const sequence = await prisma.emailSequence.findUnique({
    where: { id: sequenceId },
    select: {
      active: true,
      steps: { select: { id: true, position: true, mode: true, subject: true, body: true } },
      campaign: { select: { mailboxId: true, otherRouting: true } },
    },
  });
  if (sequence === null) return null;

  const manual = sequence.steps.filter((step) => toStepMode(step.mode) === "manual");
  if (manual.length === 0) {
    // Une séquence entièrement rédigée par Alex n'a rien à resynchroniser : ses
    // départs gardent le marqueur « composé avant votre dernière modification »
    // (jalon 96), et leur réécriture reste un geste explicite et facturé.
    return { updated: 0, kept: 0, active: sequence.active };
  }

  let updated = 0;
  let kept = 0;

  for (const step of manual) {
    const variants = await readStepVariants(step.id);
    /*
      **Le gabarit du fil, empreinte comprise.** L'objet vient de l'étape 1 :
      sans cela, changer l'objet du premier message ne rendrait pas périmés les
      départs d'étape 2, qui partiraient avec l'ancien objet, hors du fil, sans
      que rien ne le dise.
    */
    const thread = threadTemplate(sequence.steps, step.position, variants);
    const fingerprint = templateFingerprint({
      mode: "manual",
      subject: thread.step.subject,
      body: thread.step.body,
      variants: thread.variants.map((variant) => ({ ...variant })),
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
        thread.step,
        sequence.campaign?.mailboxId,
        thread.variants,
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

  return { updated, kept, active: sequence.active };
}

/**
 * **La même réécriture, pour tout le CRM, sans rien créer.**
 *
 * Un réglage global qui change la forme des mails (le libellé de la vidéo, son
 * mode d'affichage) ne concerne pas une campagne mais toutes : la portée est
 * donc le CRM entier. Ce qu'elle ne fait pas, en revanche, c'est appeler
 * `composeDepartures` : enregistrer un réglage ne doit pas écrire un premier
 * message à quelqu'un qui se trouve seulement être dû ce matin. La création
 * reste le geste explicite d'« Écrire les mails ».
 *
 * Une retouche à la main est conservée et comptée, comme à l'enregistrement
 * d'une séquence : c'est `editedAt` qui tranche, jamais une ressemblance de
 * texte.
 */
export async function resyncAllManualDepartures(): Promise<{
  readonly updated: number;
  readonly kept: number;
}> {
  const sequences = await prisma.emailSequence.findMany({
    where: { steps: { some: { mode: "manual" } } },
    select: { id: true },
  });

  let updated = 0;
  let kept = 0;
  for (const sequence of sequences) {
    const report = await rewriteManualDepartures(sequence.id);
    if (report === null) continue;
    updated += report.updated;
    kept += report.kept;
  }
  return { updated, kept };
}
