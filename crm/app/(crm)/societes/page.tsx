import { CompaniesView } from "@/components/companies/companies-view";
import {
  companyFacets,
  getCompany,
  listCompanies,
  listIndustries,
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

  const [companies, industries, owners, sequences, facetData] = await Promise.all([
    listCompanies(query, filters, now),
    listIndustries(),
    listOwners(),
    listSequences(),
    companyFacets(query, filters, now),
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
      owners={owners}
      sequences={sequences}
      focused={focused}
      facets={facetData.facets}
      totalRows={facetData.total}
    />
  );
}
