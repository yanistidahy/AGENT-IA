import Link from "next/link";
import { AlertList } from "@/components/activities/alert-list";
import { ActivityFeed, RiskDeals } from "@/components/dashboard/feed-and-risks";
import { DashboardHeader } from "@/components/dashboard/header";
import { StaleContacts, toStaleSort } from "@/components/dashboard/stale-contacts";
import { Upcoming } from "@/components/dashboard/upcoming";
import { readAlerts } from "@/lib/api/alerts";
import { listRecommendations } from "@/lib/api/recommendations";
import { findAgentProfile } from "@/lib/api/agents";
import { snapshotHealth, type SnapshotHealth } from "@/lib/api/snapshots";
import { describeAge, STALE_AFTER_HOURS } from "@/lib/domain/snapshots";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { readActionQueue, readProspecting, readWeek } from "@/lib/api/dashboard";
import { ActionQueue } from "@/components/dashboard/action-queue";
import { ProspectingCards, WeekCard } from "@/components/dashboard/prospecting";
import { listOwners } from "@/lib/api/reference";
import { staleDealsWithoutTask } from "@/lib/api/automation";
import { WakeStaleDeals } from "@/components/activities/wake-stale";
import { readDashboard } from "@/lib/api/dashboard";
import { readDbStatus, type Counts } from "@/lib/db-status";
import { readDeployInfo } from "@/lib/deploy-info";

/**
 * Centre de pilotage.
 *
 * `force-dynamic` est indispensable : sans lui, Next pré-rendrait la page au
 * build, où aucune base n'est joignable. Elle répond 200 même base éteinte, pour
 * afficher son diagnostic plutôt que de faire boucler les redémarrages — c'est
 * `/api/health` qui échoue franchement quand la base ne répond pas, et c'est lui
 * qui doit servir de cible au healthcheck.
 *
 * Aucun texte n'est écrit en dur à propos de l'état du produit : les compteurs
 * viennent de `readDbStatus()` (sept `count()` Prisma par requête), les blocs de
 * `readDashboard()`, les alertes du moteur du domaine. L'ancienne mention
 * « Jalon 1 » était un artefact interne figé au premier déploiement ; elle a été
 * retirée plutôt que corrigée, parce qu'un numéro de jalon n'apprend rien à
 * l'utilisateur et redevient faux au jalon suivant. Le garde-fou est
 * `app/(crm)/__tests__/home-page.test.ts`.
 */
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const tri = raw.tri;
  const sort = toStaleSort(Array.isArray(tri) ? tri[0] : tri);

  const status = await readDbStatus();
  const deploy = readDeployInfo();
  const renderedAt = new Date();

  // Calculé **avant** les retours anticipés : une base vide ou injoignable est
  // exactement le moment où l'état des sauvegardes doit rester visible. Lu dans
  // le journal local et non dans le magasin distant — la page d'accueil se rend
  // à chaque visite, un aller-retour réseau y serait payé pour une information
  // qui change une fois par jour.
  const backup = await snapshotHealth(renderedAt);

  if (!status.ok) {
    return (
      <Shell deploy={deploy} renderedAt={renderedAt} backup={backup}>
        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="size-2 rounded-full bg-pulse" />
            <h2 className="font-display text-[15px] font-semibold">{status.diagnosis.reason}</h2>
          </div>
          <p className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#B2311F]">
            {status.diagnosis.hint}
          </p>
        </section>
      </Shell>
    );
  }

  if (status.total === 0) {
    return (
      <Shell deploy={deploy} renderedAt={renderedAt} backup={backup}>
        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="size-2 rounded-full bg-flux" />
            <h2 className="font-display text-[15px] font-semibold">Base de données connectée</h2>
          </div>
          <Counters counts={status.counts} />
          <p className="mt-3 rounded-control border border-[#F0DFB8] bg-gold-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#9A6410]">
            La base répond, mais elle est vide : les sept tables existent et ne contiennent
            aucune ligne. Ce n'est pas un affichage figé — c'est l'état réel de la base à
            laquelle ce déploiement est connecté. Lancez{" "}
            <code className="font-mono">npm run db:seed</code> sur le service pour charger le
            jeu de démonstration ; <code className="font-mono">/api/health</code> renvoie le
            même diagnostic en JSON.
          </p>
        </section>
      </Shell>
    );
  }

  const [data, alerts] = await Promise.all([readDashboard(renderedAt), readAlerts(renderedAt)]);

  const [actions, prospecting, week, owners, recommendations] = await Promise.all([
    readActionQueue(data.settings, renderedAt),
    readProspecting(renderedAt),
    readWeek(renderedAt),
    listOwners(),
    listRecommendations({ scope: "open" }, renderedAt),
  ]);

  // L'écran suit l'état de la base : sans affaire, les cartes de revenu ne
  // disent rien qu'on ne sache déjà, et cèdent la place à la prospection.
  const hasDeals = data.openCount > 0 || data.monthRevenue > 0;

  // Affaires en sommeil qui n'ont pas encore de tâche de réveil ouverte. Rien
  // n'est écrit ici : on ne fait que compter ce que l'action groupée créerait.
  // Le titre du bloc porte le nom réglé de l'agent d'arbitrage, jamais un nom
  // écrit en dur : renommer Sabrina dans les réglages doit renommer le bloc.
  const arbiter = await findAgentProfile("sabrina");

  const wakeable = await staleDealsWithoutTask(
    alerts.filter((alert) => alert.kind === "deal-stale").map((alert) => alert.targetId),
  );

  return (
    <Shell deploy={deploy} renderedAt={renderedAt} backup={backup}>
      {recommendations.length > 0 && (
        <Block
          title={`Le point de ${arbiter?.name ?? "l'arbitre"}`}
          count={recommendations.length}
          hint="les trois plus importantes — la suite dans /conseil/suggestions"
        >
          <ul className="grid gap-2">
            {recommendations.slice(0, 3).map((item) => (
              <RecommendationCard key={item.id} item={item} />
            ))}
          </ul>
          {recommendations.length > 3 && (
            <p className="mt-2 text-[12.5px] text-muted">
              <Link href="/conseil/suggestions" className="underline hover:text-flux-d">
                Voir les {recommendations.length} recommandations
              </Link>
            </p>
          )}
        </Block>
      )}

      {!hasDeals && <ProspectingCards metrics={prospecting} />}

      {hasDeals && (
      <DashboardHeader
        now={renderedAt}
        pipelineValue={data.pipelineValue}
        weightedValue={data.weightedValue}
        monthRevenue={data.monthRevenue}
        objective={data.settings.objectifMensuel}
        openCount={data.openCount}
      />
      )}

      <Block title="À traiter maintenant" count={actions.length}>
        <WakeStaleDeals dealIds={wakeable} />
        <ActionQueue
          rows={actions}
          owners={owners}
          defaultOwner={owners[0] ?? ""}
        />
      </Block>

      <Block title="Ma semaine" hint="le second chiffre est celui qui dit si j'ai prospecté">
        <WeekCard week={week} />
      </Block>

      <Block
        title="Clients & prospects — dernière touche"
        hint={`rouge au-delà de ${data.settings.coldDays} jours sans contact`}
      >
        <StaleContacts contacts={data.staleContacts} sort={sort} />
      </Block>

      <div className="grid gap-5 lg:grid-cols-2">
        <Block title="Relances à venir (7 jours)" count={data.upcoming.length}>
          <Upcoming items={data.upcoming} />
        </Block>

        {/* Les affaires à risque n'ont de sens que s'il y a des affaires. */}
        {hasDeals && (
          <Block title="Affaires en sommeil" count={data.risks.length}>
            <RiskDeals deals={data.risks} />
          </Block>
        )}
      </div>

      <Block title="Activité récente">
        <ActivityFeed items={data.feed} />
      </Block>

      <Counters counts={status.counts} />
    </Shell>
  );
}

function Shell({
  deploy,
  renderedAt,
  backup,
  children,
}: {
  deploy: ReturnType<typeof readDeployInfo>;
  renderedAt: Date;
  backup: SnapshotHealth;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Le bandeau vit dans la coquille, pas dans le corps : la page sort tôt
          quand la base est vide ou injoignable, et c'est précisément là qu'une
          sauvegarde périmée doit se voir. */}
      {backup.stale && (
        <div className="mb-4 rounded-card border border-[#F0C9C2] bg-pulse-l px-4 py-3">
          <p className="text-[13px] font-semibold">Sauvegarde en retard</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            Dernière sauvegarde réussie : {describeAge(backup.lastSuccessAt, renderedAt)}. Au-delà
            de {STALE_AFTER_HOURS} h sans instantané, une perte de base ne serait plus
            rattrapable.{" "}
            <Link href="/reglages" className="underline hover:text-flux-d">
              Vérifier les sauvegardes
            </Link>
          </p>
        </div>
      )}
      {children}
      <p className="mt-8 border-t border-line pt-3 font-mono text-[10.5px] text-muted">
        {deploy.commit !== null && (
          <>
            commit {deploy.commit}
            {deploy.branch !== null && ` · ${deploy.branch}`}
            {" · "}
          </>
        )}
        rendu à{" "}
        <time dateTime={renderedAt.toISOString()}>
          {renderedAt.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Europe/Paris",
          })}
        </time>
        {" · "}
        <Link href="/api/health" className="hover:underline">
          /api/health
        </Link>
      </p>
    </div>
  );
}

function Block({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-2.5 flex flex-wrap items-baseline gap-2 font-display text-[15px] font-semibold">
        {title}
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-paper px-2 py-[1px] font-mono text-[11px] font-normal text-muted">
            {count}
          </span>
        )}
        {hint !== undefined && <span className="text-[12px] font-normal text-muted">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}

function Counters({ counts }: { counts: Counts }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-4">
      {Object.entries(counts).map(([label, count]) => (
        <div key={label} className="bg-surface-2 px-3 py-2.5">
          <dt className="font-mono text-[9.5px] tracking-[0.13em] text-muted uppercase">
            {label}
          </dt>
          <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums">{count}</dd>
        </div>
      ))}
    </dl>
  );
}
