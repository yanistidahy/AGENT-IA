import { BoardTabs } from "@/components/pilotage/board-tabs";
import { BoardHeader } from "@/components/pilotage/board-header";
import { FilterBar } from "@/components/pilotage/filter-bar";
import { CampaignBoard } from "@/components/pilotage/campaign-board";
import { pilotageView } from "@/lib/api/pilotage-view";
import { listHref, one, sameHere } from "@/lib/domain/board-links";
import { NO_CAMPAIGN, type Metric } from "@/lib/domain/pilotage";
import { boardLines, toBoardSort, toSortDir } from "@/lib/domain/campaigns-board";
import type { BoardColumn } from "@/components/pilotage/campaign-board";

export const dynamic = "force-dynamic";

/**
 * **Onglet 4 — Campagnes côte à côte.**
 *
 * Les campagnes du CRM et celles de lemlist dans le même tableau, par la clé
 * commune de `campaignKey` (jalon 111) : sans elle, la question « est-ce que
 * celle-là marche mieux que celle-ci ? » serait inposable, puisque les deux
 * origines vivraient dans deux écrans.
 *
 * Chaque campagne porte en plus son **résultat par étape**, que les colonnes
 * `stepIndex` / `stepType` du jalon 113 v2 rendent possible : un total de
 * campagne ne dit jamais laquelle des quatre relances ne sert à rien, et c'est
 * pourtant la seule chose qu'on peut retirer.
 */
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = await pilotageView(params);
  const { data, period, rows, all, now } = view;

  /*
    **Le tri vit dans l'URL**, comme tous les réglages locaux de ces onglets
    (`tri` et `sens` sont dans `LOCAL_PARAMS`) : une vue triée se partage, se met
    en favori et survit à un rechargement — la règle du jalon 1 —, et l'écran
    reste rendu côté serveur, sans un octet de JavaScript pour trier.
  */
  const sort = toBoardSort(one(params, "tri"));
  const dir = toSortDir(one(params, "sens"));

  const lines = boardLines(
    all,
    rows,
    period,
    data.archivedCampaigns,
    data.reportedCampaigns,
    now,
    sort,
    dir,
  );

  /*
    **Cliquer la colonne déjà triée inverse le sens ; une autre colonne repart
    en décroissant.** Repartir en croissant mettrait en tête la campagne qui a le
    moins produit, c'est-à-dire la ligne qu'on ne cherchait pas.
  */
  const sortHref = (key: typeof sort) =>
    sameHere("/pilotage/campagnes", params, {
      tri: key,
      sens: key === sort && dir === "desc" ? "asc" : "desc",
    });

  return (
    <div className="min-h-full bg-board px-6 py-5">
      <BoardHeader period={period.label} />
      <BoardTabs params={params} active="/pilotage/campagnes" />
      <FilterBar
        campaigns={data.campaigns}
        owners={data.owners}
        niches={data.niches}
        groups={data.groups}
        sources={data.sources}
      />

      <CampaignBoard
        lines={lines}
        sort={sort}
        dir={dir}
        sortHref={sortHref}
        cellHref={(line, column) => {
          const metric: Record<BoardColumn, Metric> = {
            people: "contacted",
            messages: "messages",
            invites: "invites",
            accepted: "invites_accepted",
            replies: "replies",
            demos: "demos_sent",
            qualified: "qualified",
          };
          /*
            **« Hors campagne » n'ouvre pas de liste filtrée par campagne.**
            Le filtre `campagne=` ne sait pas dire « aucune » — et lui apprendre
            à le dire créerait une valeur sentinelle de plus dans l'URL pour une
            ligne qui se lit déjà très bien sans lien. La ligne reste dans le
            tableau : l'omettre ferait un tableau dont la somme ne retombe pas
            sur les pastilles de l'onglet d'à côté.
          */
          if (line.key === NO_CAMPAIGN) return null;
          return listHref(params, metric[column], { campagne: line.key }, "/pilotage/campagnes");
        }}
      />
    </div>
  );
}
