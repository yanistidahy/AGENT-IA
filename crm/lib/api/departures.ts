import "server-only";
import { describeEcho, echoOf } from "../domain/follow-up-echo";
import { storedTarget } from "../domain/research-target";
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
  stopsEnrollment,
} from "../domain/sequence-rules";
import { replyAnchor } from "../domain/campaign-reset";
import { toStepMode } from "../domain/merge-tags";
import { renderManualStep } from "./manual-step";
import { contactTitle, repairGreeting } from "../domain/contact-identity";
import { demoTarget, describeDemoSource } from "../domain/demo-target";
import { listSignatories, pickSignatory } from "./signatories";
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
  const empty = { composed: 0, sentAutomatically: 0, stopped: 0, waiting: 0 };

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
          steps: { orderBy: { position: "asc" } },
          // La boîte de la campagne : chaque message de la séquence part de la
          // même adresse, avec la même signature (jalon 54).
          campaign: { select: { mailboxId: true } },
        },
      },
      contact: { select: { id: true, lifecycle: true, lostReason: true, email: true } },
    },
  });

  let composed = 0;
  let sentAutomatically = 0;
  let stopped = 0;
  let waiting = 0;
  let stoppedByUser = false;

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
    let written: { readonly subject: string; readonly body: string } | null = null;

    if (toStepMode(step?.mode ?? "") === "manual") {
      written = await renderManualStep(
        enrollment.contactId,
        { subject: step?.subject ?? "", body: step?.body ?? "" },
        enrollment.sequence.campaign?.mailboxId,
      );
      // La fiche a disparu entre la lecture de la file et la composition :
      // rare, et rien à inventer.
      if (written === null) continue;
    } else {
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
      const outcome = await sendDeparture(departure.id, true, now);
      if (outcome.ok) sentAutomatically += 1;
    }
  }

  return { skipped: null, composed, sentAutomatically, stopped, waiting, stoppedByUser };
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
      sequence: { include: { steps: { orderBy: { position: "asc" } } } },
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
  readonly campaignName: string;
  /** Sa campagne est en pause : rien ne sera composé ni envoyé pour elle. */
  readonly campaignPaused: boolean;
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
          sequence: { select: { name: true, active: true, campaign: { select: { name: true } } } },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
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

  const views: DepartureView[] = [];
  for (const row of rows) {
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
      campaignName: row.enrollment.sequence.campaign?.name ?? "",
      campaignPaused: !row.enrollment.sequence.active,
    });
  }
  return views;
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
  auto: boolean,
  now = new Date(),
): Promise<DepartureOutcome> {
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
  );

  if (!verdict.ok || verdict.step !== departure.step) {
    const reason = verdict.ok
      ? "L'étape a changé depuis la composition."
      : BLOCK_LABELS[verdict.reason];

    await prisma.sequenceDeparture.update({
      where: { id },
      data: { status: "skipped", decidedAt: now, detail: reason },
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

  if (auto && !canSendAutomatically(verdict.step, enrollment.sequence.autoMode, await unlockOf(enrollment.sequenceId))) {
    return { ok: false, message: "Ce départ demande une validation à la main." };
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
    await prisma.sequenceDeparture.update({
      where: { id },
      data: { status: "failed", decidedAt: now, detail: sent.message },
    });
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
