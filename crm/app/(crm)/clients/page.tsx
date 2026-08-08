import { ClientsTable, PortfolioTotals } from "@/components/clients/clients-table";
import { readClients, toClientSort } from "@/lib/api/clients";
import { getPilotage } from "@/lib/api/reference";

export const dynamic = "force-dynamic";

/**
 * Portefeuille clients : qui paie, combien, et à quand remonte la dernière
 * conversation. Trié par chiffre d'affaires décroissant par défaut.
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const tri = raw.tri;
  const sort = toClientSort(Array.isArray(tri) ? tri[0] : tri);

  const settings = await getPilotage();
  const portfolio = await readClients(sort, settings);

  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Contacts au cycle de vie « Client » · rouge au-delà de {settings.coldDays} jours sans
          interaction
        </p>
      </header>

      <PortfolioTotals
        count={portfolio.clients.length}
        total={portfolio.totalRevenue}
        average={portfolio.averageRevenue}
      />

      <ClientsTable
        clients={portfolio.clients}
        sort={sort}
        coldDays={settings.coldDays}
      />
    </div>
  );
}
