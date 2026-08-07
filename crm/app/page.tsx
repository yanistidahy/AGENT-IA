import { prisma } from "@/lib/db";

/**
 * Page de vérification de la chaîne de déploiement (phase 1).
 *
 * `force-dynamic` est indispensable : sans lui, Next tenterait de pré-rendre
 * cette page au moment du build, où aucune base n'est joignable, et le build
 * échouerait. La lecture se fait donc à chaque requête.
 */
export const dynamic = "force-dynamic";

const APP_VERSION = "0.1.0";
const PHASE = "Phase 1 — Fondations";

interface Counts {
  readonly étapes: number;
  readonly sociétés: number;
  readonly contacts: number;
  readonly affaires: number;
  readonly interactions: number;
  readonly tâches: number;
  readonly séquences: number;
}

type DbStatus =
  | { readonly ok: true; readonly counts: Counts; readonly total: number }
  | { readonly ok: false; readonly reason: string };

async function readStatus(): Promise<DbStatus> {
  try {
    const [étapes, sociétés, contacts, affaires, interactions, tâches, séquences] =
      await Promise.all([
        prisma.stage.count(),
        prisma.company.count(),
        prisma.contact.count(),
        prisma.deal.count(),
        prisma.activity.count(),
        prisma.task.count(),
        prisma.sequence.count(),
      ]);

    const counts: Counts = {
      étapes,
      sociétés,
      contacts,
      affaires,
      interactions,
      tâches,
      séquences,
    };

    return {
      ok: true,
      counts,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    };
  } catch (error) {
    // On expose le type d'erreur, jamais le message brut : une erreur Prisma de
    // connexion contient l'URL de la base, mot de passe inclus.
    const reason =
      error instanceof Error ? error.name : "Erreur inconnue à la connexion";
    return { ok: false, reason };
  }
}

export default async function Page() {
  const status = await readStatus();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-5 p-6">
      <header className="rounded-card bg-ink p-6 shadow-card">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-flux">
          AuraFLOW AI
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">
          AuraFLOW CRM
        </h1>
        <p className="mt-2 text-[13px] text-[#9DB5B0]">
          {PHASE} · version {APP_VERSION}
        </p>
      </header>

      <section className="rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`size-2 rounded-full ${status.ok ? "bg-flux" : "bg-pulse"}`}
          />
          <h2 className="font-display text-[15px] font-semibold">
            {status.ok ? "Base de données connectée" : "Base de données injoignable"}
          </h2>
        </div>

        {status.ok ? (
          <>
            <p className="mt-2 text-[13px] text-muted">
              {status.total === 0
                ? "La connexion répond, mais aucune donnée n'est encore chargée. Lancez « npm run db:seed » pour importer le jeu de démonstration."
                : `${status.total} enregistrements chargés par le seed.`}
            </p>

            {status.total > 0 && (
              <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-4">
                {Object.entries(status.counts).map(([label, count]) => (
                  <div key={label} className="bg-surface-2 px-3 py-3">
                    <dt className="font-mono text-[9.5px] uppercase tracking-[0.13em] text-muted">
                      {label}
                    </dt>
                    <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
                      {count}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        ) : (
          <div className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3.5 py-3">
            <p className="text-[13px] font-semibold text-[#B2311F]">{status.reason}</p>
            <p className="mt-1 text-[12.5px] text-[#B2311F]">
              Vérifiez que <code className="font-mono">DATABASE_URL</code> est
              renseignée sur le service et que les migrations sont appliquées.
            </p>
          </div>
        )}
      </section>

      <p className="text-center text-[12px] text-muted">
        Les vues du CRM arrivent en phase 2.
      </p>
    </main>
  );
}
