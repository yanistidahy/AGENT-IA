import "server-only";
import { prisma } from "../db";
import { composeDepartures, countComposable } from "./departures";
import { modelFor } from "./reference";
import { costMicros } from "../domain/model-pricing";
import {
  estimateComposition,
  INLINE_MAX,
  type CostEstimate,
  type DraftSample,
} from "../domain/compose-estimate";

/**
 * **Composer maintenant, plutôt que demain matin.**
 *
 * La file du matin reste la file du matin : elle se compose au passage
 * quotidien, à partir de l'état du jour, et rien de cela ne change. Ce module
 * ajoute une seconde porte vers **la même boucle** — celle qu'on ouvre en
 * enregistrant une campagne, pour relire ses brouillons dans la minute au lieu
 * d'attendre le lendemain pour découvrir qu'une étape était vide.
 *
 * Trois choses qu'il ne fait pas, et c'est délibéré :
 *
 * - **il n'envoie rien.** Il remplit la file que l'on valide ensuite à la main.
 *   La distinction du jalon 38 — composer n'est pas envoyer — ne bouge pas d'un
 *   pouce, et le mode automatique reste le seul chemin qui envoie sans clic,
 *   avec son double verrou ;
 * - **il ne recompose pas** ce qui est déjà en file : la contrainte d'unicité
 *   `(inscription, étape)` le garantit, et `countComposable` l'annonce ;
 * - **il n'invente aucun garde-fou et n'en retire aucun** : il appelle
 *   `composeDepartures` avec une portée. Cycle de vie terminal, opposition au
 *   démarchage, réponse déjà reçue, adresse manquante, week-end, espacement des
 *   collègues — tout est vérifié par le même code, au même endroit.
 */

/** Ce que la confirmation affiche avant que quoi que ce soit ne parte. */
export interface ComposePlan {
  readonly estimate: CostEstimate;
  /** Pourquoi il n'y a rien à composer, quand c'est le cas. */
  readonly blocked: string | null;
}

/**
 * La moyenne des brouillons **réellement facturés** sur le modèle courant.
 *
 * Bornée aux quatre-vingt-dix derniers jours : un prompt d'il y a six mois ne
 * décrit plus celui d'aujourd'hui, et c'est justement la dérive qu'une
 * constante ne verrait pas.
 */
async function draftSample(model: string): Promise<DraftSample | null> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const rows = await prisma.apiUsage.aggregate({
    where: { purpose: "draft", model, createdAt: { gte: since } },
    _count: { _all: true },
    _avg: { inputTokens: true, outputTokens: true },
  });

  const calls = rows._count._all;
  const input = rows._avg.inputTokens;
  const output = rows._avg.outputTokens;
  if (calls === 0 || input === null || output === null) return null;

  return { calls, inputTokens: Math.round(input), outputTokens: Math.round(output) };
}

/** Le plan : combien, combien ça coûte, et ce qui empêcherait de composer. */
export async function planComposition(
  campaignId: string,
  now = new Date(),
  /**
   * Des inscriptions **sur le point** d'être faites, à compter en plus.
   *
   * C'est ce qui permet d'annoncer le prix sur la confirmation d'inscription,
   * avant que quiconque soit inscrit : chaque nouvelle inscription éligible
   * demandera un brouillon d'étape 1. **C'est un majorant** — les garde-fous
   * s'appliquent à la composition, et une fiche sans adresse ou déjà en
   * opposition n'appellera rien. Annoncer plus que ce qui sera dépensé est le
   * bon sens de l'erreur : une facture plus légère que prévu ne surprend
   * personne.
   */
  pending = 0,
): Promise<ComposePlan> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      archivedAt: true,
      sequence: {
        select: { id: true, active: true, steps: { select: { id: true, brief: true } } },
      },
    },
  });

  const model = await modelFor("draft");
  const nothing = (blocked: string | null): ComposePlan => ({
    estimate: estimateComposition({
      drafts: 0,
      model,
      sample: null,
      price: () => 0,
    }),
    blocked,
  });

  if (campaign === null) return nothing("Campagne introuvable.");
  if (campaign.sequence === null) return nothing("Cette campagne n'a pas de séquence.");

  // **Les causes du silence sont nommées une par une.** « 0 départ » sans
  // raison est exactement ce qui a fait chercher du côté du planificateur alors
  // que la séquence était simplement inactive.
  if (campaign.archivedAt !== null) {
    return nothing("Campagne archivée : elle n'envoie plus. Désarchivez-la d'abord.");
  }
  if (!campaign.sequence.active) {
    return nothing(
      "La séquence de cette campagne est inactive — une campagne neuve l'est toujours. " +
        "Activez-la dans ses étapes pour que des départs puissent être composés.",
    );
  }
  if (campaign.sequence.steps.length === 0) {
    return nothing("Cette séquence n'a aucune étape : il n'y a rien à écrire.");
  }
  if (campaign.sequence.steps.every((step) => step.brief.trim() === "")) {
    return nothing(
      "Aucune étape ne porte de consigne : Alex écrirait sans savoir quoi dire. " +
        "Renseignez au moins la première.",
    );
  }

  const counted = await countComposable({ sequenceId: campaign.sequence.id }, now);
  const { weekend } = counted;
  const eligible = counted.eligible + Math.max(0, pending);
  if (weekend) {
    return nothing(
      "Samedi ou dimanche : rien n'est composé. La règle du jalon 38 tient ici aussi — " +
        "un brouillon écrit le samedi décrirait un état vieux de deux jours au moment de partir.",
    );
  }

  const sample = await draftSample(model);
  return {
    estimate: estimateComposition({
      drafts: eligible,
      model,
      sample,
      price: (usage) =>
        costMicros(model, {
          input: usage.input,
          output: usage.output,
          thinking: null,
          cacheRead: 0,
          cacheWrite: 0,
        }),
    }),
    blocked: eligible === 0 ? "Personne n'est éligible : tout le monde est déjà en file, arrêté ou sans adresse." : null,
  };
}

export interface ComposeOutcome {
  readonly composed: number;
  /** Vrai quand le travail continue en arrière-plan après la réponse. */
  readonly background: boolean;
  readonly estimateMicros: number;
  readonly drafts: number;
  readonly blocked: string | null;
}

/**
 * Compose pour une campagne — dans la requête si c'est court, en arrière-plan
 * sinon.
 *
 * **Le seuil n'est pas une préférence, c'est une limite de transport.** Un
 * brouillon prend quelques secondes ; cinquante dépasseraient le délai du proxy
 * et l'écran afficherait un échec sur un travail à moitié fait — le pire des
 * deux mondes, puisque les brouillons déjà écrits ont bel et bien été payés.
 * Au-delà de `INLINE_MAX`, on rend la main tout de suite et la file se remplit
 * à mesure.
 */
export async function composeForCampaign(
  campaignId: string,
  now = new Date(),
  /**
   * `"auto"` compose dans la requête en dessous du seuil ; `"background"` rend
   * la main tout de suite, quel que soit le nombre.
   *
   * **Les gestes du parcours prennent `"background"`**, et c'est mesuré : un
   * brouillon demande un appel au modèle, soit quelques secondes, et trois
   * collègues d'une même maison se composent **l'un après l'autre** — la règle
   * du jalon 53 interdit de reprendre l'accroche du voisin, ce qui suppose de
   * l'avoir déjà écrite. Trois brouillons, c'est donc une vingtaine de secondes
   * de travail réel. Les attendre dans la requête ferait tourner un sablier
   * tout ce temps sur un clic qui, lui, a déjà tout déclenché. On rend la main,
   * et la file se remplit sous les yeux.
   */
  mode: "auto" | "background" = "auto",
): Promise<ComposeOutcome> {
  const plan = await planComposition(campaignId, now);
  const base = {
    estimateMicros: plan.estimate.micros,
    drafts: plan.estimate.drafts,
    blocked: plan.blocked,
  };
  if (plan.blocked !== null || plan.estimate.drafts === 0) {
    return { ...base, composed: 0, background: false };
  }

  const sequenceId = await sequenceOf(campaignId);
  if (sequenceId === null) return { ...base, composed: 0, background: false };

  if (mode === "auto" && !plan.estimate.background) {
    const report = await composeDepartures(now, { sequenceId });
    return { ...base, composed: report.composed, background: false };
  }

  // Au-delà du seuil : on ouvre le journal **avant** de rendre la main, sans
  // quoi l'écran rechargé ne trouverait rien et croirait qu'il ne s'est rien
  // passé.
  const job = await prisma.compositionJob.create({
    data: {
      campaignId,
      total: plan.estimate.drafts,
      estimateMicros: plan.estimate.micros,
    },
    select: { id: true },
  });

  void runInBackground(job.id, sequenceId, now);
  return { ...base, composed: 0, background: true };
}

/**
 * Composer après un enregistrement de séquence — **le geste qui manquait**.
 *
 * L'écran des étapes est monté dans la carte de campagne (jalon 54) : y cliquer
 * « Enregistrer » est le moment où l'on écrit la consigne et où la campagne
 * devient prête. C'était pourtant le seul geste du parcours qui ne composait
 * pas.
 *
 * Une séquence sans campagne — il n'en existe plus depuis le jalon 54, mais le
 * schéma l'autorise — ne compose pas : elle n'a pas d'écran d'où la relire.
 */
export async function composeAfterSave(
  sequenceId: string,
  now = new Date(),
): Promise<ComposeOutcome | null> {
  const sequence = await prisma.emailSequence.findUnique({
    where: { id: sequenceId },
    select: { campaignId: true },
  });
  if (sequence?.campaignId == null) return null;
  return composeForCampaign(sequence.campaignId, now, "background");
}

async function sequenceOf(campaignId: string): Promise<string | null> {
  const row = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { sequence: { select: { id: true } } },
  });
  return row?.sequence?.id ?? null;
}

/**
 * Le travail de fond, lancé sans être attendu.
 *
 * **Il ne lève jamais** : personne n'attend sa promesse, donc une exception
 * remonterait dans le vide et le journal resterait ouvert pour toujours,
 * affichant une préparation qui n'avance plus. L'échec est écrit dans le
 * journal, en clair, là où l'écran le lira.
 */
async function runInBackground(jobId: string, sequenceId: string, now: Date): Promise<void> {
  try {
    const report = await composeDepartures(now, { sequenceId });
    await prisma.compositionJob.update({
      where: { id: jobId },
      data: { done: report.composed, finishedAt: new Date() },
    });
  } catch (error) {
    await prisma.compositionJob
      .update({
        where: { id: jobId },
        data: {
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : "Composition interrompue.",
        },
      })
      .catch(() => undefined);
  }
}

export interface JobView {
  readonly campaignId: string;
  readonly total: number;
  readonly done: number;
  readonly running: boolean;
  readonly error: string;
}

/**
 * Les compositions en cours, pour la bannière.
 *
 * L'avancement affiché est **le nombre de départs réellement en file**, pas le
 * compteur du journal : celui-ci n'est écrit qu'à la fin, et une barre qui
 * saute de 0 à 47 d'un coup n'est pas un avancement. Les deux disent la même
 * chose à la fin ; en route, seul le premier bouge.
 */
export async function readCompositionJobs(now = new Date()): Promise<JobView[]> {
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const jobs = await prisma.compositionJob.findMany({
    where: { startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    select: {
      campaignId: true,
      total: true,
      done: true,
      finishedAt: true,
      error: true,
      campaign: { select: { sequence: { select: { id: true } } } },
    },
  });

  const views: JobView[] = [];
  for (const job of jobs) {
    const sequenceId = job.campaign.sequence?.id;
    const queued =
      sequenceId === undefined
        ? job.done
        : await prisma.sequenceDeparture.count({
            where: { enrollment: { sequenceId }, status: { in: ["pending", "failed"] } },
          });

    views.push({
      campaignId: job.campaignId,
      total: job.total,
      done: Math.min(queued, job.total),
      running: job.finishedAt === null,
      error: job.error,
    });
  }
  return views;
}

export { INLINE_MAX };
