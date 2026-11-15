import { CompaniesView } from "@/components/companies/companies-view";
import {
  companyFacets,
  countCompaniesWithoutVisitors,
  getCompany,
  listCompanies,
  listIndustries,
  listNiches,
} from "@/lib/api/companies";
import { COMPANY_FILTER_COLUMNS } from "@/lib/api/company-columns";
import { parseFilters } from "@/lib/domain/column-filters";
import { parseCompaniesQuery } from "@/lib/api/company-schemas";
import { listOwners } from "@/lib/api/reference";
import { listSequences } from "@/lib/api/sequences";

export const dynamic = "force-dynamic";

export default async function SocietesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }

  const parsed = parseCompaniesQuery(flat);
  const query = parsed.success ? parsed.data : {};

  // Paramètres bruts : les filtres de colonne se répètent (`f.size=…&f.size=…`).
  const filters = parseFilters(raw, COMPANY_FILTER_COLUMNS);
  const now = new Date();

  const [companies, industries, niches, owners, sequences, facetData, withoutVisitors] =
    await Promise.all([
      listCompanies(query, filters, now),
      listIndustries(),
      listNiches(),
      listOwners(),
      listSequences(),
      companyFacets(query, filters, now),
      /*
        Le compte de la puce « Trafic non renseigné ». Il porte sur **toutes**
        les sociétés et non sur la liste filtrée : une puce qui compterait son
        propre résultat afficherait toujours le total de ce qu'elle vient de
        sélectionner, ce qui n'apprend rien (la règle du jalon 6).
      */
      countCompaniesWithoutVisitors(),
    ]);

  const ficheId = flat.fiche;
  const focused =
    ficheId === undefined || companies.some((company) => company.id === ficheId)
      ? null
      : await getCompany(ficheId);

  return (
    <CompaniesView
      companies={companies}
      industries={industries}
      niches={niches}
      owners={owners}
      sequences={sequences}
      focused={focused}
      facets={facetData.facets}
      totalRows={facetData.total}
      withoutVisitors={withoutVisitors}
    />
  );
}
