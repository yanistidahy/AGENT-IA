import Link from "next/link";
import { listDepartures } from "@/lib/api/departures";
import { readCompositionJobs } from "@/lib/api/compose-now";
import { listCampaigns } from "@/lib/api/campaigns";
import { DeparturesView, type Departure } from "@/components/sequences/departures-view";
import { CompositionBanner } from "@/components/sequences/composition-banner";
import { CompositionRefresh } from "@/components/sequences/composition-refresh";

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
      <DeparturesView initial={initial} />
    </>
  );
}
