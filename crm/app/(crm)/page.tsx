import Link from "next/link";
import { AlertList } from "@/components/activities/alert-list";
import { readAlerts } from "@/lib/api/alerts";
import { readDbStatus } from "@/lib/db-status";
import { readDeployInfo } from "@/lib/deploy-info";
import { shippedEntries } from "@/lib/navigation";

/**
 * Accueil, et cible du healthcheck Railway.
 *
 * `force-dynamic` est indispensable : sans lui, Next pré-rendrait la page au
 * build, où aucune base n'est joignable. Elle répond 200 même base éteinte, pour
 * afficher le diagnostic plutôt que de faire boucler les redémarrages.
 *
 * Aucun texte de cette page n'est écrit en dur à propos de l'état du produit :
 * les compteurs viennent de `readDbStatus()` (sept `count()` Prisma à chaque
 * requête) et les cartes de `lib/navigation.ts`, la même liste que le rail.
 * L'ancienne mention « Jalon 1 » était un artefact interne figé au premier
 * déploiement ; elle a été retirée plutôt que corrigée, parce qu'un numéro de
 * jalon n'apprend rien à l'utilisateur et redevient faux au jalon suivant.
 *
 * L'horodatage du rendu est affiché à côté du commit : si les compteurs
 * semblaient figés, il dit en un coup d'œil si la page a réellement été rendue à
 * l'instant — donc si le problème est la fraîcheur du rendu ou le contenu de la
 * base.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const status = await readDbStatus();
  const deploy = readDeployInfo();
  const renderedAt = new Date();
  // Les alertes ne sont lues que si la base répond : sur une base éteinte, la
  // page doit servir son diagnostic, pas échouer une seconde fois.
  const alerts = status.ok ? await readAlerts(renderedAt) : [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">AuraFLOW CRM</h1>
        <p className="mt-1 font-mono text-[11px] text-muted">
          {deploy.commit !== null && (
            <>
              commit {deploy.commit}
              {deploy.branch !== null && ` · ${deploy.branch}`}
              {" · "}
            </>
          )}
          rendu à{" "}
          <time dateTime={renderedAt.toISOString()}>
            {renderedAt.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: "Europe/Paris",
            })}
          </time>
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
          <>
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

            {status.total === 0 && (
              <p className="mt-3 rounded-control border border-[#F0DFB8] bg-gold-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#9A6410]">
                La base répond, mais elle est vide : les sept tables existent et ne
                contiennent aucune ligne. Ce n'est pas un affichage figé — c'est l'état
                réel de la base à laquelle ce déploiement est connecté. Lancez{" "}
                <code className="font-mono">npm run db:seed</code> sur le service pour
                charger le jeu de démonstration.
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#B2311F]">
            {status.diagnosis.hint}
          </p>
        )}
      </section>

      {status.ok && status.total > 0 && (
        <section className="mb-5">
          <h2 className="mb-2.5 font-display text-[15px] font-semibold">
            À traiter{alerts.length > 0 && ` (${alerts.length})`}
          </h2>
          <AlertList alerts={alerts} />
        </section>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        {shippedEntries().map((entry) => (
          <Link
            key={entry.label}
            href={entry.href ?? "/"}
            className="rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-flux"
          >
            <h3 className="font-display text-[15px] font-semibold">{entry.label}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{entry.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
