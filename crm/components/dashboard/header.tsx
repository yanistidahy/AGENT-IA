import { Eyebrow } from "@/components/ui/primitives";
import { money, moneyShort, percent } from "@/lib/format";

/**
 * En-tête du centre de pilotage : où en est le mois, en trois nombres.
 *
 * La barre de progression est plafonnée visuellement à 100 % mais le
 * pourcentage affiché ne l'est pas : dépasser l'objectif est une information,
 * pas un débordement à masquer.
 */
interface HeaderProps {
  readonly now: Date;
  readonly pipelineValue: number;
  readonly weightedValue: number;
  readonly monthRevenue: number;
  readonly objective: number;
  readonly openCount: number;
}

function greeting(hour: number): string {
  if (hour < 6) return "Bonne nuit";
  if (hour < 18) return "Bonjour";
  return "Bonsoir";
}

export function DashboardHeader({
  now,
  pipelineValue,
  weightedValue,
  monthRevenue,
  objective,
  openCount,
}: HeaderProps) {
  const ratio = objective === 0 ? 0 : (monthRevenue / objective) * 100;

  return (
    <header className="mb-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {greeting(now.getHours())}
      </h1>
      <p className="mt-0.5 text-[13px] text-muted first-letter:uppercase">
        {now.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
          <Eyebrow>Pipeline ouvert</Eyebrow>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {moneyShort(pipelineValue)}
          </div>
          <div className="mt-0.5 text-[12px] text-muted">{openCount} affaires en cours</div>
        </div>

        <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
          <Eyebrow>Pondéré</Eyebrow>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {moneyShort(weightedValue)}
          </div>
          <div className="mt-0.5 text-[12px] text-muted">montant × probabilité d'étape</div>
        </div>

        <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
          <Eyebrow>Ce mois-ci</Eyebrow>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {moneyShort(monthRevenue)}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
            <div
              className={`h-full rounded-full ${ratio >= 100 ? "bg-win" : "bg-gold"}`}
              style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
            />
          </div>
          <div className="mt-1 text-[12px] text-muted">
            {percent(ratio)} de l'objectif ({money(objective)})
          </div>
        </div>
      </div>
    </header>
  );
}
