import Link from "next/link";
import { listDepartures } from "@/lib/api/departures";
import { readCompositionJobs } from "@/lib/api/compose-now";
import { listCampaigns } from "@/lib/api/campaigns";
import { DeparturesView, type Departure } from "@/components/sequences/departures-view";
import { CompositionBanner } from "@/components/sequences/composition-banner";
import { CompositionRefresh } from "@/components/sequences/composition-refresh";
import { RewriteQueueAction } from "@/components/sequences/rewrite-queue-action";

export const dynamic = "force-dynamic";

export default async function DepartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const asked = raw["campagne"];
  const campaignId = Array.isArray(asked) ? asked[0] : asked;

  const [departures, jobs, campaigns] = await Promise.all([
    listDepartures(new Date(), { campaignId }),
    readCompositionJobs(),
    campaignId === undefined ? Promise.resolve([]) : listCampaigns(),
  ]);
  const campaign = campaigns.find((entry) => entry.id === campaignId);

  // Les dates traversent la frontière serveur → client en chaînes : le composant
  // n'en fait que de l'affichage, et les reconvertir des deux côtés n'apporterait
  // qu'une occasion de décalage de fuseau.
  // Les campagnes en pause qui ont des départs en file : nommées une fois, pas
  // une par ligne.
  const paused = [
    ...new Set(
      departures
        .filter((departure) => departure.campaignPaused)
        .map((departure) => (departure.campaignName === "" ? departure.sequenceName : departure.campaignName)),
    ),
  ];

  const initial: Departure[] = departures.map((departure) => ({
    ...departure,
    lastActivityAt: departure.lastActivityAt?.toISOString() ?? null,
  }));

  return (
    <>
      <CompositionRefresh running={jobs.some((job) => job.running)} />
      <CompositionBanner jobs={jobs} />
      {/*
        Un filtre actif se **nomme**, avec de quoi l'annuler : une file bornée à
        une campagne sans que rien ne le dise se lit comme une file vide (règle
        du filtre orphelin du jalon 31).
      */}
      {campaignId !== undefined && (
        <div className="mx-6 mt-4 flex flex-wrap items-center gap-2 rounded-control border border-brand bg-brand-l px-3 py-2 text-[12.5px]">
          <span>
            Départs de la campagne{" "}
            <strong className="font-semibold">{campaign?.name ?? "inconnue"}</strong> seulement.
          </span>
          <Link href="/departs" className="text-brand-d underline">
            Voir toute la file
          </Link>
        </div>
      )}
      {/*
        **Une campagne en pause ne compose ni n'envoie** (jalon 71) : ses
        départs restent en file sans que rien ne parte. Sans cette bande, on
        relit des brouillons en se demandant pourquoi ils ne bougent pas.
      */}
      {paused.length > 0 && (
        <div className="mx-6 mt-3 rounded-control border border-[#E8C37A] bg-[#FBF3E2] px-3 py-2 text-[12.5px]">
          <strong className="font-semibold">
            {paused.length === 1 ? "Une campagne est en pause" : `${paused.length} campagnes sont en pause`}
          </strong>{" "}
          : {paused.join(", ")}. Leurs départs restent dans la file, mais rien ne sera composé ni
          envoyé pour elles tant qu&apos;elles ne sont pas relancées.
        </div>
      )}
      <RewriteQueueAction />
      <DeparturesView initial={initial} />
    </>
  );
}
