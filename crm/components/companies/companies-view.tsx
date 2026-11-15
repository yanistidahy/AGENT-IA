"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import type { CompanyRecord } from "@/lib/api/companies";
import { COMPANY_FILTER_COLUMNS } from "@/lib/api/company-columns";
import { COMPANY_FILTERS, COMPANY_FILTER_LABELS } from "@/lib/api/company-schemas";
import type { FacetValue } from "@/lib/domain/column-match";
import { FilterSummary, useColumnFilters } from "@/components/table/filter-state";
import { CompaniesTable, type CompanySortKey } from "./companies-table";
import { moneyShort } from "@/lib/format";
import type { SequenceOption } from "@/components/activities/run-sequence";
import { CompanyDrawer } from "./company-drawer";
import { CompanyForm } from "./company-form";
import { VisitorsImportDialog } from "./visitors-import-dialog";

/**
 * Grille de cartes plutôt qu'un tableau : une société se juge sur trois nombres
 * (contacts, pipeline ouvert, CA signé) qu'une carte présente d'un coup d'œil,
 * là où un tableau les noierait dans des colonnes de texte.
 */
interface CompaniesViewProps {
  readonly companies: readonly CompanyRecord[];
  readonly industries: ReadonlyArray<{ value: string; count: number }>;
  /** Les niches déjà en usage, proposées sous le champ du formulaire. */
  readonly niches: readonly string[];
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
  readonly totalRows: number;
  readonly owners: readonly string[];
  readonly sequences: readonly SequenceOption[];
  /** Société désignée par `?fiche=` mais absente de la liste filtrée. */
  readonly focused: CompanyRecord | null;
  /**
   * Combien de sociétés n'ont pas de trafic — le compte de la puce.
   *
   * Il vient de `countCompaniesWithoutVisitors`, la **même** fonction que le
   * bandeau de l'onglet Segments : les deux écrans ne peuvent donc pas annoncer
   * deux nombres différents pour la même question.
   */
  readonly withoutVisitors: number;
}

const CONTROL =
  "rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

export function CompaniesView({
  companies,
  industries,
  niches,
  owners,
  sequences,
  focused,
  facets,
  totalRows,
  withoutVisitors,
}: CompaniesViewProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const {
    state: filters,
    setFilter,
    reset,
  } = useColumnFilters("/societes", COMPANY_FILTER_COLUMNS);

  const industryNames = industries.map((industry) => industry.value);
  const chip = params.get("filter");
  const sortParam = params.get("sort");
  const dir = params.get("dir") === "desc" ? "desc" : "asc";

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      startTransition(() => router.replace(`/societes?${next.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  // Tiroir piloté par l'URL — voir le commentaire équivalent dans contacts-view.
  const fiche = params.get("fiche");
  const selected =
    fiche === null ? null : (companies.find((c) => c.id === fiche) ?? focused);

  const refresh = () => {
    setCreating(false);
    router.refresh();
  };

  const totalOpen = companies.reduce((sum, company) => sum + company.openValue, 0);

  return (
    <div className="px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Sociétés</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {companies.length} sociétés · {moneyShort(totalOpen)} de pipeline ouvert
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <a
            href={`/api/companies/export?${params.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-2"
          >
            Exporter en CSV
          </a>
          <button
            type="button"
            data-visitors-import-open
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-2"
          >
            Importer des trafics
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d"
          >
            <Icon name="plus" size={15} />
            Nouvelle société
          </button>
        </div>
      </header>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {/*
          **Les puces se replient sous `lg` au lieu d'être rognées.**

          Défaut mesuré au jalon 115, à 390 px : le groupe était `flex
          overflow-hidden`, et la quatrième puce — celle qu'on venait
          d'ajouter — tombait hors du cadre, **invisible et inatteignable**. Un
          `overflow-hidden` rogne sans rien dire, ce qui est exactement le mode
          de défaillance du jalon 60. Même remède que la barre de filtres du
          pilotage au jalon 114 : sur un téléphone on les empile, sur un écran
          large rien ne bouge.
        */}
        <div className="flex overflow-hidden rounded-control border border-line bg-surface max-lg:flex-wrap">
          <button
            type="button"
            onClick={() => setParam({ filter: null })}
            className={`border-r border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors last:border-r-0 ${
              chip === null ? "bg-brand text-white" : "text-muted hover:bg-surface-2"
            }`}
          >
            Toutes
          </button>
          {COMPANY_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              data-company-chip={value}
              onClick={() => setParam({ filter: value })}
              className={`border-r border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors last:border-r-0 ${
                chip === value ? "bg-brand text-white" : "text-muted hover:bg-surface-2"
              }`}
            >
              {COMPANY_FILTER_LABELS[value]}
              {/*
                **Seule la puce du trafic porte son compte**, et c'est voulu :
                c'est la seule qui désigne un travail à faire. Les trois autres
                décrivent un état du portefeuille, qu'un nombre n'aide pas à
                lire — et un compteur sur chaque puce serait une rangée de
                chiffres où plus rien ne ressort.
              */}
              {value === "sansTrafic" && (
                <span data-chip-count="sansTrafic" className="ml-1 tabular-nums">
                  ({withoutVisitors})
                </span>
              )}
            </button>
          ))}
        </div>

        <input
          className={`${CONTROL} min-w-[240px]`}
          placeholder="Rechercher : nom, domaine, secteur…"
          defaultValue={params.get("q") ?? ""}
          onChange={(event) => setParam({ q: event.target.value })}
        />
        <select
          className={CONTROL}
          value={params.get("industry") ?? ""}
          onChange={(event) => setParam({ industry: event.target.value })}
        >
          <option value="">Tous les secteurs</option>
          {industries.map((industry) => (
            <option key={industry.value} value={industry.value}>
              {industry.value} ({industry.count})
            </option>
          ))}
        </select>
      </div>

      <FilterSummary
        shown={companies.length}
        total={totalRows}
        active={Object.keys(filters).length}
        onReset={reset}
      />

      <CompaniesTable
        companies={companies}
        sort={isSortKey(sortParam) ? sortParam : undefined}
        dir={dir}
        onSort={(key) =>
          setParam({ sort: key, dir: sortParam === key && dir === "asc" ? "desc" : "asc" })
        }
        onSelect={(company) => setParam({ fiche: company.id })}
        facets={facets}
        filters={filters}
        onFilter={setFilter}
        emptyReason={emptyReason(chip)}
        onChanged={() => router.refresh()}
      />

      <CompanyDrawer
        company={selected ?? null}
        industries={industryNames}
        niches={niches}
        owners={owners}
        sequences={sequences}
        onClose={() => setParam({ fiche: null })}
        onChanged={refresh}
      />

      <VisitorsImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImported={() => router.refresh()}
      />

      <Drawer open={creating} title="Nouvelle société" onClose={() => setCreating(false)}>
        <CompanyForm
          company={null}
          industries={industryNames}
          niches={niches}
          onCancel={() => setCreating(false)}
          onSaved={refresh}
        />
      </Drawer>
    </div>
  );
}

const SORT_KEYS: readonly CompanySortKey[] = [
  "name",
  "industry",
  "size",
  "loc",
  "monthlyVisitors",
  "contacts",
  "openValue",
  "wonValue",
];

function isSortKey(value: string | null): value is CompanySortKey {
  return value !== null && SORT_KEYS.some((key) => key === value);
}

/** Une liste vide dit la règle qui l'a produite, pas seulement qu'elle est vide. */
function emptyReason(chip: string | null): string {
  switch (chip) {
    case "pipeline":
      return "Aucune société ne porte d'affaire en cours. Créez une affaire, ou rattachez-en une à une société.";
    case "clients":
      return "Aucune société n'a d'affaire gagnée. Une société devient cliente au premier gain enregistré.";
    case "orphan":
      return "Toutes les sociétés portent au moins un contact — rien à compléter de ce côté.";
    case "sansTrafic":
      return "Toutes les sociétés portent un trafic mensuel : les deux segments se calculent sur la totalité du portefeuille.";
    default:
      return "Modifiez la recherche ou les filtres, ou créez une société. L'import de contacts en crée également, à partir de la colonne « Société ».";
  }
}
