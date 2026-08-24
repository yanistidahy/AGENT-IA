import Link from "next/link";
import { PERIOD_LABELS, PERIODS, type PeriodKind } from "@/lib/domain/performance";
import type { Performance } from "@/lib/api/performance";
import { dayKey } from "@/lib/domain/dates";

/**
 * Le sélecteur de période et le filtre par personne.
 *
 * **Tout l'état vit dans l'URL** : une vue se met en favori, se partage et
 * survit à un rechargement. Composant serveur — la période libre passe par un
 * formulaire GET, qui n'est qu'une autre façon d'écrire l'URL, sans une ligne
 * de JavaScript.
 */
export function PerfFilters({ perf, kind }: { readonly perf: Performance; readonly kind: PeriodKind }) {
  const href = (patch: { periode?: PeriodKind; qui?: string | null }): string => {
    const params = new URLSearchParams();
    const periode = patch.periode ?? kind;
    if (periode !== "semaine") params.set("periode", periode);
    if (periode === "libre") {
      params.set("du", dayKey(perf.period.from));
      params.set("au", dayKey(new Date(perf.period.to.getTime() - 1)));
    }
    const qui = patch.qui === undefined ? perf.owner : patch.qui;
    if (qui !== null) params.set("qui", qui);
    const text = params.toString();
    return text === "" ? "/performance" : `/performance?${text}`;
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <nav aria-label="Période" className="flex flex-wrap gap-1.5">
        {PERIODS.filter((period) => period !== "libre").map((period) => (
          <Chip
            key={period}
            href={href({ periode: period })}
            active={kind === period}
            label={PERIOD_LABELS[period]}
          />
        ))}
        {kind === "libre" && <Chip href={href({})} active label={PERIOD_LABELS.libre} />}
      </nav>

      {/* La période libre : deux dates, un GET. */}
      <form action="/performance" method="get" className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="periode" value="libre" />
        {perf.owner !== null && <input type="hidden" name="qui" value={perf.owner} />}
        <input
          type="date"
          name="du"
          aria-label="Début de la période libre"
          defaultValue={kind === "libre" ? dayKey(perf.period.from) : ""}
          className="rounded-control border border-line bg-surface px-2 py-1 text-[11.5px]"
        />
        <span className="text-[11px] text-muted">→</span>
        <input
          type="date"
          name="au"
          aria-label="Fin de la période libre"
          defaultValue={kind === "libre" ? dayKey(new Date(perf.period.to.getTime() - 1)) : ""}
          className="rounded-control border border-line bg-surface px-2 py-1 text-[11.5px]"
        />
        <button
          type="submit"
          className="rounded-control border border-line bg-surface px-2 py-1 text-[11.5px] font-medium hover:bg-surface-2"
        >
          Appliquer
        </button>
      </form>

      {perf.owners.length > 1 && (
        <nav aria-label="Personne" className="ml-auto flex flex-wrap gap-1.5">
          <Chip href={href({ qui: null })} active={perf.owner === null} label="Tous" />
          {perf.owners.map((name) => (
            <Chip key={name} href={href({ qui: name })} active={perf.owner === name} label={name} />
          ))}
        </nav>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  label,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly label: string;
}) {
  return (
    <Link
      scroll={false}
      href={href}
      className={`rounded-full border px-2.5 py-[3px] text-[11.5px] transition-colors ${
        active
          ? "border-brand bg-brand-l font-medium text-brand-d"
          : "border-line bg-surface text-muted hover:bg-surface-2"
      }`}
    >
      {label}
    </Link>
  );
}
