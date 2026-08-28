import { EMAIL_WINDOW_DAYS, readEmailStats } from "@/lib/api/email-stats";
import { readDmLift } from "@/lib/api/dm-lift";
import { DmLiftBlock } from "@/components/emails/dm-lift-block";
import { parseSentQuery, readSentEmails, readSilentContacts } from "@/lib/api/email-list";
import { listOwners } from "@/lib/api/reference";
import { EmptyChart } from "@/components/charts/empty-chart";
import { FunnelRow } from "@/components/emails/funnel-row";
import { SentTable } from "@/components/emails/sent-table";
import { NoReplyBlock } from "@/components/emails/no-reply-block";
import { EmailCharts } from "@/components/emails/email-charts";
import { SignatoryTable } from "@/components/emails/signatory-table";

export const dynamic = "force-dynamic";

/**
 * La section « Emails ».
 *
 * **L'ordre de la page est son argument.** Le reproche auquel elle répond était
 * une affaire de proportions : quatre cartes, puis deux graphiques presque vides
 * occupant le reste de l'écran — onze messages envoyés, et une page qui montrait
 * surtout du vide. La substance passe donc devant, et les graphiques ne
 * s'affichent que lorsqu'ils portent quelque chose :
 *
 * 1. **l'entonnoir** — les quatre nombres lus comme une suite, avec la chute ;
 * 2. **ce qui est parti**, et **qui n'a pas répondu**, côte à côte : le journal
 *    et la file de travail, qui sont les deux raisons d'ouvrir cette page ;
 * 3. **par signataire**, depuis qu'ils sont deux ;
 * 4. **les graphiques en dernier**, et seulement quand l'histoire existe.
 *
 * Composant serveur de bout en bout, sauf le bloc « sans réponse » — il écrit.
 */
export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseSentQuery(await searchParams);

  const [stats, list, silent, owners, lift] = await Promise.all([
    readEmailStats(),
    readSentEmails(query),
    readSilentContacts(),
    listOwners(),
    // Même fenêtre que les statistiques d'envoi : deux périodes différentes sur
    // le même écran feraient comparer des choses qui ne se comparent pas.
    readDmLift(EMAIL_WINDOW_DAYS),
  ]);

  if (stats.total === 0) {
    return (
      <div className="px-6 py-5">
        <Header windowDays={stats.windowDays} spanDays={0} />
        <EmptyChart
          title="Aucun email envoyé"
          reason={`Aucun message n'est parti depuis ce CRM sur les ${stats.windowDays} derniers jours.`}
          action="Ouvrez une fiche contact et cliquez « Rédiger un email »"
          href="/contacts"
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-5">
      <Header windowDays={stats.windowDays} spanDays={stats.depth.spanDays} />

      <section className="mb-4">
        <FunnelRow steps={stats.funnel} />
        {stats.openTrust.unaudited > 0 && (
          // **Le taux d'ouverture est plus faux que « surestimé » sur ces
          // envois-là** : leurs chargements n'ont jamais été enregistrés un par
          // un, donc ni notre propre copie dans « Envoyés », ni les rechargements
          // d'un même client n'en ont été retirés. Le dire ici, sous le chiffre,
          // plutôt que de laisser croire qu'il a été trié.
          <p className="mt-2 rounded-control border border-[#F0DFB8] bg-gold-l px-3.5 py-2 text-[12px] leading-relaxed text-[#9A6410]">
            <strong>
              L'estimation d'ouverture n'est pas vérifiable sur {stats.openTrust.unaudited} envoi
              {stats.openTrust.unaudited > 1 ? "s" : ""} sur {stats.openTrust.tracked}.
            </strong>{" "}
            Leurs chargements de pixel précèdent le tri : notre propre copie dans « Envoyés » y
            comptait comme une ouverture, et un client qui rechargeait l'image comptait autant de
            fois. Le détail est dans Réglages → Messagerie.
          </p>
        )}
      </section>

      {stats.copyFailures > 0 && (
        <p className="mb-4 rounded-control border border-[#F0DFB8] bg-gold-l px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#9A6410]">
          <strong>
            {stats.copyFailures} message{stats.copyFailures > 1 ? "s" : ""} n'
            {stats.copyFailures > 1 ? "ont" : "a"} pas été copié
            {stats.copyFailures > 1 ? "s" : ""} dans « Envoyés ».
          </strong>{" "}
          Ils sont bien partis — seule la copie IMAP a échoué. La cause figure dans Réglages →
          Messagerie.
        </p>
      )}

      {/* Le journal et la file de travail côte à côte : on lit ce qui est parti
          à gauche, on agit à droite, sans changer d'écran ni perdre le tri. */}
      <section className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SentTable list={list} query={query} />
        <NoReplyBlock rows={silent} owners={owners} defaultOwner={owners[0] ?? ""} />
      </section>

      {/* La comparaison qui décide de la stratégie : elle passe **avant** les
          graphiques, comme l'entonnoir — les faits d'abord, la forme ensuite. */}
      <section className="mb-4">
        <DmLiftBlock lift={lift} />
      </section>

      <section className="mb-4">
        <SignatoryTable lines={stats.perSignatory} />
      </section>

      <EmailCharts stats={stats} />
    </div>
  );
}

function Header({
  windowDays,
  spanDays,
}: {
  readonly windowDays: number;
  readonly spanDays: number;
}) {
  return (
    <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="font-display text-xl font-semibold tracking-tight">Emails</h1>
      <p className="text-[12.5px] text-muted">
        Ce qui est parti depuis ce CRM sur les {windowDays} derniers jours, et ce que cela a
        produit.
        {spanDays > 0 && (
          <>
            {" "}
            <span className="tabular-nums">{spanDays}</span> jour{spanDays > 1 ? "s" : ""}{" "}
            d'activité mesurée.
          </>
        )}
      </p>
    </header>
  );
}
