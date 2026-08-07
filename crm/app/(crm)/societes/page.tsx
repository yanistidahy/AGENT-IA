import { CompaniesView } from "@/components/companies/companies-view";
import { listCompanies, listIndustries } from "@/lib/api/companies";
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

  const [companies, industries, owners, sequences] = await Promise.all([
    listCompanies(query),
    listIndustries(),
    listOwners(),
    listSequences(),
  ]);

  return (
    <CompaniesView
      companies={companies}
      industries={industries}
      owners={owners}
      sequences={sequences}
    />
  );
}
