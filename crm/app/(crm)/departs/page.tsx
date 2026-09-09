import { listDepartures } from "@/lib/api/departures";
import { readCompositionJobs } from "@/lib/api/compose-now";
import { DeparturesView, type Departure } from "@/components/sequences/departures-view";
import { CompositionBanner } from "@/components/sequences/composition-banner";
import { CompositionRefresh } from "@/components/sequences/composition-refresh";

export const dynamic = "force-dynamic";

export default async function DepartsPage() {
  const [departures, jobs] = await Promise.all([listDepartures(), readCompositionJobs()]);

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
      <DeparturesView initial={initial} />
    </>
  );
}
