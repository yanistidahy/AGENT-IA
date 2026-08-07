import Link from "next/link";
import { readDbStatus } from "@/lib/db-status";
import { readDeployInfo } from "@/lib/deploy-info";

/**
 * Accueil, et cible du healthcheck Railway.
 *
 * `force-dynamic` est indispensable : sans lui, Next pré-rendrait la page au
 * build, où aucune base n'est joignable. Elle répond 200 même base éteinte, pour
 * afficher le diagnostic plutôt que de faire boucler les redémarrages.
 */
export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/pipeline", title: "Pipeline", desc: "Kanban glisser-déposer, fluxbar en tête." },
  { href: "/affaires", title: "Affaires", desc: "Liste filtrable, tri, fiche détaillée." },
] as const;

export default async function HomePage() {
  const status = await readDbStatus();
  const deploy = readDeployInfo();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">AuraFLOW CRM</h1>
        <p className="mt-1 text-[13px] text-muted">
          Jalon 1 — Affaires de bout en bout
          {deploy.commit !== null && (
            <span className="ml-2 font-mono text-[11px]">
              commit {deploy.commit}
              {deploy.branch !== null && ` · ${deploy.branch}`}
            </span>
          )}
        </p>
      </header>

      <section className="mb-5 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`size-2 rounded-full ${status.ok ? "bg-flux" : "bg-pulse"}`}
          />
          <h2 className="font-display text-[15px] font-semibold">
            {status.ok ? "Base de données connectée" : status.diagnosis.reason}
          </h2>
        </div>

        {status.ok ? (
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-4">
            {Object.entries(status.counts).map(([label, count]) => (
              <div key={label} className="bg-surface-2 px-3 py-2.5">
                <dt className="font-mono text-[9.5px] tracking-[0.13em] text-muted uppercase">
                  {label}
                </dt>
                <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                  {count}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#B2311F]">
            {status.diagnosis.hint}
          </p>
        )}
      </section>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-flux"
          >
            <h3 className="font-display text-[15px] font-semibold">{link.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
