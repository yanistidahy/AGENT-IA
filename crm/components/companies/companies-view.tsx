"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Eyebrow } from "@/components/ui/primitives";
import type { CompanyRecord } from "@/lib/api/companies";
import { moneyShort } from "@/lib/format";
import type { SequenceOption } from "@/components/activities/run-sequence";
import { CompanyDrawer } from "./company-drawer";
import { CompanyForm } from "./company-form";

/**
 * Grille de cartes plutôt qu'un tableau : une société se juge sur trois nombres
 * (contacts, pipeline ouvert, CA signé) qu'une carte présente d'un coup d'œil,
 * là où un tableau les noierait dans des colonnes de texte.
 */
interface CompaniesViewProps {
  readonly companies: readonly CompanyRecord[];
  readonly industries: readonly string[];
  readonly owners: readonly string[];
  readonly sequences: readonly SequenceOption[];
}

const CONTROL =
  "rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-flux";

export function CompaniesView({
  companies,
  industries,
  owners,
  sequences,
}: CompaniesViewProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<CompanyRecord | null>(null);
  const [creating, setCreating] = useState(false);

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

  const refresh = () => {
    setSelected(null);
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
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-control bg-flux px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-flux-d"
          >
            <Icon name="plus" size={15} />
            Nouvelle société
          </button>
        </div>
      </header>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <input
          className={`${CONTROL} min-w-[240px]`}
          placeholder="Rechercher une société…"
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
            <option key={industry}>{industry}</option>
          ))}
        </select>
      </div>

      {companies.length === 0 ? (
        <div className="rounded-card border border-line bg-surface shadow-card">
          <EmptyState title="Aucune société ne correspond.">
            <span className="text-[13px]">
              Modifiez la recherche, ou créez une société. L'import de contacts en crée
              également, à partir de la colonne « Société ».
            </span>
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => setSelected(company)}
              className="rounded-card border border-line bg-surface px-4 py-3.5 text-left shadow-card transition-colors hover:border-flux"
            >
              <div className="font-display text-[15px] font-semibold tracking-tight">
                {company.name}
              </div>
              <div className="mt-0.5 truncate text-[12.5px] text-muted">
                {[company.industry, company.loc].filter((v) => v !== "").join(" · ") || "—"}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line-2 pt-2.5">
                <Stat label="Contacts" value={String(company.contacts.length)} />
                <Stat label="Ouvert" value={moneyShort(company.openValue)} />
                <Stat label="Signé" value={moneyShort(company.wonValue)} />
              </div>
            </button>
          ))}
        </div>
      )}

      <CompanyDrawer
        company={selected}
        industries={industries}
        owners={owners}
        sequences={sequences}
        onClose={() => setSelected(null)}
        onChanged={refresh}
      />

      <Drawer open={creating} title="Nouvelle société" onClose={() => setCreating(false)}>
        <CompanyForm
          company={null}
          industries={industries}
          onCancel={() => setCreating(false)}
          onSaved={refresh}
        />
      </Drawer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-0.5 font-mono text-[13.5px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}
