import { readEmailStats } from "@/lib/api/email-stats";
import { BarChart } from "@/components/charts/primitives";
import { EmptyChart } from "@/components/charts/empty-chart";
import {
  formatRate,
  OPEN_RATE_CAVEAT,
  OPEN_RATE_LABEL,
  type Rate,
} from "@/lib/domain/email-stats";

export const dynamic = "force-dynamic";

/**
 * La section « Emails ».
 *
 * **Trois faits, puis une estimation, dans cet ordre.** Envois, réponses,
 * rendez-vous sont saisis ou constatés ; le taux d'ouverture est estimé et
 * surestimé. Les afficher sur la même ligne sans les distinguer laisserait le
 * plus gros nombre passer pour le plus solide.
 *
 * Composant serveur de bout en bout : les graphiques sont des `<svg>` écrits à
 * la main, aucune ligne de JavaScript ne part au navigateur.
 */

function Stat({
  label,
  value,
  hint,
  estimate = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly estimate?: boolean;
}) {
  return (
    <div
      className={
        estimate
          ? "rounded-card border border-dashed border-line bg-surface-2 px-4 py-3"
          : "rounded-card border border-line bg-surface px-4 py-3 shadow-card"
      }
    >
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint !== undefined && (
        <p className="mt-1 max-w-[46ch] text-[11.5px] leading-relaxed text-muted">{hint}</p>
      )}
    </div>
  );
}

function rateHint(value: Rate): string {
  return value.value === null
    ? "Aucun envoi suivi sur la période."
    : `${value.numerator} sur ${value.denominator}`;
}

export default async function EmailsPage() {
  const stats = await readEmailStats();

  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Ce qui est réellement parti depuis ce CRM sur les {stats.windowDays} derniers
          jours, et ce que cela a produit.
        </p>
      </header>

      {stats.total === 0 ? (
        <EmptyChart
          title="Aucun email envoyé"
          reason={`Aucun message n'est parti depuis ce CRM sur les ${stats.windowDays} derniers jours.`}
          action="Ouvrez une fiche contact et cliquez « Rédiger un email »"
          href="/contacts"
        />
      ) : (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Envoyés" value={String(stats.total)} hint="Fait : messages partis." />
            <Stat
              label="Réponses"
              value={String(stats.replies)}
              hint={`Fait : ${formatRate(stats.replyRate)} des personnes écrites. Compté par personne, depuis les interactions consignées.`}
            />
            <Stat
              label="Rendez-vous obtenus"
              value={String(stats.meetings)}
              hint="Fait : interactions d'issue « RDV obtenu » postérieures à un envoi."
            />
            <Stat
              label={OPEN_RATE_LABEL}
              value={formatRate(stats.openRate)}
              hint={`${rateHint(stats.openRate)}. ${OPEN_RATE_CAVEAT}`}
              estimate
            />
          </section>

          {stats.copyFailures > 0 && (
            <p className="mb-5 rounded-control border border-[#F0DFB8] bg-gold-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#9A6410]">
              <strong>
                {stats.copyFailures} message{stats.copyFailures > 1 ? "s" : ""} n'
                {stats.copyFailures > 1 ? "ont" : "a"} pas été copié
                {stats.copyFailures > 1 ? "s" : ""} dans « Envoyés ».
              </strong>{" "}
              Ils sont bien partis — seule la copie IMAP a échoué. Le détail figure sur la
              fiche du contact, et la cause dans Réglages → Messagerie.
            </p>
          )}

          <section className="mb-6">
            <h2 className="mb-2 font-display text-sm font-semibold">Par semaine</h2>
            <BarChart
              points={stats.perWeek.map((bucket) => ({ label: bucket.label, value: bucket.count }))}
              format={(value) => String(value)}
              empty="Aucun envoi sur les douze dernières semaines."
            />
          </section>

          <section className="mb-6">
            <h2 className="mb-2 font-display text-sm font-semibold">Par jour, sur 30 jours</h2>
            <BarChart
              points={stats.perDay.map((bucket) => ({ label: bucket.label, value: bucket.count }))}
              format={(value) => String(value)}
              empty="Aucun envoi sur les trente derniers jours."
            />
          </section>

          <section>
            <h2 className="mb-2 font-display text-sm font-semibold">Par signataire</h2>
            <BarChart
              points={stats.perSignatory.map((bucket) => ({
                label: bucket.label,
                value: bucket.count,
              }))}
              format={(value) => String(value)}
              empty="Aucun signataire renseigné sur la période."
            />
          </section>
        </>
      )}
    </div>
  );
}
