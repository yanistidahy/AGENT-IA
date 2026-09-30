import "server-only";
import { describeEcho, echoOf } from "../domain/follow-up-echo";
import { storedTarget } from "../domain/research-target";
import type { SendMode } from "../domain/auto-send";
import {
  describeUngrounded,
  isStaleAt,
  researchCard,
  ungroundedClaims,
  type ResearchCard,
  type ResearchGap,
} from "../domain/research";
import { prisma } from "../db";
import { draftEmail } from "../agents/email-draft";
import { openingLine } from "./account";
import { sendEmailToContact } from "./email-send";
import { checkRate } from "./send-rate";
import { readMailboxUsage, readUsageFor } from "./mailbox-cap";
import { capReached, capRefusal, remainingOf, sortByPriority } from "../domain/mailbox-cap";
import { REAL_ACTIVITY } from "./real-activity";
import { ANSWERED_OUTCOMES } from "../domain/status";
import { toLifecycle } from "../domain/guards";
import { daysSince } from "../domain/dates";
import {
  autoUnlock,
  BLOCK_LABELS,
  canSendAutomatically,
  isWeekend,
  nextStep,
  isTransientBlock,
  stopsEnrollment,
} from "../domain/sequence-rules";
import { replyAnchor } from "../domain/campaign-reset";
import {
  droppedSentences,
  subjectFallbacks,
  toStepMode,
  type DroppedSentence,
} from "../domain/merge-tags";
import {
  firstVariantsOf,
  routedGroup,
  templateFor,
  toOtherRouting,
  threadSubjectFor,
  threadTemplate,
} from "../domain/step-variants";
import { isContactGroup, type ContactGroup } from "../domain/contact-group";
import { signatureVideo } from "./mail";
import { mergeValuesOf, renderManualStep, templateGlobals } from "./manual-step";
import { readStepVariants } from "./step-variants";
import { contactTitle, repairGreeting } from "../domain/contact-identity";
import { demoTarget, describeDemoSource } from "../domain/demo-target";
import { isDemoContact } from "../domain/demo-data";
import { listSignatories, pickSignatory, signatureBlocks } from "./signatories";
import {
  emptyDepartureReason,
  emptyDepartureRefusal,
  isStaleDeparture,
  templateFingerprint,
} from "../domain/departure-content";
import { sanitizeSubject } from "../domain/email-format";

/**
 * « Départs du jour » : la file du matin, et ce qu'on en fait.
 *
 * **Composée le matin même, jamais la veille.** C'est la contrainte qui donne
 * sa valeur à la détection manuelle des réponses : un brouillon écrit vendredi
 * soir et envoyé lundi matin décrit l'état de vendredi, et la réponse arrivée
 * samedi ne l'aurait pas arrêté. La file du lundi se construit lundi, à partir
 * de l'état de lundi.
 *
 * **Ni composition ni départ le week-end.** Un message de prospection reçu le
 * dimanche se lit comme de l'automatisation, et personne ne relève sa boîte
 * professionnelle pour y répondre. Surtout, composer le samedi ferait entrer
 * deux jours d'aveuglement entre la décision et le clic.
 */

/**
 * Le gabarit d'une étape, mis à la forme de l'empreinte.
 *
 * **Une étape rédigée par Alex n'a pas d'objet ni de corps, elle a une
 * consigne** : c'est elle qui décide du texte, donc c'est elle que l'empreinte
 * doit lire. La prendre pour `body` évite une seconde forme d'empreinte, et
 * `mode` distingue de toute façon les deux familles.
 */
function templateShapeOf(
  step: {
    readonly mode: string;
    readonly brief: string;
    readonly subject: string;
    readonly body: string;
  },
  variants: readonly { readonly group: string; readonly subject: string; readonly body: string }[],
) {
  const manual = toStepMode(step.mode) === "manual";
  return {
    mode: manual ? "manual" : "alex",
    subject: manual ? step.subject : "",
    body: manual ? step.body : step.brief,
    variants: variants.map((variant) => ({ ...variant })),
  };
}

/**
 * L'empreinte d'une étape, **objet du fil compris**.
 *
 * Sans elle, changer l'objet de l'étape 1 ne rendrait pas périmés les départs
 * d'étape 2 : leur empreinte ne lirait que leur propre étape, qui n'a pas bougé.
 * Ils partiraient donc avec l'ancien objet, hors du fil, sans que rien ne le
 * dise. L'empreinte lit ce qui décide réellement du texte.
 */
function threadShapeOf(
  steps: readonly {
    readonly position: number;
    readonly mode: string;
    readonly brief: string;
    readonly subject: string;
    readonly body: string;
    readonly variants?: readonly {
      readonly group: string;
      readonly subject: string;
      readonly body: string;
    }[];
  }[],
  position: number,
  variants: readonly { readonly group: string; readonly subject: string; readonly body: string }[],
) {
  const step = steps.find((entry) => entry.position === position);
  if (step === undefined) return templateShapeOf({ mode: "alex", brief: "", subject: "", body: "" }, []);
  const thread = threadTemplate(
    steps,
    position,
    variants.filter((variant): variant is typeof variant & { group: ContactGroup } =>
      isContactGroup(variant.group),
    ),
    // L'objet du fil se décide groupe par groupe sur l'étape 1 : l'empreinte
    // doit donc bouger quand une variante d'étape 1 change d'objet.
    firstVariantsOf(steps),
  );
  return templateShapeOf({ ...step, subject: thread.step.subject }, thread.variants);
}

function dayKey(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Une réponse consignée depuis que la séquence court.
 *
 * **Le seul mécanisme d'arrêt tant que la détection est manuelle.** On prend la
 * date de l'interaction, pas seulement son existence.
 *
 * Le point de départ est le dernier envoi **ou, à défaut, l'inscription**, et
 * ce détail a été trouvé à la vérification, pas à la lecture. En prenant `null`
 * comme point de départ, toute réponse jamais consignée arrêtait la séquence
 * avant son premier message : un contact avec qui on a parlé il y a un an
 * devenait inéligible à vie, c'est-à-dire la moitié d'un CRM. Ce n'est pas ce
 * qu'« arrêter sur réponse » veut dire, c'est « ne pas relancer quelqu'un qui
 * vient de répondre ».
 */
async function repliedAfter(contactId: string, since: Date | null): Promise<Date | null> {
  const answer = await prisma.activity.findFirst({
    where: {
      ...REAL_ACTIVITY,
      contactId,
      outcome: { in: [...ANSWERED_OUTCOMES] }, ...(since === null ? {} : { date: { gt: since } }),
    },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return answer?.date ?? null;
}

export interface ComposeReport {
  readonly skipped: string | null;
  readonly composed: number;
  readonly sentAutomatically: number;
  readonly stopped: number;
  readonly waiting: number;
  /** Interrompue à la demande. Ce qui était composé reste en file. */
  readonly stoppedByUser?: boolean;
  /**
   * Brouillons d'Alex laissés pour demain, la boîte ayant atteint son plafond.
   *
   * Un appel au modèle est facturé : en écrire soixante pour une boîte qui n'en
   * enverra que cinquante, c'est acheter dix textes qui seront périmés demain
   * matin (jalon 96). Les étapes écrites à la main ne sont pas bornées, elles ne
   * coûtent rien.
   */
  readonly laterForCap: number;
}

/**
 * Construit la file du jour.
 *
 * Appelée par le passage quotidien. Idempotente par construction : un départ
 * porte une clé unique `(inscription, étape)`, donc rejouer le passage ne peut
 * pas produire deux messages pour la même étape, c'est une contrainte de base,
 * pas une vérification applicative (leçon du jalon 8).
 */
/**
 * L'accroche d'un départ **déjà composé ce matin** pour un collègue.
 *
 * Toutes séquences confondues : deux campagnes différentes qui écrivent le même
 * matin à deux personnes de la même maison posent exactement le même problème
 * qu'une seule. Le plus récent composé fait foi, c'est lui que le destinataire
 * comparera.
 */
async function pendingColleagueOpening(
  contactId: string,
  day: string,
): Promise<{ readonly name: string; readonly opening: string } | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { companyId: true },
  });
  if (contact?.companyId == null) return null;

  const pending = await prisma.sequenceDeparture.findFirst({
    where: {
      day,
      status: "pending",
      enrollment: {
        contactId: { not: contactId },
        contact: { companyId: contact.companyId },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      body: true,
      enrollment: { select: { contact: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (pending === null || pending.body.trim() === "") return null;

  const opening = openingLine(pending.body);
  if (opening === "") return null;

  // `contactTitle`, jamais une recomposition : la garde du jalon 50 veille, et
  // elle vient de le prouver en attrapant la première version de cette ligne.
  const name = contactTitle({ ...pending.enrollment.contact, company: null });
  return { name, opening: opening.slice(0, 300) };
}

/**
 * La portée d'une composition : tout le CRM, ou une seule séquence.
 *
 * **Une portée, pas une seconde fonction.** Le passage quotidien compose sans
 * portée ; l'enregistrement d'une campagne compose la sienne. Écrire deux
 * boucles ferait deux jeux de garde-fous, et le second oublierait un jour la
 * fiche close ou l'opposition au démarchage, c'est exactement le défaut que le
 * jalon 55 a payé sur l'entonnoir, et la leçon est la même : une seule addition,
 * une seule décision.
 */
export interface ComposeScope {
  readonly sequenceId?: string;
  /**
   * Réécrire les brouillons **en attente** au lieu de les laisser tels quels.
   *
   * Le passage quotidien ne le fait jamais : rejouer le matin doit être sans
   * effet, et remplacer un brouillon qu'on est peut-être en train de relire
   * serait le contraire. Mais « Écrire les mails » est un geste délibéré, et il
   * a une raison précise d'exister : si l'on vient de changer une note d'angle,
   * le mail de référence ou le signataire, on veut que les brouillons non
   * envoyés soient reconstruits avec les nouvelles consignes. Ce qui est
   * **déjà parti** n'est jamais touché.
   */
  readonly rewritePending?: boolean;
  /**
   * Le journal de cette composition, quand elle en a un.
   *
   * **C'est par lui que passe l'arrêt** : la demande arrive sur une autre
   * requête, donc elle ne peut pas être un drapeau en mémoire. La boucle relit
   * la ligne avant chaque brouillon : une lecture par appel au modèle, c'est-à-
   * dire une lecture toutes les huit secondes.
   */
  readonly jobId?: string;
  /**
   * **Ne composer que les étapes écrites à la main.**
   *
   * C'est ce qui permet à un enregistrement de séquence de resynchroniser sa
   * file sans rien facturer : une étape manuelle est une substitution de trois
   * balises, une étape rédigée par Alex est un appel au modèle par contact, et
   * un enregistrement n'a jamais à dépenser (jalon 70).
   *
   * Une portée plutôt qu'une seconde boucle, pour la raison du jalon 56 : deux
   * boucles feraient deux jeux de garde-fous, et le second oublierait un jour la
   * fiche passée en « Perdu » depuis l'inscription.
   */
  readonly manualOnly?: boolean;
}

/** Quelqu'un a-t-il demandé l'arrêt de cette composition ? */
async function stopRequested(jobId: string | undefined): Promise<boolean> {
  if (jobId === undefined) return false;
  const job = await prisma.compositionJob.findUnique({
    where: { id: jobId },
    select: { stopRequestedAt: true },
  });
  return job?.stopRequestedAt != null;
}

/**
 * Le message déjà envoyé à cette personne pour cette séquence.
 *
 * **Lu dans `email_sends`, jamais reconstruit** : c'est le texte exact qui est
 * parti, et c'est lui qu'Alex doit éviter de refaire. Le plus récent, parce que
 * c'est celui dont le destinataire se souvient.
 */
async function previousMessage(
  contactId: string,
  sequenceId: string,
): Promise<{ sentOn: string; body: string } | null> {
  const sent = await prisma.emailSend.findFirst({
    where: { contactId, sequenceId },
    orderBy: { sentAt: "desc" },
    select: { body: true, sentAt: true },
  });
  if (sent === null || sent.body.trim() === "") return null;
  return {
    sentOn: sent.sentAt.toLocaleDateString("fr-FR"),
    body: sent.body,
  };
}

export async function composeDepartures(
  now = new Date(),
  scope: ComposeScope = {},
): Promise<ComposeReport> {
  const empty = { composed: 0, sentAutomatically: 0, stopped: 0, waiting: 0, laterForCap: 0 };

  if (isWeekend(now)) {
    return { ...empty, skipped: "Samedi ou dimanche : aucune composition, aucun départ." };
  }

  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: {
      status: "active",
      sequence: { active: true }, ...(scope.sequenceId === undefined ? {} : { sequenceId: scope.sequenceId }),
    },
    include: {
      sequence: {
        include: {
          // `variants` voyage avec l'étape : c'est l'étape 1 qui porte
          // l'objet du fil, groupe par groupe (jalon 103).
          steps: { orderBy: { position: "asc" }, include: { variants: true } },
          // La boîte de la campagne : chaque message de la séquence part de la
          // même adresse, avec la même signature (jalon 54).
          campaign: { select: { mailboxId: true, otherRouting: true } },
        },
      },
      contact: { select: { id: true, lifecycle: true, lostReason: true, email: true } },
    },
  });

  let composed = 0;
  let sentAutomatically = 0;
  let stopped = 0;
  let waiting = 0;
  let laterForCap = 0;
  let stoppedByUser = false;

  /*
    **La capacité restante de chaque boîte, décomptée au fil de la boucle.**

    Le budget est ce que le plafond laisse pour aujourd'hui, lu une fois dans le
    journal des envois. Les brouillons **déjà en file** n'en sont pas retranchés,
    et c'est un choix : ils peuvent partir, être retirés ou reportés d'ici ce
    soir, et la composition refuse de toute façon de réécrire un départ existant.
    Le budget borne donc ce que **ce passage** écrit, pas la file entière.

    `null` vaut « pas de plafond » : le compilateur force à traiter le cas, là
    où un `Infinity` traverserait silencieusement une soustraction.
  */
  const budget = new Map<string, number | null>(
    (await readMailboxUsage(now)).map((entry) => [entry.mailboxId, remainingOf(entry)]),
  );

  for (const enrollment of enrollments) {
    /*
      **L'ancre des réponses suit le chapitre courant.** Après une
      réinitialisation (jalon 86), c'est elle qui fait foi : sans ce
      déplacement, quelqu'un qu'on a délibérément choisi d'inclure malgré sa
      réponse ne produirait **aucun** brouillon : la composition retrouverait
      la réponse d'avant et arrêterait l'inscription, pendant que l'écran
      vient de lui promettre un message.
    */
    const replied = await repliedAfter(
      enrollment.contactId,
      replyAnchor(enrollment.lastSentAt, enrollment.resetAt, enrollment.enrolledAt),
    );

    const verdict = nextStep(
      {
        lifecycle: toLifecycle(enrollment.contact.lifecycle),
        lostReason: enrollment.contact.lostReason,
        email: enrollment.contact.email,
      },
      { repliedAt: replied, lastSentAt: enrollment.lastSentAt, lastStep: enrollment.lastStep },
      enrollment.sequence.steps,
      now,
    );

    if (!verdict.ok) {
      if (stopsEnrollment(verdict.reason)) {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: verdict.reason === "finished" ? "done" : "stopped",
            // Le libellé est écrit **en clair** : c'est ce qu'on lira dans six
            // mois, et c'est aussi ce que compte le verrou du mode automatique
            // pour « cette séquence a-t-elle déjà fait répondre quelqu'un ».
            stopReason: BLOCK_LABELS[verdict.reason],
          },
        });
        stopped += 1;
      } else {
        waiting += 1;
      }
      continue;
    }

    // Déjà composé ce matin, le passage a été rejoué.
    const existing = await prisma.sequenceDeparture.findUnique({
      where: {
        enrollmentId_step_round: {
          enrollmentId: enrollment.id,
          step: verdict.step,
          round: enrollment.round,
        },
      },
    });
    if (existing !== null) {
      // Un départ qui n'est plus en attente est décidé : envoyé, reporté,
      // retiré. On n'y revient pas, quel que soit le mode.
      if (!scope.rewritePending || existing.status !== "pending") continue;
      await prisma.sequenceDeparture.delete({ where: { id: existing.id } });
    }

    const step = enrollment.sequence.steps.find((entry) => entry.position === verdict.step);

    /*
      **L'arrêt est relu juste avant d'écrire le brouillon suivant.** Il est
      commun aux deux modes : une étape manuelle ne coûte rien, mais quelqu'un
      qui arrête une composition veut qu'elle s'arrête. Ce qui est déjà en file
      y reste : c'est du travail fait, et relu.
    */
    if (await stopRequested(scope.jobId)) {
      stoppedByUser = true;
      break;
    }

    /*
      **Une étape écrite à la main ne passe pas par Alex** (jalon 87) : le texte
      existe déjà, la composition se réduit à remplacer trois balises. Aucun
      appel au modèle, donc rien à facturer et rien à attendre.

      Ce qui suit est **commun aux deux modes**, et c'est le point : le départ
      produit ici est un départ ordinaire. Il entre dans la même file, se relit
      de la même façon, et l'envoi lui applique les mêmes garde-fous. Une étape
      manuelle saute Alex pour l'écriture, jamais pour la sécurité.
    */
    const isManual = toStepMode(step?.mode ?? "") === "manual";
    /*
      **La portée « manuelle seule » saute l'étape d'Alex, elle ne la refuse
      pas** : l'inscription reste active et dûe, et le passage quotidien ou
      « Écrire les mails » l'écrira. Ce qui est évité, c'est de facturer un appel
      depuis un geste qui n'en demande pas.
    */
    if (scope.manualOnly === true && !isManual) {
      waiting += 1;
      continue;
    }

    let written: { readonly subject: string; readonly body: string } | null = null;

    // Les variantes par groupe de fonction : le choix se fait dans
    // `renderManualStep`, avec le groupe lu sur la fiche, et un groupe sans
    // variante reçoit le message par défaut de l'étape. Elles sont lues ici
    // parce que l'empreinte du gabarit les porte aussi.
    const variants =
      step !== undefined && toStepMode(step.mode) === "manual"
        ? await readStepVariants(step.id)
        : [];
    const fingerprint =
      step === undefined
        ? ""
        : templateFingerprint(threadShapeOf(enrollment.sequence.steps, verdict.step, variants));

    if (isManual) {
      // **L'objet vient du fil, pas de l'étape.** Une relance qui change
      // d'objet ouvre une seconde conversation chez le destinataire : c'est
      // `threadTemplate` qui tranche, pour les trois chemins d'écriture.
      const thread = threadTemplate(
        enrollment.sequence.steps,
        verdict.step,
        variants,
        firstVariantsOf(enrollment.sequence.steps),
      );
      written = await renderManualStep(
        enrollment.contactId,
        thread.step,
        enrollment.sequence.campaign?.mailboxId,
        thread.variants,
        // Le routage d'« Autre » et des fiches non classées, lu sur la
        // campagne. Absent (campagne d'avant ce réglage) = `default`, donc le
        // message par défaut de l'étape, donc le contenu d'avant à l'octet près.
        enrollment.sequence.campaign?.otherRouting ?? "default",
      );
      // La fiche a disparu entre la lecture de la file et la composition :
      // rare, et rien à inventer.
      if (written === null) continue;
    } else {
      /*
        **On ne paie pas un brouillon qui ne peut pas partir aujourd'hui.**

        Seules les étapes rédigées par Alex sont bornées : une étape écrite à la
        main est une substitution de trois balises, gratuite, et la file la
        porte sans dommage. L'inscription reste active et dûe : rien n'est
        perdu, elle sera écrite au prochain passage, avec les consignes de ce
        jour-là plutôt qu'avec celles d'aujourd'hui.
      */
      const capBox = enrollment.sequence.campaign?.mailboxId ?? "";
      const left = capBox === "" ? undefined : budget.get(capBox);
      if (left !== undefined && left !== null) {
        if (left <= 0) {
          laterForCap += 1;
          waiting += 1;
          continue;
        }
        budget.set(capBox, left - 1);
      }

      // **L'accroche du collègue composée ce matin même.** La règle du jalon 53
      // lit les envois, mais dans cette boucle, deux collègues d'une même maison
      // sont composés avant que quiconque soit envoyé : le second ne verrait
      // rien, et les deux brouillons partiraient avec la même entrée en matière.
      // On relit donc les départs déjà composés aujourd'hui pour la même maison,
      // et la phrase à ne pas reprendre entre dans la consigne de l'étape.
      const colleagueOpening = await pendingColleagueOpening(enrollment.contactId, dayKey(now));
      const brief =
        colleagueOpening === null
          ? step?.brief
          : `${step?.brief ?? ""}\n\nUn collègue de la même maison (${colleagueOpening.name}) a un message composé ce matin dont la phrase d'ouverture est : « ${colleagueOpening.opening} ». N'écris ni cette phrase, ni une reformulation de cette phrase, trouve une autre entrée en matière, ancrée sur le rôle de ton destinataire.`;

      // Le message déjà parti à cette personne pour cette séquence : c'est ce
      // qu'Alex ne doit pas refaire (jalon 84).
      const previous =
        verdict.step <= 1
          ? null
          : await previousMessage(enrollment.contactId, enrollment.sequenceId);

      const draft = await draftEmail(
        enrollment.contactId,
        undefined,
        brief,
        enrollment.sequence.campaign?.mailboxId,
        { step: verdict.step, previous },
      );
      if (!draft.ok) {
        await prisma.sequenceDeparture.create({
          data: {
            enrollmentId: enrollment.id,
            step: verdict.step,
            round: enrollment.round,
            day: dayKey(now),
            status: "failed",
            detail: draft.message,
          },
        });
        continue;
      }
      written = draft.draft;
    }

    const departure = await prisma.sequenceDeparture.create({
      data: {
        enrollmentId: enrollment.id,
        step: verdict.step,
        round: enrollment.round,
        day: dayKey(now),
        subject: written.subject,
        body: written.body,
        // De quel gabarit ce texte vient : c'est ce qui permet de dire plus
        // tard « composé avant votre dernière modification de la séquence »
        // plutôt que d'afficher un avertissement calculé sur un autre texte.
        templateHash: fingerprint,
      },
      select: { id: true },
    });
    composed += 1;

    // **Le mode automatique ne couvre jamais la première étape**, et il est
    // revérifié ici plutôt que cru sur parole : l'interrupteur exprime une
    // intention, les conditions expriment un fait, et un fait peut cesser
    // d'être vrai après qu'on a coché la case.
    const unlock = await unlockOf(enrollment.sequenceId);
    if (canSendAutomatically(verdict.step, enrollment.sequence.autoMode, unlock)) {
      const outcome = await sendDeparture(departure.id, "compose", now);
      if (outcome.ok) sentAutomatically += 1;
    }
  }

  return { skipped: null, composed, sentAutomatically, stopped, waiting, laterForCap, stoppedByUser };
}

/**
 * Combien de brouillons la composition écrirait, **sans rien appeler ni rien
 * écrire**.
 *
 * C'est ce qui permet d'annoncer le coût avant de le dépenser. La décision est
 * prise par `nextStep`, la même fonction que la boucle réelle : un compte fondé
 * sur une autre règle annoncerait un prix pour un travail qui n'aurait pas lieu.
 *
 * Elle ne **stoppe** aucune inscription, contrairement à la boucle : une
 * consultation qui écrit n'est plus une consultation (jalon 8). Les
 * inéligibles sont donc comptés, pas rangés, la boucle les rangera.
 */
export interface ComposableCount {
  readonly eligible: number;
  readonly fresh: number;
  readonly rewritten: number;
  readonly edited: number;
  /**
   * Sociétés à lire : celles des contacts composables qui n'ont pas de
   * recherche fraîche.
   *
   * **Comptées une fois par société, pas par contact.** C'est ce qui rend
   * l'estimation honnête sur une campagne où plusieurs personnes travaillent
   * dans la même maison.
   */
  readonly researches: number;
  /**
   * Parmi les éligibles, ceux qu'une étape **écrite à la main** produira.
   *
   * Gratuits et instantanés : ils sont retirés de l'estimation, jamais du
   * compte de ce qui sera écrit.
   */
  readonly manual: number;
  readonly weekend: boolean;
}

export async function countComposable(
  scope: ComposeScope,
  now = new Date(),
): Promise<ComposableCount> {
  if (isWeekend(now)) {
    return { eligible: 0, fresh: 0, rewritten: 0, edited: 0, manual: 0, researches: 0, weekend: true };
  }

  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: {
      status: "active",
      sequence: { active: true }, ...(scope.sequenceId === undefined ? {} : { sequenceId: scope.sequenceId }),
    },
    include: {
      sequence: {
        include: { steps: { orderBy: { position: "asc" }, include: { variants: true } } },
      },
      contact: {
        select: {
          id: true,
          lifecycle: true,
          lostReason: true,
          email: true,
          companyId: true,
          company: { select: { research: { select: { fetchedAt: true, gap: true } } } },
        },
      },
    },
  });

  let eligible = 0;
  /** Jamais écrits : des contacts qui n'ont encore rien reçu de cette campagne. */
  let fresh = 0;
  /** Brouillons en attente qui seront reconstruits. */
  let rewritten = 0;
  /** Parmi eux, ceux retouchés à la main : c'est ce qu'il faut annoncer. */
  let edited = 0;
  /** Les sociétés à lire, dédoublonnées : une maison compte pour une. */
  const toResearch = new Set<string>();
  /**
   * Parmi les éligibles, ceux qui relèvent d'une étape **écrite à la main**.
   *
   * Ils sont composés par substitution : **ils ne coûtent rien**, et les
   * compter dans l'estimation ferait annoncer un prix pour un travail qui n'a
   * pas lieu. Ils comptent en revanche dans ce qui sera écrit : l'écran dit les
   * deux.
   */
  let manual = 0;

  for (const enrollment of enrollments) {
    // Même ancre que la composition : le plan doit annoncer ce que l'écriture
    // fera, pas autre chose (jalons 82 et 86).
    const replied = await repliedAfter(
      enrollment.contactId,
      replyAnchor(enrollment.lastSentAt, enrollment.resetAt, enrollment.enrolledAt),
    );

    const verdict = nextStep(
      {
        lifecycle: toLifecycle(enrollment.contact.lifecycle),
        lostReason: enrollment.contact.lostReason,
        email: enrollment.contact.email,
      },
      { repliedAt: replied, lastSentAt: enrollment.lastSentAt, lastStep: enrollment.lastStep },
      enrollment.sequence.steps,
      now,
    );
    if (!verdict.ok) continue;

    // Déjà en file : le passage quotidien n'y revient pas, recomposer
    // coûterait un appel pour remplacer un brouillon que l'on est peut-être en
    // train de relire. « Écrire les mails » (`rewritePending`) le fait au
    // contraire exprès, et compte alors ces brouillons.
    const existing = await prisma.sequenceDeparture.findUnique({
      where: {
        enrollmentId_step_round: {
          enrollmentId: enrollment.id,
          step: verdict.step,
          round: enrollment.round,
        },
      },
      select: { id: true, status: true, editedAt: true },
    });

    const composable = existing === null || (scope.rewritePending && existing.status === "pending");
    const step = enrollment.sequence.steps.find((entry) => entry.position === verdict.step);
    const isManual = toStepMode(step?.mode ?? "") === "manual";
    if (composable && isManual) manual += 1;

    // **Une étape manuelle ne lit aucun site** : elle ne cite que ce que la
    // fiche porte déjà, et la recherche n'a rien à lui apprendre. La compter
    // ici ferait payer une lecture que la composition ne demandera pas.
    if (composable && !isManual) {
      const companyId = enrollment.contact.companyId;
      const stored = enrollment.contact.company?.research ?? null;
      // Une recherche fraîche ne se repaie pas : c'est la moitié du cache. Une
      // recherche **échouée**, en revanche, se retente : sinon une coupure d'une
      // minute gèlerait la maison sur le repli générique.
      const read = stored?.fetchedAt ?? null;
      const gap = stored === null || stored.gap === "" ? null : (stored.gap as ResearchGap);
      if (companyId !== null && (read === null || isStaleAt(read, now, gap))) {
        toResearch.add(companyId);
      }
    }

    if (existing === null) {
      eligible += 1;
      fresh += 1;
      continue;
    }
    if (scope.rewritePending && existing.status === "pending") {
      eligible += 1;
      rewritten += 1;
      if (existing.editedAt !== null) edited += 1;
    }
  }

  return { eligible, fresh, rewritten, edited, manual, researches: toResearch.size, weekend: false };
}

async function unlockOf(sequenceId: string) {
  const [validated, replies] = await Promise.all([
    prisma.sequenceDeparture.count({
      where: { status: "sent", auto: false, enrollment: { sequenceId } },
    }),
    prisma.sequenceEnrollment.count({
      where: { sequenceId, status: "stopped", stopReason: { contains: "répondu" } },
    }),
  ]);
  return autoUnlock(validated, replies);
}

export interface DepartureView {
  readonly id: string;
  readonly step: number;
  readonly status: string;
  readonly subject: string;
  readonly body: string;
  readonly detail: string;
  readonly sequenceName: string;
  readonly contactId: string;
  readonly contactName: string;
  readonly to: string;
  /**
   * Jours écoulés depuis la dernière interaction consignée, `null` s'il n'y en
   * a aucune.
   *
   * **C'est le garde-fou de la détection manuelle**, affiché sur chaque ligne :
   * « il y a 2 j » invite à ouvrir sa boîte avant de cliquer. Sans lui, la file
   * du lundi ressemble à celle du mardi, alors que deux jours de réponses
   * possibles la séparent de la dernière vérification.
   */
  readonly lastActivityDays: number | null;
  readonly lastActivityAt: Date | null;
  /**
   * Ce qu'Alex avait sous la main pour nommer la boutique, en clair.
   *
   * **Sans cette ligne, « sur votre boutique » est indiscernable de deux
   * choses** : une fiche qui ne porte réellement ni site ni société, et un
   * modèle qui n'a pas utilisé ce qu'on lui a donné. Ce sont deux défauts
   * opposés, l'un se corrige dans la fiche et l'autre dans le prompt, et il a
   * fallu une question pour les départager. La file le dit désormais d'elle
   * meme, brouillon par brouillon.
   */
  readonly demoSource: string;
  /**
   * Cette fiche **est** une fiche de démonstration (jeu de seed, domaine
   * réservé aux essais).
   *
   * Distinct de `demoSource`, qui ne dit que ce qu'Alex avait pour nommer la
   * boutique : les confondre faisait afficher « Données de démonstration » sur
   * de vraies personnes, et faisait douter de toute la file.
   */
  readonly demoData: boolean;
  /**
   * Ce qu'Alex a lu sur la maison de ce contact, et ce qu'il en a retenu.
   *
   * **Lu à l'affichage, jamais copié sur le départ** : la recherche appartient
   * à la société, et la recopier ligne à ligne ferait trois versions d'une même
   * lecture pour trois collègues, qui divergeraient dès la première relecture
   * du site.
   */
  readonly research: ResearchCard;
  /**
   * Une affirmation produit qu'aucune page lue ne soutient.
   *
   * **Recalculée à la lecture**, comme la virgule de l'appel : c'est ce qui
   * fait qu'une retouche à la main est vérifiée elle aussi, et non seulement ce
   * qu'Alex avait écrit.
   */
  readonly ungrounded: string | null;
  /** La relance répète le message précédent. Vide quand elle ne le fait pas. */
  readonly echo: string;
  /**
   * Les phrases que le rendu a retirées pour ce contact, avec leur raison.
   *
   * Vide pour une étape rédigée par Alex : il n'y a pas de gabarit, donc rien
   * qui puisse disparaître sans qu'on l'ait écrit.
   */
  readonly dropped: readonly DroppedSentence[];
  /**
   * Pourquoi ce départ est vide, ou une chaîne vide quand il a de quoi partir.
   *
   * **Calculé par la fonction que l'envoi appelle** : la carte annonce donc le
   * refus que « Envoyer » rendrait, jamais une seconde appréciation.
   */
  readonly empty: string;
  /**
   * Le gabarit a changé depuis la composition de ce départ.
   *
   * Vide quand il est à jour, ou quand on ne sait pas (départ composé avant
   * l'empreinte : « on ne sait pas » n'est jamais « périmé »).
   */
  readonly stale: boolean;
  /**
   * Ce brouillon a été retouché à la main avec « Modifier ».
   *
   * **Un fait enregistré par le geste lui-même** (`editedAt`, posé par
   * `saveDeparture`), jamais deviné en comparant le texte au gabarit : une
   * comparaison confondrait « corrigé par quelqu'un » avec « composé depuis une
   * autre version du gabarit », qui est précisément l'autre cas, et c'est celui
   * que `stale` décrit.
   *
   * C'est ce qui fait qu'un enregistrement de séquence ne l'écrase pas : la
   * resynchronisation le conserve et la carte propose de le remplacer.
   */
  readonly edited: boolean;
  /**
   * La boite d'ou ce depart partira, vide pour un depart anterieur au jalon 54.
   * C'est elle que le plafond quotidien regarde.
   */
  /**
   * Les replis que l'objet a employés pour ce contact, dits en clair.
   *
   * Recalculés à la lecture depuis le **gabarit**, comme la phrase retirée et la
   * garde d'écho : l'objet stocké ne porte plus la balise, et c'est bien le
   * problème : sans cette ligne, « votre marque » part à quelqu'un dont on
   * connaît la société sans que personne s'aperçoive que la fiche est incomplète.
   */
  readonly subjectFallbacks: readonly string[];
  readonly mailboxId: string;
  /**
   * La boite a atteint son plafond du jour : ce depart **est reporte**, il
   * n'est ni perdu ni refuse. La carte le dit avec `CARRIED_LABEL`, et le mot
   * compte : « echec » ferait chercher une panne la ou il n'y a qu'une file.
   */
  readonly carried: boolean;
  /** La maison du contact, affichée sous son nom. Vide quand il n'en a pas. */
  readonly companyName: string;
  readonly campaignName: string;
  /** Combien d'étapes porte la séquence : « étape 2 sur 3 » plutôt que « 2 ». */
  readonly stepsTotal: number;
  /** Sa campagne est en pause : rien ne sera composé ni envoyé pour elle. */
  readonly campaignPaused: boolean;
  /** Quand le brouillon a été composé : l'écran Tâches date ses lignes avec. */
  readonly createdAt: Date;
}

/**
 * Les champs d'une recherche que la carte demande.
 *
 * **Un seul `select`, deux lectures.** La file et le départ rouvert doivent
 * montrer exactement la même carte ; deux listes de champs finiraient par
 * diverger, et c'est la seconde qu'on oublie de compléter.
 */
const RESEARCH_SELECT = {
  select: {
    gap: true,
    summary: true,
    corpus: true,
    fetchedAt: true,
    targetHost: true,
    targetSource: true,
    facts: true,
    sources: true,
  },
} as const;

/**
 * La recherche d'une société, mise à la forme de la carte.
 *
 * **La décision appartient au domaine, pas à ce fichier.** La version
 * précédente jugeait ici qu'une recherche était exploitable sur son seul
 * `gap`, sans regarder les faits : la file pouvait annoncer « Alex a lu »
 * au-dessus d'un brouillon qui n'avait rien lu. `researchCard` tranche, et le
 * tiroir de contact en dit exactement la même chose.
 */
function cardFor(
  row: {
    readonly gap: string;
    readonly summary: string;
    readonly fetchedAt: Date;
    readonly targetHost: string;
    readonly targetSource: string;
    readonly facts: readonly { label: string; detail: string; sourceUrl: string }[];
    readonly sources: readonly { url: string; title: string }[];
  } | null,
): ResearchCard {
  if (row === null) return researchCard(null);
  return researchCard({
    gap: row.gap === "" ? null : (row.gap as NonNullable<ResearchGap>),
    summary: row.summary,
    facts: row.facts.map((fact) => ({ ...fact })),
    sources: row.sources.map((source) => ({ url: source.url, title: source.title })),
    target: storedTarget(row.targetHost, row.targetSource),
    fetchedAt: row.fetchedAt,
  });
}

/** La file du jour, telle qu'elle s'affiche. */
export async function listDepartures(
  now = new Date(),
  /**
   * Bornée à une campagne, quand on arrive depuis sa page.
   *
   * C'est un filtre de lecture, pas un second écran : la file garde ses trois
   * décisions et sa retouche à la main, et une copie de la file dans la page
   * d'une campagne ferait deux endroits où valider un même brouillon.
   */
  scope: { readonly campaignId?: string } = {},
): Promise<DepartureView[]> {
  const rows = await prisma.sequenceDeparture.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      ...(scope.campaignId === undefined
        ? {}
        : { enrollment: { sequence: { campaignId: scope.campaignId } } }),
    },
    orderBy: [{ createdAt: "asc" }],
    include: {
      enrollment: {
        include: {
          // `active` : une campagne en pause ne compose ni n'envoie, et la
          // file doit le dire plutôt que d'afficher des brouillons qui ne
          // partiront pas (jalon 84).
          sequence: {
            select: {
              name: true,
              active: true,
              campaign: { select: { name: true, otherRouting: true, mailboxId: true } },
              /*
                Les étapes écrites à la main, variantes comprises : c'est le
                **gabarit** qu'il faut pour savoir quelle phrase le rendu a
                retirée. Le corps composé, lui, ne la porte plus, et c'est bien
                le problème : c'est pour cela qu'on relit la source.
              */
              steps: {
                select: {
                  position: true,
                  mode: true,
                  brief: true,
                  subject: true,
                  body: true,
                  variants: { select: { group: true, subject: true, body: true } },
                },
              },
              // Le nombre d'étapes, pour dire « étape 2 sur 3 » plutôt que
              // « étape 2 » : la position seule ne dit pas s'il en reste.
              _count: { select: { steps: true } },
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              title: true,
              instagram: true,
              owner: true,
              contactGroup: true,
              groupSetBy: true,
              email: true,
              website: true,
              // La recherche de la fiche elle-même, quand elle n'a pas de
              // maison : depuis le jalon 84 c'est une portée à part entière.
              research: {
                select: {
                  gap: true,
                  summary: true,
                  corpus: true,
                  fetchedAt: true,
                  targetHost: true,
                  targetSource: true,
                  facts: true,
                  sources: true,
                },
              },
              company: {
                select: {
                  name: true,
                  domain: true,
                  research: {
                select: {
                  gap: true,
                  summary: true,
                  corpus: true,
                  fetchedAt: true,
                  targetHost: true,
                  targetSource: true,
                  facts: true,
                  sources: true,
                },
              },
                },
              },
            },
          },
        },
      },
    },
  });

  // Lus une fois : la vidéo et notre site sont les mêmes pour tout le monde.
  const globals = await templateGlobals();
  // Idem pour les blocs de signature : le contrôle de vide les retire avant de
  // juger, et c'est la même liste pour toute la file.
  const blocks = signatureBlocks(await listSignatories());

  const views: DepartureView[] = [];
  for (const row of rows) {
    /*
      **Les phrases retirées pour ce contact, recalculées à la lecture.**

      Comme la virgule de l'appel et la garde d'écho : ce qu'on relit le matin
      doit dire ce que le destinataire va lire. Le gabarit vient de l'étape, le
      choix de variante de `templateFor`, la même fonction que la composition,
      et le routage de la campagne.
    */
    const template = row.enrollment.sequence.steps.find(
      (entry) => entry.position === row.step,
    );
    /*
      **Périmé, c'est-à-dire composé depuis un autre texte que celui de
      l'étape d'aujourd'hui.** L'empreinte est recalculée ici et comparée à
      celle stockée ; une empreinte stockée vide se lit « on ne sait pas », donc
      reste silencieuse.
    */
    const stale =
      template === undefined
        ? false
        : isStaleDeparture(
            row.templateHash,
            templateFingerprint(
              threadShapeOf(row.enrollment.sequence.steps, row.step, template.variants),
            ),
          );

    /*
      **Un avertissement de carte doit décrire ce qui partira.** Quand le
      gabarit a bougé, la phrase retirée est calculée sur un texte que ce départ
      ne porte pas : on se taît et on propose de le réécrire, plutôt que
      d'annoncer une suppression dans un autre message.
    */
    /*
      **Les replis de l'objet, sur le même gabarit que les phrases retirées.**
      Silencieux sur un départ périmé, pour la même raison : ils décriraient un
      texte que ce départ ne porte pas.
    */
    const subjectNotes =
      stale || template === undefined || toStepMode(template.mode) !== "manual"
        ? []
        : subjectFallbacks(
            /*
              **L'objet du fil de CE contact**, donc de son groupe : la variante
              d'étape 1 du même groupe, à défaut le défaut de l'étape 1. Lire le
              seul défaut annonçait les replis d'un objet que ce destinataire ne
              reçoit pas.
            */
            threadSubjectFor(
              row.enrollment.sequence.steps,
              row.step,
              firstVariantsOf(row.enrollment.sequence.steps),
              routedGroup(
                row.enrollment.contact.contactGroup,
                row.enrollment.contact.groupSetBy,
                toOtherRouting(row.enrollment.sequence.campaign?.otherRouting ?? "default"),
              ),
            ),
            mergeValuesOf(row.enrollment.contact, globals),
          );

    const dropped =
      stale || template === undefined || toStepMode(template.mode) !== "manual"
        ? []
        : droppedSentences(
            templateFor(
              { subject: template.subject, body: template.body },
              template.variants.filter(
                (variant): variant is typeof variant & { group: ContactGroup } =>
                  isContactGroup(variant.group),
              ),
              routedGroup(
                row.enrollment.contact.contactGroup,
                row.enrollment.contact.groupSetBy,
                toOtherRouting(row.enrollment.sequence.campaign?.otherRouting ?? "default"),
              ),
            ).body,
            mergeValuesOf(row.enrollment.contact, globals),
          );

    const last = await prisma.activity.findFirst({
      where: { ...REAL_ACTIVITY, contactId: row.enrollment.contactId },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    /*
      Le message déjà envoyé pour cette séquence, relu à chaque affichage de la
      file : c'est contre lui que la relance est comparée.
    */
    const previous =
      row.step <= 1 ? null : await previousMessage(row.enrollment.contactId, row.enrollment.sequenceId);
    const echoText =
      previous === null
        ? ""
        : describeEcho(echoOf(previous.body, repairGreeting(row.body, row.enrollment.contact)));

    views.push({
      id: row.id,
      step: row.step,
      status: row.status,
      subject: row.subject,
      /*
        **La virgule de l'appel est réparée à la lecture**, pas seulement à la
        composition : les brouillons déjà en file ont été écrits avant le
        correctif, et ce sont eux qu'on relit ce matin. Ce que la file montre
        est donc ce qui partira : `sendDeparture` applique la même réparation.
        Le texte stocké, lui, n'est réécrit que si on l'enregistre : une
        consultation n'écrit pas (jalon 8).
      */
      body: repairGreeting(row.body, row.enrollment.contact),
      detail: row.detail,
      sequenceName: row.enrollment.sequence.name,
      contactId: row.enrollment.contact.id,
      contactName: contactTitle(row.enrollment.contact),
      to: row.enrollment.contact.email,
      lastActivityDays: last === null ? null : daysSince(last.date, now),
      lastActivityAt: last?.date ?? null,
      demoData: isDemoContact({
        id: row.enrollment.contact.id,
        email: row.enrollment.contact.email,
      }),
      demoSource: describeDemoSource(
        demoTarget({
          website: row.enrollment.contact.website,
          companyDomain: row.enrollment.contact.company?.domain ?? "",
          companyName: row.enrollment.contact.company?.name ?? "",
        }),
      ),
      // La société d'abord, la fiche à défaut : c'est l'ordre de `researchFor`.
      research: cardFor(
        row.enrollment.contact.company?.research ?? row.enrollment.contact.research ?? null,
      ),
      ungrounded: describeUngrounded(
        ungroundedClaims(
          repairGreeting(row.body, row.enrollment.contact),
          row.enrollment.contact.company?.research?.corpus ??
            row.enrollment.contact.research?.corpus ??
            "",
        ),
      ),
      /*
        **La garde d'écho, recalculée à la lecture**, comme la virgule de
        l'appel et le garde-fou de recherche. C'est ce qui fait qu'une retouche
        à la main est vérifiée elle aussi : un brouillon qu'on a rapproché du
        premier message en le corrigeant doit se signaler comme les autres.
      */
      echo: echoText,
      companyName: row.enrollment.contact.company?.name ?? "",
      campaignName: row.enrollment.sequence.campaign?.name ?? "",
      stepsTotal: row.enrollment.sequence._count.steps,
      campaignPaused: !row.enrollment.sequence.active,
      dropped: [...dropped],
      subjectFallbacks: subjectNotes,
      empty: emptyDepartureReason(row, blocks) ?? "",
      stale,
      edited: row.editedAt !== null,
      mailboxId: row.enrollment.sequence.campaign?.mailboxId ?? "",
      // Rempli apres la boucle : la capacite se lit une fois pour toute la file.
      carried: false,
      createdAt: row.createdAt,
    });
  }

  /*
    **La capacite restante, lue une fois, et l'ordre dans lequel elle se
    depense.**

    `carried` est derive a la lecture, jamais stocke : une colonne « reporte »
    devrait etre remise a zero chaque matin, et le matin ou on l'oublierait
    l'ecran annoncerait un report qui n'existe plus. Ici, la file redit chaque
    jour ce qui est vrai ce jour-la.

    L'ordre vient de `sortByPriority`, la meme fonction que l'ordonnanceur : les
    relances d'abord, puis le plus ancien. Les deux surfaces depensent donc les
    derniers creneaux du jour sur les memes departs, et une garde statique
    verifie qu'elles ne cessent pas de partager cette fonction.
  */
  const usage = await readMailboxUsage(now);
  const full = new Set(usage.filter((row) => capReached(row)).map((row) => row.mailboxId));
  const withCap = views.map((view) => ({ ...view, carried: full.has(view.mailboxId) }));

  return sortByPriority(withCap);
}

export type DepartureOutcome =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string };

/**
 * Envoie un départ.
 *
 * L'ordre des garde-fous compte : **la règle du domaine d'abord, le débit
 * ensuite, l'envoi en dernier.** Vérifier le débit avant la règle ferait
 * refuser pour cause de plafond un message qui n'aurait de toute façon pas dû
 * partir, et le motif affiché serait faux.
 */
export async function sendDeparture(
  id: string,
  mode: SendMode,
  now = new Date(),
): Promise<DepartureOutcome> {
  // `auto` en base garde son sens : « ce départ n'a pas été validé à la main ».
  // C'est lui que compte le double verrou du jalon 38, et le gonfler avec les
  // envois de l'ordonnanceur ferait qu'une séquence se déverrouille toute seule.
  const auto = mode !== "human";
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id },
    include: {
      enrollment: {
        include: {
          sequence: {
            select: {
              id: true,
              name: true,
              steps: true,
              autoMode: true,
              // **La pause vaut aussi à l'envoi.** La composition la respectait
              // depuis le jalon 71 ; l'envoi non, si bien qu'une campagne mise
              // en pause laissait partir à la main tout ce qui était déjà en
              // file. « En pause » ne veut alors plus rien dire.
              active: true,
              campaign: { select: { mailboxId: true, name: true } },
            },
          },
          contact: {
            select: {
              id: true,
              lifecycle: true,
              lostReason: true,
              email: true,
              // Le prénom : la réparation de l'appel en a besoin au moment de
              // l'envoi, pas seulement à l'affichage.
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (departure === null) return { ok: false, message: "Départ introuvable." };
  if (departure.status === "sent") return { ok: false, message: "Ce départ est déjà parti." };
  if (!departure.enrollment.sequence.active) {
    const name = departure.enrollment.sequence.campaign?.name ?? departure.enrollment.sequence.name;
    return {
      ok: false,
      message: `La campagne « ${name} » est en pause : rien ne part tant qu'elle ne redémarre pas. Relancez-la depuis sa page pour envoyer ce départ.`,
    };
  }

  const enrollment = departure.enrollment;
  const replied = await repliedAfter(
    enrollment.contactId,
    enrollment.lastSentAt ?? enrollment.enrolledAt,
  );
  const verdict = nextStep(
    {
      lifecycle: toLifecycle(enrollment.contact.lifecycle),
      lostReason: enrollment.contact.lostReason,
      email: enrollment.contact.email,
    },
    { repliedAt: replied, lastSentAt: enrollment.lastSentAt, lastStep: enrollment.lastStep },
    enrollment.sequence.steps,
    now,
    // **Un clic est une décision, pas un passage d'automate.** La règle du
    // week-end protège l'automate d'un brouillon périmé et d'une réponse non
    // relevée ; appliquée à une personne qui regarde la carte, elle refusait
    // l'envoi en silence. Tous les autres garde-fous valent dans les deux cas.
    mode === "human" ? "human" : "machine",
  );

  if (!verdict.ok || verdict.step !== departure.step) {
    const reason = verdict.ok
      ? "L'étape a changé depuis la composition."
      : BLOCK_LABELS[verdict.reason];

    /*
      **Un motif transitoire laisse le départ en file.** `readDepartures` ne lit
      que `pending` et `failed` : marquer « écarté » un départ refusé parce que
      le délai n'est pas écoulé le faisait disparaître de l'écran, alors que rien
      n'était parti et que demain il serait dû. Une carte qui s'en va se lit
      comme un envoi réussi.
    */
    const transient = !verdict.ok && isTransientBlock(verdict.reason);

    await prisma.sequenceDeparture.update({
      where: { id },
      data: transient
        ? { detail: reason }
        : { status: "skipped", decidedAt: now, detail: reason },
    });
    if (!verdict.ok && stopsEnrollment(verdict.reason)) {
      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: verdict.reason === "finished" ? "done" : "stopped",
          stopReason: BLOCK_LABELS[verdict.reason],
        },
      });
    }
    return { ok: false, message: reason };
  }

  if (mode === "compose" && !canSendAutomatically(verdict.step, enrollment.sequence.autoMode, await unlockOf(enrollment.sequenceId))) {
    return { ok: false, message: "Ce départ demande une validation à la main." };
  }

  /*
    **Un départ vide est refusé ici, donc par les trois chemins.** Le clic
    humain, la composition et l'ordonnanceur passent tous par cette fonction :
    le contrôle y vit une seule fois, et une garde statique vérifie qu'ils ne
    cessent pas de la partager. Il précède le débit, parce qu'un texte vide ne
    partira pas davantage demain, et refuser pour cause de plafond afficherait
    un motif faux (voir `emptyDepartureReason` pour ce que « vide » veut dire).
  */
  const emptyReason = emptyDepartureReason(departure, signatureBlocks(await listSignatories()));
  if (emptyReason !== null) {
    const refusal = emptyDepartureRefusal(emptyReason);
    // Le départ **reste en attente** avec sa cause : le passer `failed` le
    // ferait lire « brouillon non composé » et désactiverait ses boutons, donc
    // on ne pourrait plus le réécrire (jalon 91).
    await prisma.sequenceDeparture.update({ where: { id }, data: { detail: refusal } });
    return { ok: false, message: refusal };
  }

  /*
    **Le plafond de la boite, juste avant le debit.**

    Les deux refus se ressemblent et ne disent pas la meme chose : `checkRate`
    porte sur tout le CRM et apprend d'un refus du serveur (jalon 38), celui-ci
    est une discipline de prospection choisie a l'avance, par adresse d'envoi.
    Il vient en premier parce qu'il est le plus specifique : nommer la boite et
    son compte renseigne davantage qu'un plafond global.

    Un depart refuse ici **reste en attente**, comme pour le debit : il partira
    le prochain jour ouvre, et la carte dit qu'il est reporte.
  */
  const capBox = enrollment.sequence.campaign?.mailboxId ?? "";
  if (capBox !== "") {
    const usage = await readUsageFor(capBox, now);
    if (usage !== null && capReached(usage)) {
      const refusal = capRefusal(usage);
      await prisma.sequenceDeparture.update({ where: { id }, data: { detail: refusal } });
      return { ok: false, message: refusal };
    }
  }

  const rate = await checkRate(now);
  if (!rate.ok) {
    // Ni envoyé ni perdu : le départ reste en attente et repart demain.
    await prisma.sequenceDeparture.update({ where: { id }, data: { detail: rate.reason } });
    return { ok: false, message: rate.reason };
  }

  const sent = await sendEmailToContact({
    contactId: enrollment.contactId,
    subject: departure.subject,
    // Même réparation qu'à l'affichage : ce qui part est ce qui a été relu.
    body: repairGreeting(departure.body, enrollment.contact),
    // La boîte de la campagne, ou le choix par propriétaire à défaut, un
    // départ composé avant le jalon 54 n'a pas de campagne, et il doit partir
    // quand même.
    signatoryId: enrollment.sequence.campaign?.mailboxId ?? "",
    sequenceId: enrollment.sequence.id,
    sequenceName: enrollment.sequence.name,
    sequenceStep: departure.step,
  });

  if (!sent.ok) {
    /*
      **Un envoi refusé laisse le départ en attente, avec sa cause.**

      Il écrivait `status: "failed"`, or ce statut signifie « brouillon non
      composé » pour la carte, qui rend alors « Brouillon non composé : … » et
      **désactive tous ses boutons**. Un refus d'envoi produisait donc une carte
      qui affirmait quelque chose de faux (le brouillon existe, il a été relu)
      et qu'on ne pouvait plus jamais renvoyer, même après avoir corrigé la
      cause, par exemple un mot de passe SMTP posé sur le service.

      Le texte reste, la carte reste, la cause s'affiche, et le geste se rejoue.
    */
    await prisma.sequenceDeparture.update({ where: { id }, data: { detail: sent.message } });
    return { ok: false, message: sent.message };
  }

  await prisma.$transaction([
    prisma.sequenceDeparture.update({
      where: { id },
      data: { status: "sent", decidedAt: now, auto },
    }),
    prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { lastStep: departure.step, lastSentAt: now },
    }),
  ]);

  return {
    ok: true,
    message: `Étape ${departure.step} envoyée à ${sent.sent.contactName} (${sent.sent.to}).`,
  };
}

/**
 * Combien de départs d'une campagne ont été composés **avant** sa dernière
 * modification.
 *
 * Compté par la même comparaison que la carte (`isStaleDeparture`) : le nombre
 * annoncé sur la campagne est donc exactement celui des cartes qui portent
 * l'avertissement, et non un second comptage qui pourrait en différer : l'écart
 * payé au jalon 49 entre une puce et sa liste.
 */
export async function countStaleDepartures(campaignId: string): Promise<number> {
  const rows = await prisma.sequenceDeparture.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      enrollment: { sequence: { campaignId } },
    },
    select: {
      step: true,
      templateHash: true,
      enrollment: {
        select: {
          sequence: {
            select: {
              steps: {
                select: {
                  position: true,
                  mode: true,
                  brief: true,
                  subject: true,
                  body: true,
                  variants: { select: { group: true, subject: true, body: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  let stale = 0;
  for (const row of rows) {
    const step = row.enrollment.sequence.steps.find((entry) => entry.position === row.step);
    if (step === undefined) continue;
    if (
      isStaleDeparture(
        row.templateHash,
        templateFingerprint(threadShapeOf(row.enrollment.sequence.steps, row.step, step.variants)),
      )
    ) {
      stale += 1;
    }
  }
  return stale;
}

/**
 * **Réécrire ce départ**, depuis le gabarit d'aujourd'hui.
 *
 * Le geste existe pour deux cartes : celle qui est vide (l'étape n'avait pas
 * encore de texte quand elle a été composée) et celle qui est périmée (le
 * gabarit a bougé depuis). Dans les deux cas, ce qu'on veut n'est pas un second
 * brouillon mais **celui-ci, à jour**.
 *
 * **Une étape écrite à la main ne coûte rien** : le texte existe, la réécriture
 * se réduit à remplacer trois balises, donc **aucun appel au modèle** et le
 * compteur d'usage ne bouge pas. Une étape rédigée par Alex, elle, est un appel
 * facturé, et c'est dit à l'écran avant le clic.
 *
 * Le départ est mis à jour **en place** : il garde son identité
 * `(inscription, étape, tour)`, donc sa place dans la file et son historique.
 * `editedAt` est effacé, parce que le texte n'est plus celui qu'on avait
 * retouché à la main.
 */
export async function rewriteDeparture(
  departureId: string,
  now = new Date(),
): Promise<DepartureOutcome> {
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id: departureId },
    include: {
      enrollment: {
        include: {
          sequence: {
            select: {
              id: true,
              steps: true,
              campaign: { select: { mailboxId: true, otherRouting: true } },
            },
          },
        },
      },
    },
  });
  if (departure === null) return { ok: false, message: "Départ introuvable." };
  if (departure.status === "sent") return { ok: false, message: "Ce départ est déjà parti." };

  const step = departure.enrollment.sequence.steps.find(
    (entry) => entry.position === departure.step,
  );
  if (step === undefined) {
    return {
      ok: false,
      message: `L'étape ${departure.step} n'existe plus dans cette séquence : ce départ ne peut pas être réécrit.`,
    };
  }

  const manual = toStepMode(step.mode) === "manual";
  const variants = manual ? await readStepVariants(step.id) : [];

  let written: { readonly subject: string; readonly body: string } | null = null;
  if (manual) {
    const thread = threadTemplate(
      departure.enrollment.sequence.steps,
      departure.step,
      variants,
      firstVariantsOf(departure.enrollment.sequence.steps),
    );
    written = await renderManualStep(
      departure.enrollment.contactId,
      thread.step,
      departure.enrollment.sequence.campaign?.mailboxId,
      thread.variants,
      departure.enrollment.sequence.campaign?.otherRouting ?? "default",
    );
  } else {
    const previous =
      departure.step <= 1
        ? null
        : await previousMessage(departure.enrollment.contactId, departure.enrollment.sequenceId);
    const draft = await draftEmail(
      departure.enrollment.contactId,
      undefined,
      step.brief,
      departure.enrollment.sequence.campaign?.mailboxId,
      { step: departure.step, previous },
    );
    if (!draft.ok) return { ok: false, message: draft.message };
    written = draft.draft;
  }
  if (written === null) {
    return { ok: false, message: "La fiche de ce contact n'existe plus : rien à réécrire." };
  }

  await prisma.sequenceDeparture.update({
    where: { id: departureId },
    data: {
      subject: written.subject,
      body: written.body,
      templateHash: templateFingerprint(
        threadShapeOf(departure.enrollment.sequence.steps, departure.step, variants),
      ),
      status: "pending",
      detail: "",
      editedAt: null,
      day: dayKey(now),
    },
  });

  return {
    ok: true,
    message: manual
      ? "Départ réécrit avec le texte de l'étape. Aucun appel au modèle, rien n'a été facturé."
      : "Départ réécrit par Alex, avec les consignes d'aujourd'hui.",
  };
}

/**
 * **Réécrire les départs périmés d'une campagne**, d'un geste.
 *
 * Rien de neuf ici : la boucle appelle `rewriteDeparture` départ par départ,
 * donc les mêmes règles et le même coût. Sur une campagne écrite à la main,
 * l'opération est gratuite et instantanée ; sur une campagne rédigée par Alex,
 * c'est un appel facturé par départ, et la confirmation de l'écran le dit avant
 * le clic.
 */
export async function rewriteStaleDepartures(
  campaignId: string,
  now = new Date(),
): Promise<{ readonly rewritten: number; readonly failed: number }> {
  const rows = await prisma.sequenceDeparture.findMany({
    where: { status: { in: ["pending", "failed"] }, enrollment: { sequence: { campaignId } } },
    select: { id: true },
  });

  let rewritten = 0;
  let failed = 0;
  for (const row of rows) {
    // On relit la carte plutôt que de rejouer la liste : un départ réécrit
    // entre-temps ne doit pas être repayé.
    const stale = await isDepartureStale(row.id);
    if (!stale) continue;
    const outcome = await rewriteDeparture(row.id, now);
    if (outcome.ok) rewritten += 1;
    else failed += 1;
  }
  return { rewritten, failed };
}

/** Ce départ vient-il d'un gabarit qui a bougé depuis ? */
async function isDepartureStale(departureId: string): Promise<boolean> {
  const row = await prisma.sequenceDeparture.findUnique({
    where: { id: departureId },
    select: {
      step: true,
      templateHash: true,
      enrollment: {
        select: {
          sequence: {
            select: {
              steps: {
                select: {
                  position: true,
                  mode: true,
                  brief: true,
                  subject: true,
                  body: true,
                  variants: { select: { group: true, subject: true, body: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (row === null) return false;
  const step = row.enrollment.sequence.steps.find((entry) => entry.position === row.step);
  if (step === undefined) return false;
  return isStaleDeparture(
    row.templateHash,
    templateFingerprint(
      threadShapeOf(row.enrollment.sequence.steps, step.position, step.variants),
    ),
  );
}

/**
 * Reporter d'un jour.
 *
 * Le départ est **supprimé**, pas déplacé : il sera recomposé demain matin à
 * partir de l'état de demain. Garder le brouillon d'aujourd'hui pour l'envoyer
 * demain reproduirait exactement le défaut que la composition du matin même
 * corrige.
 */
export async function postponeDeparture(id: string, now = new Date()): Promise<DepartureOutcome> {
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id },
    select: { status: true, enrollmentId: true },
  });
  if (departure === null) return { ok: false, message: "Départ introuvable." };
  if (departure.status === "sent") return { ok: false, message: "Ce départ est déjà parti." };
  // **Pas de garde de pause ici** : reporter n'est pas envoyer, et un départ
  // qu'on écarte d'une campagne en pause est un geste parfaitement sensé.

  await prisma.$transaction([
    prisma.sequenceDeparture.delete({ where: { id } }),
    // Le délai de l'étape court depuis le dernier envoi : décaler la date
    // d'inscription d'un jour évite qu'un report soit annulé dès demain par un
    // délai déjà échu, et fait que trois reports décalent bien de trois jours.
    prisma.sequenceEnrollment.update({
      where: { id: departure.enrollmentId },
      data: { lastSentAt: now },
    }),
  ]);

  return { ok: true, message: "Reporté à demain. Le brouillon sera réécrit avec l'état de demain." };
}

/**
 * **Retirer le brouillon de la file, et rien d'autre.**
 *
 * Le contact reste inscrit, à la même étape : c'est le texte qu'on ne veut pas,
 * pas la personne. Le prochain enregistrement de la séquence, ou la prochaine
 * composition, le ramène avec le texte du jour : la contrainte d'unicité
 * `(inscription, étape, tour)` ne voit plus de ligne pour ce couple.
 *
 * Deux différences avec ses voisins, et ce sont elles qui justifient une
 * troisième fonction plutôt qu'un paramètre :
 *
 * - `postponeDeparture` avance `lastSentAt` d'un jour, donc **décale
 *   l'échéance** : ici on ne reporte rien, on efface un brouillon ;
 * - `removeFromSequence` arrête l'inscription : ici personne ne quitte la
 *   campagne, et l'entonnoir ne bouge pas.
 *
 * Un départ **envoyé** est un fait et ne s'efface pas.
 */
export async function dropDeparture(id: string): Promise<DepartureOutcome> {
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id },
    select: { status: true },
  });
  if (departure === null) return { ok: false, message: "Départ introuvable." };
  if (departure.status === "sent") return { ok: false, message: "Ce départ est déjà parti." };

  await prisma.sequenceDeparture.delete({ where: { id } });

  return {
    ok: true,
    message:
      "Départ retiré de la file. Le contact reste inscrit à la même étape : le prochain enregistrement de la séquence le ramènera avec le texte du jour.",
  };
}

/** Retirer le contact de la séquence, définitivement. */
export async function removeFromSequence(id: string, now = new Date()): Promise<DepartureOutcome> {
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id },
    select: { enrollmentId: true, status: true },
  });
  if (departure === null) return { ok: false, message: "Départ introuvable." };

  await prisma.$transaction([
    prisma.sequenceDeparture.update({
      where: { id },
      data: { status: "skipped", decidedAt: now, detail: "Retiré de la séquence à la main" },
    }),
    prisma.sequenceEnrollment.update({
      where: { id: departure.enrollmentId },
      data: { status: "stopped", stopReason: "Retiré de la séquence à la main" },
    }),
  ]);

  return { ok: true, message: "Contact retiré de la séquence." };
}

/**
 * Un départ ouvert dans le panneau de rédaction, **sans appeler le modèle**.
 *
 * Le brouillon existe déjà : il a été composé et payé. Le rouvrir doit donc
 * rendre *ce* texte, pas en écrire un second, sans quoi ouvrir une ligne pour
 * la relire coûterait un appel, et l'on perdrait le brouillon qu'on venait
 * regarder.
 *
 * L'enveloppe est celle du panneau, destinataire, signataires, boîte de la
 * campagne, pour qu'il n'existe **qu'une seule surface de rédaction**. Le fil
 * avec Alex, la reprise depuis le texte affiché et le retour en arrière sont
 * ceux du jalon 34, inchangés.
 */
export async function departureDraft(
  departureId: string,
): Promise<{ ok: true; draft: DepartureDraft } | { ok: false; message: string }> {
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id: departureId },
    select: {
      subject: true,
      body: true,
      status: true,
      step: true,
      enrollment: {
        select: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              owner: true,
              /*
                **La recherche voyage avec le brouillon rouvert.** Le panneau
                l'affiche depuis le jalon 74 ; ce chemin ne l'a jamais
                envoyée, et lire `research.state` sur `undefined` faisait
                tomber tout l'écran. La file la rend déjà : la rendre ici
                aussi, par la même fonction, est le correctif à la source.
              */
              research: RESEARCH_SELECT,
              company: { select: { name: true, research: RESEARCH_SELECT } },
            },
          },
          sequence: { select: { name: true, campaign: { select: { mailboxId: true } } } },
        },
      },
    },
  });
  if (departure === null) return { ok: false, message: "Ce départ n'existe pas." };
  if (departure.status !== "pending") {
    return {
      ok: false,
      message: `Ce départ n'est plus en attente (${departure.status}) : il n'y a plus de brouillon à retravailler.`,
    };
  }

  const contact = departure.enrollment.contact;
  const mailboxId = departure.enrollment.sequence.campaign?.mailboxId;
  const signatories = await listSignatories();
  const signatory =
    (mailboxId === undefined || mailboxId === ""
      ? undefined
      : signatories.find((entry) => entry.id === mailboxId)) ?? pickSignatory(signatories, contact.owner);

  return {
    ok: true,
    draft: {
      subject: departure.subject,
      body: repairGreeting(departure.body, contact),
      to: contact.email,
      contactId: contact.id,
      contactName: contactTitle(contact),
      step: departure.step,
      sequenceName: departure.enrollment.sequence.name,
      signatories,
      signatoryId: signatory?.id ?? null,
      // La société d'abord, la fiche à défaut : l'ordre de `researchFor`, et
      // exactement ce que rend la carte de la file.
      research: cardFor(contact.company?.research ?? contact.research ?? null),
      ungrounded: describeUngrounded(
        ungroundedClaims(
          repairGreeting(departure.body, contact),
          contact.company?.research?.corpus ?? contact.research?.corpus ?? "",
        ),
      ),
    },
  };
}

export interface DepartureDraft {
  readonly subject: string;
  readonly body: string;
  readonly to: string;
  readonly contactId: string;
  readonly contactName: string;
  readonly step: number;
  readonly sequenceName: string;
  readonly signatories: Awaited<ReturnType<typeof listSignatories>>;
  readonly signatoryId: string | null;
  /** Ce qu'Alex a lu, tel que la carte de la file le montre. */
  readonly research: ResearchCard;
  /** Une affirmation produit qu'aucune page lue ne soutient. */
  readonly ungrounded: string | null;
}

/**
 * Enregistre un brouillon retravaillé, **sans l'envoyer, sans le recomposer**.
 *
 * La ligne garde son identité `(inscription, étape)`, donc la composition ne
 * repassera jamais dessus : la contrainte d'unicité qui empêche de composer
 * deux fois protège aussi le travail qu'on vient de faire à la main.
 */
export async function saveDeparture(
  departureId: string,
  subject: string,
  body: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id: departureId },
    select: { status: true },
  });
  if (departure === null) return { ok: false, message: "Ce départ n'existe pas." };
  if (departure.status !== "pending") {
    return { ok: false, message: "Ce départ n'est plus en attente : il ne peut plus être modifié." };
  }

  const cleanSubject = sanitizeSubject(subject).trim();
  if (cleanSubject === "") return { ok: false, message: "L'objet ne peut pas être vide." };
  if (body.trim() === "") return { ok: false, message: "Le message ne peut pas être vide." };

  await prisma.sequenceDeparture.update({
    where: { id: departureId },
    // `editedAt` marque la retouche à la main. Il ne sert pas à afficher une
    // date : il sert à **prévenir** avant que « Écrire les mails » ne remplace
    // un texte que quelqu'un a relu et corrigé.
    data: { subject: cleanSubject, body, editedAt: new Date() },
  });
  return { ok: true };
}

/**
 * **Vider la file des départs en attente** (jalon 87).
 *
 * Le geste existe pour repartir de zéro : on a changé le discours, les notes
 * d'angle ou le texte d'une étape, et ce qui est en file décrit le monde
 * d'avant. « Réécrire tous les départs » (jalon 84) recompose ; celui-ci
 * **jette**, sans rien repayer.
 *
 * Trois choses qu'il ne touche jamais, et la confirmation les dit avant :
 *
 * - **les envois** : ils sont partis, c'est un fait, et /emails les compte ;
 * - **les fiches et leur historique** : un brouillon jeté n'a jamais existé
 *   pour la personne ;
 * - **les inscriptions** : personne ne quitte la campagne. La composition
 *   suivante réécrira ce qui manque, puisque la contrainte d'unicité ne voit
 *   plus de départ pour ce couple.
 *
 * Seuls les départs `pending` et `failed` partent : un `sent` est un envoi, un
 * `skipped` est une décision. La portée est **celle qu'on regarde** : arrivé
 * depuis une campagne, on ne vide que la sienne, et le compte annoncé est
 * exactement celui des lignes affichées.
 */
export async function clearDepartures(
  scope: { readonly campaignId?: string } = {},
): Promise<{ cleared: number }> {
  const outcome = await prisma.sequenceDeparture.deleteMany({
    where: {
      status: { in: ["pending", "failed"] },
      ...(scope.campaignId === undefined
        ? {}
        : { enrollment: { sequence: { campaignId: scope.campaignId } } }),
    },
  });
  return { cleared: outcome.count };
}
