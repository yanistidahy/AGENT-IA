import { listDepartures } from "@/lib/api/departures";
import { DeparturesView, type Departure } from "@/components/sequences/departures-view";

export const dynamic = "force-dynamic";

export default async function DepartsPage() {
  const departures = await listDepartures();

  // Les dates traversent la frontière serveur → client en chaînes : le composant
  // n'en fait que de l'affichage, et les reconvertir des deux côtés n'apporterait
  // qu'une occasion de décalage de fuseau.
  const initial: Departure[] = departures.map((departure) => ({
    ...departure,
    lastActivityAt: departure.lastActivityAt?.toISOString() ?? null,
  }));

  return <DeparturesView initial={initial} />;
}
