import { BoardTabs } from "@/components/pilotage/board-tabs";
import { FilterBar } from "@/components/pilotage/filter-bar";
import { ManualCounter } from "@/components/pilotage/manual-counter";
import { ObjectiveCards, type Objective } from "@/components/pilotage/objective-cards";
import { KpiCards, type Kpi } from "@/components/pilotage/kpi-cards";
import { FunnelView } from "@/components/pilotage/funnel-view";
import { ReliabilityChip, SampleLine } from "@/components/pilotage/reliability-chip";
import { BoardHeader } from "@/components/pilotage/board-header";
import { pilotageView } from "@/lib/api/pilotage-view";
import { listHref, sameHere } from "@/lib/domain/board-links";
import {
  channelSplit,
  funnel,
  inviteAcceptance,
  objectiveLabel,
  progress,
  rateLabel,
  replyRate,
  uncategorisedReplies,
  type Metric,
} from "@/lib/domain/pilotage";
import { CHANNEL_LABELS } from "@/lib/domain/outreach";
import { reliabilityOf } from "@/lib/domain/size-buckets";

export const dynamic = "force-dynamic";

/**
 * **Onglet 1 — Vue d'ensemble : où en est la semaine.**
 *
 * Trois objectifs, quatre indicateurs, un entonnoir, et le compteur manuel à
 * côté. Aucun chiffre n'est calculé ici : chacun sort de `lib/domain/pilotage.ts`
 * par l'unique porte `pilotageView`, qui lit l'URL, borne la période, attribue
 * les campagnes et filtre — une fois pour les quatre onglets. C'est ce qui rend
 * impossible qu'un onglet compte autre chose qu'un autre sur les mêmes gens.
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = await pilotageView(params);
  const { data, period, query, rows, previous, metric } = view;

  /*
    **Les cibles ne s'affichent que sur la semaine en cours.**

    Elles sont hebdomadaires : les comparer au mois écoulé ou à une plage libre
    de trois jours donnerait « 310 % » puis « 12 % », deux nombres qui ne veulent
    rien dire. Hors de la semaine, la carte garde son chiffre et perd sa barre.
  */
  const weekly = query.periodKey === "semaine";
  const objective = (name: Metric, label: string, target: number): Objective => {
    const value = metric(name).count;
    return {
      metric: name,
      label,
      value,
      target,
      note: objectiveLabel(value, target),
      ratio: weekly ? progress(value, target) : null,
      href: listHref(params, name, {}, "/pilotage"),
    };
  };

  const objectives: readonly Objective[] = [
    objective("messages", "Messages envoyés", data.targets.messages),
    objective("demos_sent", "Démos envoyées", data.targets.demos),
    objective("qualified", "Démos qualifiées", data.targets.qualified),
  ];

  const fresh = metric("new_contacted").count;
  const positive = metric("positive").count;
  const uncategorised = uncategorisedReplies(rows).length;
  const rate = replyRate(rows);
  const contacted = metric("contacted").count;
  const replied = metric("replies").count;
  const invites = inviteAcceptance(rows);
  /*
    **La période précédente passe par le même appel que la courante.**

    `metricOn` est `metricResult` avec un autre bornage : mêmes filtres, même
    définition. Recompter « nouvelles personnes » autrement pour la comparaison
    rendrait l'évolution fausse sans que le chiffre courant bouge d'un pouce,
    donc sans que personne s'en aperçoive.
  */
  const freshBefore = view.metricOn(previous.period, previous.rows, "new_contacted").count;

  // La décomposition par canal vient du domaine : un taux de plus écrit ici
  // serait un taux de plus à maintenir, et la garde statique le refuse.
  const perChannel = channelSplit(rows);

  const kpis: readonly Kpi[] = [
    {
      key: "new_contacted",
      label: "Nouvelles personnes",
      value: String(fresh),
      href: listHref(params, "new_contacted", {}, "/pilotage"),
      change: { delta: fresh - freshBefore, before: freshBefore },
      hint: "Premier message dans la période, sur toute l'histoire.",
    },
    {
      key: "positive",
      label: "Réponses positives",
      value: String(positive),
      href: listHref(params, "positive", {}, "/pilotage"),
      lines: [
        {
          label: "Réponses non classées",
          value: String(uncategorised),
          /*
            **Son propre indicateur, et pas « replies ».** La ligne compte les
            réponses *non classées* ; ouvrir la liste des personnes ayant répondu
            affichait « 11 » au-dessus de 22 lignes — le défaut que le contrôle
            d'invariant a relevé au jalon 114.
          */
          href:
            uncategorised === 0
              ? null
              : listHref(params, "replies_uncategorised", {}, "/pilotage"),
        },
      ],
      hint:
        uncategorised > 0
          ? "Une réponse non classée compte dans les réponses et dans aucune catégorie : rien n'est deviné."
          : undefined,
    },
    {
      key: "reply_rate",
      label: "Taux de réponse",
      value: rateLabel(rate),
      href: null,
      sample: (
        <span className="flex flex-wrap items-center gap-2">
          <SampleLine part={replied} whole={contacted} />
          <ReliabilityChip n={contacted} reliability={reliabilityOf(contacted)} />
        </span>
      ),
      /*
        **Le nombre d'une ligne de canal est son `n`, et le lien ouvre ce `n`.**

        Défaut de ma première version, trouvé par la vérification de
        l'invariant et non à la relecture : la ligne affichait les **personnes**
        touchées par le canal et ouvrait la liste des **messages**. Un canal où
        l'on a relancé deux fois une personne affichait donc « 1 » au-dessus
        d'une liste de deux lignes. Le nombre et la liste sortent maintenant du
        même chiffre (`contacted`), qui est aussi le dénominateur du taux
        affiché à côté — c'est-à-dire le seul nombre que cette ligne doit dire.
      */
      lines: perChannel.map((line) => ({
        label: `${CHANNEL_LABELS[line.channel]} · ${rateLabel(line.rate)}`,
        value: String(line.contacted),
        href: listHref(params, "contacted", { canal: line.channel }, "/pilotage"),
      })),
    },
    {
      key: "invites",
      label: "Invitations LinkedIn acceptées",
      value: rateLabel(invites.rate),
      href: null,
      sample: (
        <SampleLine part={invites.accepted.length} whole={invites.sent.length} />
      ),
      hint: "Une invitation acceptée n'est pas une réponse : elle n'entre pas dans le taux ci-contre.",
    },
  ];

  const steps = funnel(view.all, rows, period);

  return (
    <div className="min-h-full bg-board px-6 py-5">
      <BoardHeader period={period.label} />
      <BoardTabs params={params} active="/pilotage" />
      <FilterBar
        campaigns={data.campaigns}
        owners={data.owners}
        niches={data.niches}
        groups={data.groups}
        sources={data.sources}
      />

      {/*
        **Une seule grille pour les quatre blocs, et un seul compteur dans le
        document.**

        Le brief du jalon 114 demande le compteur **en haut** sous 768 px, au-dessus
        des objectifs, et **inchangé** au-dessus. La tentation est d'en rendre deux
        exemplaires et d'en masquer un par point de rupture : ce serait deux blocs
        d'état client, deux fois le même `localStorage`, deux listes d'annulation —
        et le jour où l'on clique « +1 » dans celui que l'autre ne voit pas, la
        page se contredit elle-même. Les quatre blocs sont donc les enfants d'une
        **seule** grille, et c'est `order` qui déplace le compteur.

        **L'ordre du document ne bouge pas**, et c'est délibéré : il reste
        objectifs, indicateurs, entonnoir, compteur, donc le bureau est inchangé
        jusqu'à l'ordre de tabulation. Le prix est payé sous 768 px, où le
        compteur se voit en premier et se tabule en dernier. C'est le bon sens de
        l'écart : sur un téléphone on atteint ce bloc du pouce, et le brief
        demande qu'il soit **cliquable sans défiler** — pas qu'il soit le premier
        au clavier.
      */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="xl:col-span-2 xl:row-start-1">
          <ObjectiveCards objectives={objectives} />
        </section>

        <section className="xl:col-span-2 xl:row-start-2">
          <KpiCards kpis={kpis} />
        </section>

        <section className="xl:col-start-1 xl:row-start-3">
          <FunnelView
            steps={steps}
            asShare={query.asShare}
            toggleHref={sameHere("/pilotage", params, { part: query.asShare ? "" : "1" })}
            href={(name) => listHref(params, name, {}, "/pilotage")}
          />
        </section>

        {/*
          **Le compteur reste à côté de l'entonnoir sur grand écran, et il reste
          atteignable même quand la période est vide.** C'est l'erreur du jalon 19
          à ne pas refaire : un bloc rendu après un retour anticipé « rien à
          afficher » disparaît exactement le jour où l'on en a le plus besoin —
          une base neuve, où le premier geste est justement de compter.

          `order-first md:order-none` : premier sous 768 px, à sa place au-dessus.
          Le point de rupture est bien `md` (768 px) et non `xl`, parce que c'est
          celui que le brief nomme ; entre les deux, la colonne unique garde
          l'ordre du document, comme avant ce jalon.
        */}
        <section
          data-counter-slot
          className="order-first md:order-none xl:col-start-2 xl:row-start-3"
        >
          <ManualCounter
            owners={data.owners}
            contacts={data.contactOptions}
            initialToday={data.manual.today}
            initialHistory={data.manual.history.map((entry) => ({
              ...entry,
              at: entry.at.toISOString(),
            }))}
          />
        </section>
      </div>
    </div>
  );
}
